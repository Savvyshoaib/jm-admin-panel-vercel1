import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { DashboardStats } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { getDashboardStats } from "@/services/api";
import {
  logout,
  loginThunk,
  sessionScopeChanged,
} from "@/store/slices/authSlice";
import {
  SHORT_TTL_MS,
  isCacheFresh,
  isFetchInFlight,
  type LoadStatus,
} from "@/store/cachePolicy";

type DashboardState = {
  data: DashboardStats | null;
  status: LoadStatus;
  error: string | null;
  fetchedAt: number | null;
  invalidated: boolean;
};

const initialState: DashboardState = {
  data: null,
  status: "idle",
  error: null,
  fetchedAt: null,
  invalidated: true,
};

export const ensureDashboard = createAsyncThunk<
  DashboardStats,
  { force?: boolean } | undefined,
  { state: { dashboard: DashboardState }; rejectValue: string }
>(
  "dashboard/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await getDashboardStats();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load dashboard.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().dashboard;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, SHORT_TTL_MS, current.invalidated);
    },
  },
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    invalidateDashboard(state) {
      state.invalidated = true;
    },
    resetDashboard() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(loginThunk.fulfilled, () => initialState)
      .addCase(sessionScopeChanged, () => initialState)
      .addCase(ensureDashboard.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureDashboard.fulfilled, (state, action) => {
        state.data = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureDashboard.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load dashboard.";
      });
  },
});

export const { invalidateDashboard, resetDashboard } = dashboardSlice.actions;
export default dashboardSlice.reducer;
