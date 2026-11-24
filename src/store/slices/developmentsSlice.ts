import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Development } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { compareSortOrder } from "@/lib/listOrder";
import { listDevelopments } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  DEFAULT_LIST_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type DevelopmentsState = CachedListState<Development>;

const initialState: DevelopmentsState = emptyCachedList();

export const ensureDevelopments = createAsyncThunk<
  Development[],
  { force?: boolean } | undefined,
  { state: { developments: DevelopmentsState }; rejectValue: string }
>(
  "developments/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listDevelopments();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load developments.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().developments;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(
        current.fetchedAt,
        DEFAULT_LIST_TTL_MS,
        current.invalidated,
      );
    },
  },
);

const developmentsSlice = createSlice({
  name: "developments",
  initialState,
  reducers: {
    invalidateDevelopments(state) {
      state.invalidated = true;
    },
    upsertDevelopment(state, action: { payload: Development }) {
      const next = action.payload;
      if (!next?.id) return;
      const idx = state.items.findIndex(
        (d) => String(d.id) === String(next.id),
      );
      if (idx >= 0) {
        const prev = state.items[idx];
        const sortOrder =
          next.sortOrder != null && next.sortOrder !== Number.MAX_SAFE_INTEGER
            ? next.sortOrder
            : prev.sortOrder;
        state.items[idx] = {
          ...prev,
          ...next,
          id: String(next.id),
          sortOrder,
        };
      } else {
        const maxOrder = state.items.reduce(
          (max, d) => Math.max(max, d.sortOrder ?? 0),
          0,
        );
        state.items.push({
          ...next,
          id: String(next.id),
          sortOrder:
            next.sortOrder != null && next.sortOrder !== Number.MAX_SAFE_INTEGER
              ? next.sortOrder
              : maxOrder + 1,
        });
      }
      state.items.sort(compareSortOrder);
    },
    replaceDevelopments(state, action: { payload: Development[] }) {
      state.items = [...action.payload].sort(compareSortOrder);
      state.status = "succeeded";
      state.error = null;
      state.fetchedAt = Date.now();
      state.invalidated = false;
    },
    removeDevelopmentLocal(state, action: { payload: string }) {
      state.items = state.items.filter(
        (d) => String(d.id) !== String(action.payload),
      );
    },
    resetDevelopments() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensureDevelopments.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureDevelopments.fulfilled, (state, action) => {
        state.items = [...action.payload].sort(compareSortOrder);
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureDevelopments.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load developments.";
      });
  },
});

export const {
  invalidateDevelopments,
  upsertDevelopment,
  replaceDevelopments,
  removeDevelopmentLocal,
  resetDevelopments,
} = developmentsSlice.actions;
export default developmentsSlice.reducer;
