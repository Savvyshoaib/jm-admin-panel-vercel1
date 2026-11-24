import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { ContentBlock } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listContent } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  DEFAULT_LIST_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type ContentState = CachedListState<ContentBlock>;

const initialState: ContentState = emptyCachedList();

export const ensureContent = createAsyncThunk<
  ContentBlock[],
  { force?: boolean } | undefined,
  { state: { content: ContentState }; rejectValue: string }
>(
  "content/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listContent();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load content.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().content;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, DEFAULT_LIST_TTL_MS, current.invalidated);
    },
  },
);

const contentSlice = createSlice({
  name: "content",
  initialState,
  reducers: {
    invalidateContent(state) {
      state.invalidated = true;
    },
    upsertContent(state, action: { payload: ContentBlock }) {
      const next = action.payload;
      if (!next?.id && !next?.key) return;
      const idx = state.items.findIndex(
        (c) =>
          (next.id && String(c.id) === String(next.id)) ||
          (!!next.key && c.key === next.key),
      );
      if (idx >= 0) {
        state.items[idx] = {
          ...state.items[idx],
          ...next,
          id: String(next.id || state.items[idx].id),
        };
      } else {
        state.items.unshift({ ...next, id: String(next.id || next.key) });
      }
    },
    removeContent(state, action: { payload: string }) {
      const id = String(action.payload);
      state.items = state.items.filter((c) => String(c.id) !== id);
    },
    resetContent() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensureContent.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureContent.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureContent.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load content.";
      });
  },
});

export const { invalidateContent, upsertContent, removeContent, resetContent } =
  contentSlice.actions;
export default contentSlice.reducer;
