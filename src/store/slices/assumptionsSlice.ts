import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Assumption } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listAssumptions } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  LONG_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type AssumptionsState = CachedListState<Assumption>;

const initialState: AssumptionsState = emptyCachedList();

export const ensureAssumptions = createAsyncThunk<
  Assumption[],
  { force?: boolean } | undefined,
  { state: { assumptions: AssumptionsState }; rejectValue: string }
>(
  "assumptions/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listAssumptions();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load assumptions.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().assumptions;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, LONG_TTL_MS, current.invalidated);
    },
  },
);

const assumptionsSlice = createSlice({
  name: "assumptions",
  initialState,
  reducers: {
    invalidateAssumptions(state) {
      state.invalidated = true;
    },
    upsertAssumption(state, action: { payload: Assumption }) {
      const next = action.payload;
      if (!next?.id) return;
      const idx = state.items.findIndex((a) => String(a.id) === String(next.id));
      if (idx >= 0) {
        state.items[idx] = { ...state.items[idx], ...next, id: String(next.id) };
      } else {
        state.items.unshift({ ...next, id: String(next.id) });
      }
    },
    resetAssumptions() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensureAssumptions.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureAssumptions.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureAssumptions.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load assumptions.";
      });
  },
});

export const { invalidateAssumptions, upsertAssumption, resetAssumptions } =
  assumptionsSlice.actions;
export default assumptionsSlice.reducer;
