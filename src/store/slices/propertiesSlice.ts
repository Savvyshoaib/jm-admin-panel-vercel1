import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PropertyUnit } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { compareSortOrder } from "@/lib/listOrder";
import { listProperties } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  DEFAULT_LIST_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type PropertiesState = CachedListState<PropertyUnit>;

const initialState: PropertiesState = emptyCachedList();

export const ensureProperties = createAsyncThunk<
  PropertyUnit[],
  { force?: boolean } | undefined,
  { state: { properties: PropertiesState }; rejectValue: string }
>(
  "properties/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listProperties();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load properties.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().properties;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, DEFAULT_LIST_TTL_MS, current.invalidated);
    },
  },
);

const propertiesSlice = createSlice({
  name: "properties",
  initialState,
  reducers: {
    invalidateProperties(state) {
      state.invalidated = true;
    },
    upsertProperty(state, action: { payload: PropertyUnit }) {
      const next = action.payload;
      if (!next?.id) return;
      const idx = state.items.findIndex((p) => String(p.id) === String(next.id));
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
          (max, p) => Math.max(max, p.sortOrder ?? 0),
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
    replaceProperties(state, action: { payload: PropertyUnit[] }) {
      state.items = [...action.payload].sort(compareSortOrder);
      state.status = "succeeded";
      state.error = null;
      state.fetchedAt = Date.now();
      state.invalidated = false;
    },
    removePropertyLocal(state, action: { payload: string }) {
      state.items = state.items.filter((p) => String(p.id) !== String(action.payload));
    },
    resetProperties() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensureProperties.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureProperties.fulfilled, (state, action) => {
        state.items = [...action.payload].sort(compareSortOrder);
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureProperties.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load properties.";
      });
  },
});

export const {
  invalidateProperties,
  upsertProperty,
  replaceProperties,
  removePropertyLocal,
  resetProperties,
} = propertiesSlice.actions;
export default propertiesSlice.reducer;
