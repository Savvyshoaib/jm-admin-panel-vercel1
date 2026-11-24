import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { InternalUser } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listUsers } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  DEFAULT_LIST_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type UsersState = CachedListState<InternalUser>;

const initialState: UsersState = emptyCachedList();

export const ensureUsers = createAsyncThunk<
  InternalUser[],
  { force?: boolean } | undefined,
  { state: { users: UsersState }; rejectValue: string }
>(
  "users/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listUsers();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load users.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().users;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, DEFAULT_LIST_TTL_MS, current.invalidated);
    },
  },
);

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    invalidateUsers(state) {
      state.invalidated = true;
    },
    upsertUser(state, action: { payload: InternalUser }) {
      const idx = state.items.findIndex((u) => u.id === action.payload.id);
      if (idx >= 0) state.items[idx] = action.payload;
      else state.items.unshift(action.payload);
    },
    resetUsers() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensureUsers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureUsers.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureUsers.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load users.";
      });
  },
});

export const { invalidateUsers, upsertUser, resetUsers } = usersSlice.actions;
export default usersSlice.reducer;
