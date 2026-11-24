import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PlatformSettings } from "@/models";
import { ApiError } from "@/lib/apiClient";
import { getSettings } from "@/services/api";
import { logout, loginThunk, sessionScopeChanged } from "@/store/slices/authSlice";
import {
  LONG_TTL_MS,
  isCacheFresh,
  isFetchInFlight,
  type LoadStatus,
} from "@/store/cachePolicy";

type SettingsState = {
  data: PlatformSettings | null;
  status: LoadStatus;
  error: string | null;
  fetchedAt: number | null;
  invalidated: boolean;
};

const initialState: SettingsState = {
  data: null,
  status: "idle",
  error: null,
  fetchedAt: null,
  invalidated: true,
};

export const ensureSettings = createAsyncThunk<
  PlatformSettings,
  { force?: boolean } | undefined,
  { state: { settings: SettingsState }; rejectValue: string }
>(
  "settings/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await getSettings();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Unable to load settings.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().settings;
      if (isFetchInFlight(current)) return false;
      return !isCacheFresh(current.fetchedAt, LONG_TTL_MS, current.invalidated);
    },
  },
);

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    invalidateSettings(state) {
      state.invalidated = true;
    },
    setSettings(state, action: { payload: PlatformSettings }) {
      state.data = action.payload;
      state.status = "succeeded";
      state.error = null;
      state.fetchedAt = Date.now();
      state.invalidated = false;
    },
    resetSettings() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(loginThunk.fulfilled, () => initialState)
      .addCase(sessionScopeChanged, () => initialState)
      .addCase(ensureSettings.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureSettings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureSettings.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load settings.";
      });
  },
});

export const { invalidateSettings, setSettings, resetSettings } =
  settingsSlice.actions;
export default settingsSlice.reducer;
