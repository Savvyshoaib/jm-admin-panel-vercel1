import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { InternalUser } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listAgents } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import { ensureUsers } from "@/store/slices/usersSlice";
import {
  DEFAULT_LIST_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type AgentsState = CachedListState<InternalUser>;

const initialState: AgentsState = emptyCachedList();

function isAssignableStaff(user: InternalUser): boolean {
  return user.role === "agent" || user.role === "super_admin";
}

function mergeAssignable(
  agents: InternalUser[],
  users: InternalUser[],
): InternalUser[] {
  const byId = new Map<string, InternalUser>();
  for (const user of agents) byId.set(String(user.id), user);
  for (const user of users) {
    if (!isAssignableStaff(user)) continue;
    byId.set(String(user.id), user);
  }
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export const ensureAgents = createAsyncThunk<
  InternalUser[],
  { force?: boolean } | undefined,
  {
    state: {
      agents: AgentsState;
      users: CachedListState<InternalUser>;
    };
    rejectValue: string;
  }
>(
  "agents/ensure",
  async (_arg, { dispatch, getState, rejectWithValue }) => {
    try {
      const agents = await listAgents();
      // Reuse /admin/users from Redux when fresh; otherwise warm the cache once.
      try {
        await dispatch(ensureUsers()).unwrap();
      } catch {
        /* Users may already be cached, or this role cannot list users. */
      }
      return mergeAssignable(agents, getState().users.items);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load agents.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().agents;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, DEFAULT_LIST_TTL_MS, current.invalidated);
    },
  },
);

const agentsSlice = createSlice({
  name: "agents",
  initialState,
  reducers: {
    invalidateAgents(state) {
      state.invalidated = true;
    },
    resetAgents() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensureAgents.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureAgents.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureAgents.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load agents.";
      });
  },
});

export const { invalidateAgents, resetAgents } = agentsSlice.actions;
export default agentsSlice.reducer;
