import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Investor } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listInvestors } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  DEFAULT_LIST_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type InvestorsState = CachedListState<Investor>;

const initialState: InvestorsState = emptyCachedList();

export const ensureInvestors = createAsyncThunk<
  Investor[],
  { force?: boolean } | undefined,
  { state: { investors: InvestorsState }; rejectValue: string }
>(
  "investors/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listInvestors();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load investors.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().investors;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, DEFAULT_LIST_TTL_MS, current.invalidated);
    },
  },
);

const investorsSlice = createSlice({
  name: "investors",
  initialState,
  reducers: {
    invalidateInvestors(state) {
      state.invalidated = true;
    },
    upsertInvestor(state, action: { payload: Investor }) {
      const idx = state.items.findIndex((i) => i.id === action.payload.id);
      if (idx >= 0) state.items[idx] = action.payload;
      else state.items.unshift(action.payload);
    },
    removeInvestorLocal(state, action: { payload: string }) {
      state.items = state.items.filter((i) => i.id !== action.payload);
    },
    resetInvestors() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensureInvestors.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureInvestors.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureInvestors.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load investors.";
      });
  },
});

export const {
  invalidateInvestors,
  upsertInvestor,
  removeInvestorLocal,
  resetInvestors,
} = investorsSlice.actions;
export default investorsSlice.reducer;
