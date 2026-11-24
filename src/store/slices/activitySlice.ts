import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { ActivityEvent, AuditRecord } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listActivity, listAudit } from "@/services/api";
import type { ActivityListQuery } from "@/services/activityApi";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  SHORT_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type ActivityState = {
  activity: CachedListState<ActivityEvent> & { queryKey: string };
  audit: CachedListState<AuditRecord>;
};

const initialState: ActivityState = {
  activity: { ...emptyCachedList(), queryKey: "" },
  audit: emptyCachedList(),
};

function toActivityQueryKey(query?: ActivityListQuery): string {
  return JSON.stringify({
    q: query?.q ?? "",
    category: query?.category ?? "",
    investorRef: query?.investorRef ?? query?.investorId ?? "",
    sort: query?.sort ?? "-occurredAt",
    limit: query?.limit ?? 50,
    offset: query?.offset ?? 0,
  });
}

export const ensureActivity = createAsyncThunk<
  ActivityEvent[],
  (ActivityListQuery & { force?: boolean }) | undefined,
  { state: { activityLog: ActivityState }; rejectValue: string }
>(
  "activityLog/ensureActivity",
  async (arg, { rejectWithValue }) => {
    try {
      return await listActivity(arg);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load activity.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().activityLog.activity;
      if (isFetchInFlight(current)) return false;
      if (toActivityQueryKey(arg) !== current.queryKey) return true;
      return !isCacheFresh(current.fetchedAt, SHORT_TTL_MS, current.invalidated);
    },
  },
);

export const ensureAudit = createAsyncThunk<
  AuditRecord[],
  { force?: boolean } | undefined,
  { state: { activityLog: ActivityState }; rejectValue: string }
>(
  "activityLog/ensureAudit",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listAudit();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load audit log.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().activityLog.audit;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, SHORT_TTL_MS, current.invalidated);
    },
  },
);

const activitySlice = createSlice({
  name: "activityLog",
  initialState,
  reducers: {
    invalidateActivity(state) {
      state.activity.invalidated = true;
    },
    invalidateAudit(state) {
      state.audit.invalidated = true;
    },
    resetActivityLog() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(loginThunk.fulfilled, () => initialState)
      .addCase(sessionScopeChanged, () => initialState)
      .addCase(ensureActivity.pending, (state, action) => {
        state.activity.status = "loading";
        state.activity.error = null;
        state.activity.queryKey = toActivityQueryKey(action.meta.arg);
      })
      .addCase(ensureActivity.fulfilled, (state, action) => {
        state.activity.items = action.payload;
        state.activity.status = "succeeded";
        state.activity.error = null;
        state.activity.fetchedAt = Date.now();
        state.activity.invalidated = false;
        state.activity.queryKey = toActivityQueryKey(action.meta.arg);
      })
      .addCase(ensureActivity.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.activity.status = "failed";
        state.activity.error = action.payload ?? "Unable to load activity.";
      })
      .addCase(ensureAudit.pending, (state) => {
        state.audit.status = "loading";
        state.audit.error = null;
      })
      .addCase(ensureAudit.fulfilled, (state, action) => {
        state.audit.items = action.payload;
        state.audit.status = "succeeded";
        state.audit.error = null;
        state.audit.fetchedAt = Date.now();
        state.audit.invalidated = false;
      })
      .addCase(ensureAudit.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.audit.status = "failed";
        state.audit.error = action.payload ?? "Unable to load audit log.";
      });
  },
});

export const { invalidateActivity, invalidateAudit, resetActivityLog } =
  activitySlice.actions;
export default activitySlice.reducer;
