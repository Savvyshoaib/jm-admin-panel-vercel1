import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PaymentSchedule } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listPayments } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  DEFAULT_LIST_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type PaymentsState = CachedListState<PaymentSchedule>;

const initialState: PaymentsState = emptyCachedList();

export const ensurePayments = createAsyncThunk<
  PaymentSchedule[],
  { force?: boolean } | undefined,
  { state: { payments: PaymentsState }; rejectValue: string }
>(
  "payments/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listPayments();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load payments.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().payments;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(
        current.fetchedAt,
        DEFAULT_LIST_TTL_MS,
        current.invalidated,
      );
    },
  },
);

const paymentsSlice = createSlice({
  name: "payments",
  initialState,
  reducers: {
    invalidatePayments(state) {
      state.invalidated = true;
    },
    upsertPayment(state, action: { payload: PaymentSchedule }) {
      const next = action.payload;
      if (!next?.id) return;
      const idx = state.items.findIndex(
        (p) => String(p.id) === String(next.id),
      );
      if (idx >= 0) {
        state.items[idx] = { ...state.items[idx], ...next, id: String(next.id) };
      } else {
        state.items.unshift({ ...next, id: String(next.id) });
      }
    },
    resetPayments() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensurePayments.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensurePayments.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensurePayments.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load payments.";
      });
  },
});

export const { invalidatePayments, upsertPayment, resetPayments } =
  paymentsSlice.actions;
export default paymentsSlice.reducer;
