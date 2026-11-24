import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { Enquiry } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { listEnquiries } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  DEFAULT_LIST_TTL_MS,
  emptyCachedList,
  isCacheFresh,
  isFetchInFlight,
  type CachedListState,
} from "@/store/cachePolicy";

type EnquiriesState = CachedListState<Enquiry>;

const initialState: EnquiriesState = emptyCachedList();

export const ensureEnquiries = createAsyncThunk<
  Enquiry[],
  { force?: boolean } | undefined,
  { state: { enquiries: EnquiriesState }; rejectValue: string }
>(
  "enquiries/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await listEnquiries();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load enquiries.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().enquiries;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, DEFAULT_LIST_TTL_MS, current.invalidated);
    },
  },
);

const enquiriesSlice = createSlice({
  name: "enquiries",
  initialState,
  reducers: {
    invalidateEnquiries(state) {
      state.invalidated = true;
    },
    upsertEnquiry(state, action: { payload: Enquiry }) {
      const next = action.payload;
      if (!next?.id) return;
      const idx = state.items.findIndex((e) => String(e.id) === String(next.id));
      if (idx >= 0) {
        state.items[idx] = { ...state.items[idx], ...next, id: String(next.id) };
      } else {
        state.items.unshift({ ...next, id: String(next.id) });
      }
    },
    removeEnquiryLocal(state, action: { payload: string }) {
      state.items = state.items.filter(
        (e) => String(e.id) !== String(action.payload),
      );
    },
    resetEnquiries() {
      return emptyCachedList();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => emptyCachedList())
      .addCase(loginThunk.fulfilled, () => emptyCachedList())
      .addCase(sessionScopeChanged, () => emptyCachedList())
      .addCase(ensureEnquiries.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureEnquiries.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureEnquiries.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load enquiries.";
      });
  },
});

export const {
  invalidateEnquiries,
  upsertEnquiry,
  removeEnquiryLocal,
  resetEnquiries,
} = enquiriesSlice.actions;
export default enquiriesSlice.reducer;
