import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  fetchLandRegistryRegions,
  type LandRegistryRegion,
} from "@/services/regionsApi";
import {
  emptyCachedList,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type RegionsState = CachedListState<LandRegistryRegion>;

const initialState: RegionsState = emptyCachedList();

export const ensureRegions = createAsyncThunk<
  LandRegistryRegion[],
  { force?: boolean } | undefined,
  { state: { regions: RegionsState }; rejectValue: string }
>(
  "regions/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await fetchLandRegistryRegions();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load regions.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().regions;
      if (isFetchInFlight(current)) return false;
      // Reference data — keep in Redux and skip refetch once loaded.
      if (current.status === "succeeded" && current.items.length > 0) {
        return false;
      }
      return true;
    },
  },
);

const regionsSlice = createSlice({
  name: "regions",
  initialState,
  reducers: {
    invalidateRegions(state) {
      state.invalidated = true;
    },
    resetRegions() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(ensureRegions.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureRegions.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureRegions.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load regions.";
      });
  },
});

export const { invalidateRegions, resetRegions } = regionsSlice.actions;
export default regionsSlice.reducer;
