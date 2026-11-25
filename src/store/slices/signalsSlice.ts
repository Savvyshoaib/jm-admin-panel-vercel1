import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { IntentSignal } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listSignals, updateSignal } from "@/services/api";
import type { SignalListQuery } from "@/services/signalsApi";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  SHORT_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type SignalsState = CachedListState<IntentSignal> & {
  queryKey: string;
};

const initialState: SignalsState = {
  ...emptyCachedList(),
  queryKey: "",
};

function toQueryKey(query?: SignalListQuery): string {
  return JSON.stringify({
    q: query?.q ?? "",
    strength: query?.strength ?? "",
    investorRef: query?.investorRef ?? "",
    limit: query?.limit ?? 50,
    offset: query?.offset ?? 0,
  });
}

export const ensureSignals = createAsyncThunk<
  IntentSignal[],
  (SignalListQuery & { force?: boolean }) | undefined,
  { state: { signals: SignalsState }; rejectValue: string }
>(
  "signals/ensure",
  async (arg, { rejectWithValue }) => {
    try {
      return await listSignals(arg);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load signals.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().signals;
      if (isFetchInFlight(current)) return false;
      if (toQueryKey(arg) !== current.queryKey) return true;
      return !isCacheFresh(current.fetchedAt, SHORT_TTL_MS, current.invalidated);
    },
  },
);

export const patchSignalThunk = createAsyncThunk<
  IntentSignal,
  {
    id: string;
    patch: Partial<Pick<IntentSignal, "status" | "agentNotes" | "intentLevel">>;
  },
  { rejectValue: string }
>("signals/patch", async ({ id, patch }, { rejectWithValue }) => {
  try {
    return await updateSignal(id, patch);
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Unable to update signal.";
    return rejectWithValue(message);
  }
});

const signalsSlice = createSlice({
  name: "signals",
  initialState,
  reducers: {
    invalidateSignals(state) {
      state.invalidated = true;
    },
    upsertSignal(state, action: PayloadAction<IntentSignal>) {
      const idx = state.items.findIndex(
        (s) => String(s.id) === String(action.payload.id),
      );
      if (idx >= 0) state.items[idx] = { ...state.items[idx], ...action.payload };
      else state.items.unshift(action.payload);
    },
    resetSignals() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(loginThunk.fulfilled, () => initialState)
      .addCase(sessionScopeChanged, () => initialState)
      .addCase(ensureSignals.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.queryKey = toQueryKey(action.meta.arg);
      })
      .addCase(ensureSignals.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
        state.queryKey = toQueryKey(action.meta.arg);
      })
      .addCase(ensureSignals.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load signals.";
      })
      .addCase(patchSignalThunk.fulfilled, (state, action) => {
        const idx = state.items.findIndex(
          (s) => String(s.id) === String(action.payload.id),
        );
        if (idx >= 0) {
          state.items[idx] = { ...state.items[idx], ...action.payload };
        }
      });
  },
});

export const { invalidateSignals, resetSignals, upsertSignal } =
  signalsSlice.actions;
export default signalsSlice.reducer;
