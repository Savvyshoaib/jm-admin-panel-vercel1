import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { InternalUser } from "@/models";
import { ApiError, isApiConfigured } from "@/lib/apiClient";
import {
  fetchMeRequest,
  forgotPasswordRequest,
  loginRequest,
  logoutRequest,
  resetPasswordRequest,
} from "@/services/authApi";
import { USE_MOCK_DATA } from "@/services/mockFlags";
import {
  SHORT_TTL_MS,
  isCacheFresh,
  type LoadStatus,
} from "@/store/cachePolicy";

export const SESSION_KEY = "jm-admin-session";
export const RESET_EMAIL_KEY = "jm-reset-email";
export const RESET_TOKEN_KEY = "jm-reset-token";

export type AuthSession = {
  user: InternalUser;
  token: string | null;
};

type AuthState = {
  user: InternalUser | null;
  token: string | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
  /** Last successful GET /admin/auth/me */
  meFetchedAt: number | null;
  meStatus: LoadStatus;
  meError: string | null;
  /** Transient forgot-password request state (not persisted). */
  forgot: {
    status: LoadStatus;
    error: string | null;
    message: string | null;
    lastEmail: string | null;
  };
  /** Transient reset-password request state (not persisted). */
  reset: {
    status: LoadStatus;
    error: string | null;
    message: string | null;
  };
};

function readStoredSession(): Pick<AuthState, "user" | "token"> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.user || !parsed?.token) return { user: null, token: null };
    return { user: parsed.user, token: parsed.token };
  } catch {
    return { user: null, token: null };
  }
}

function persistSession(session: AuthSession | null) {
  try {
    if (!session?.token) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

/**
 * Clear obsolete session keys only.
 * Do NOT wipe mock inventory / investors — those persist in localStorage for FE testing.
 */
function clearLegacyMockStorage() {
  try {
    localStorage.removeItem("jm-admin-mock-db-v2");
    localStorage.removeItem("jm-admin-session-user");
    // Older mock stores. v3 is the current demo seed.
    localStorage.removeItem("jm-admin-mock-inventory-v1");
    localStorage.removeItem("jm-admin-mock-investors-v1");
    localStorage.removeItem("jm-admin-mock-ops-v1");
    localStorage.removeItem("jm-admin-mock-inventory-v2");
    localStorage.removeItem("jm-admin-mock-investors-v2");
    localStorage.removeItem("jm-admin-mock-ops-v2");
  } catch {
    /* ignore */
  }
}

/** Role / status / assignments — when these change, resource caches must refresh. */
export function authScopeKey(user: InternalUser | null): string {
  if (!user) return "";
  const assigned = [...user.assignedInvestorIds].map(String).sort().join(",");
  return `${user.id}|${user.role}|${user.status}|${assigned}`;
}

clearLegacyMockStorage();

const stored = readStoredSession();

const initialState: AuthState = {
  user: stored.user,
  token: stored.token,
  status: stored.user && stored.token ? "authenticated" : "idle",
  error: null,
  meFetchedAt: null,
  meStatus: "idle",
  meError: null,
  forgot: {
    status: "idle",
    error: null,
    message: null,
    lastEmail: null,
  },
  reset: {
    status: "idle",
    error: null,
    message: null,
  },
};

export const loginThunk = createAsyncThunk<
  AuthSession & { message: string },
  { email: string; password: string },
  { rejectValue: string }
>("auth/login", async ({ email, password }, { rejectWithValue }) => {
  if (!USE_MOCK_DATA && !isApiConfigured()) {
    return rejectWithValue(
      "API is not configured. Set VITE_API_BASE_URL in your environment.",
    );
  }
  try {
    const result = await loginRequest(email.trim(), password);
    return { user: result.user, token: result.token, message: result.message };
  } catch (err) {
    const message =
      err instanceof ApiError ? err.message : "Unable to sign in. Please try again.";
    return rejectWithValue(message);
  }
});

/**
 * Explicit sign-out: POST /admin/auth/logout while token is valid, then clear local session.
 * Local clear always runs (API failure must not trap the user).
 * Use sync `logout` for dead sessions (401 / inactive) where the server call is pointless.
 */
export const logoutThunk = createAsyncThunk<void, void, { state: { auth: AuthState } }>(
  "auth/logoutRemote",
  async (_arg, { getState, dispatch }) => {
    const token = getState().auth.token;
    if (token && (USE_MOCK_DATA || isApiConfigured())) {
      try {
        await logoutRequest();
      } catch {
        /* ignore — still clear client session */
      }
    }
    dispatch(logout());
  },
);

/**
 * Revalidate session from GET /admin/auth/me.
 * Updates Redux user (and persisted session). On 401/403 or inactive → logout.
 * When role/status/assignments change → dispatches sessionScopeChanged for caches.
 */
export const ensureMe = createAsyncThunk<
  { user: InternalUser; scopeChanged: boolean },
  { force?: boolean } | undefined,
  {
    state: { auth: AuthState };
    rejectValue: string;
    dispatch: (action: unknown) => unknown;
  }
>(
  "auth/ensureMe",
  async (_arg, { getState, dispatch, rejectWithValue }) => {
    if (!USE_MOCK_DATA && !isApiConfigured()) {
      return rejectWithValue(
        "API is not configured. Set VITE_API_BASE_URL in your environment.",
      );
    }
    const prev = getState().auth.user;
    try {
      const { user } = await fetchMeRequest();
      if (user.status === "inactive") {
        dispatch(logout());
        return rejectWithValue("Your account is inactive.");
      }
      const scopeChanged = authScopeKey(prev) !== authScopeKey(user);
      if (scopeChanged) {
        dispatch(sessionScopeChanged());
      }
      return { user, scopeChanged };
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        dispatch(logout());
        return rejectWithValue(err.message || "Session expired.");
      }
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to refresh session.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const { token, meFetchedAt, meStatus } = getState().auth;
      if (!token) return false;
      if (arg?.force) return true;
      if (meStatus === "loading") return false;
      return !isCacheFresh(meFetchedAt, SHORT_TTL_MS);
    },
  },
);

export const forgotPasswordThunk = createAsyncThunk<
  { email: string; message: string },
  { email: string },
  { rejectValue: string }
>("auth/forgotPassword", async ({ email }, { rejectWithValue }) => {
  if (!USE_MOCK_DATA && !isApiConfigured()) {
    return rejectWithValue(
      "API is not configured. Set VITE_API_BASE_URL in your environment.",
    );
  }
  try {
    const normalised = email.trim();
    const result = await forgotPasswordRequest(normalised);
    try {
      sessionStorage.setItem(RESET_EMAIL_KEY, normalised);
      if (result.resetToken) {
        sessionStorage.setItem(RESET_TOKEN_KEY, result.resetToken);
      } else {
        sessionStorage.removeItem(RESET_TOKEN_KEY);
      }
    } catch {
      /* ignore */
    }
    return { email: normalised, message: result.message };
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.message
        : "Unable to send reset link. Please try again.";
    return rejectWithValue(message);
  }
});

export const resetPasswordThunk = createAsyncThunk<
  { message: string },
  { email: string; token: string; password: string; passwordConfirmation: string },
  { rejectValue: string }
>("auth/resetPassword", async (input, { rejectWithValue }) => {
  if (!USE_MOCK_DATA && !isApiConfigured()) {
    return rejectWithValue(
      "API is not configured. Set VITE_API_BASE_URL in your environment.",
    );
  }
  try {
    const result = await resetPasswordRequest({
      email: input.email.trim(),
      token: input.token.trim(),
      password: input.password,
      passwordConfirmation: input.passwordConfirmation,
    });
    try {
      sessionStorage.removeItem(RESET_EMAIL_KEY);
      sessionStorage.removeItem(RESET_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    return { message: result.message };
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.message
        : "Unable to reset password. Please try again.";
    return rejectWithValue(message);
  }
});

export function readResetContext(): { email: string | null; token: string | null } {
  try {
    return {
      email: sessionStorage.getItem(RESET_EMAIL_KEY),
      token: sessionStorage.getItem(RESET_TOKEN_KEY),
    };
  } catch {
    return { email: null, token: null };
  }
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<AuthSession>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.status = "authenticated";
      state.error = null;
      persistSession(action.payload);
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.status = "idle";
      state.error = null;
      state.meFetchedAt = null;
      state.meStatus = "idle";
      state.meError = null;
      persistSession(null);
    },
    /**
     * Fired when /me reports a different role, status, or assigned investors.
     * Resource slices clear so the app refetches under the new scope.
     */
    sessionScopeChanged() {
      /* marker action — handled by resource slices */
    },
    clearAuthError(state) {
      state.error = null;
    },
    clearForgotState(state) {
      state.forgot = {
        status: "idle",
        error: null,
        message: null,
        lastEmail: null,
      };
    },
    clearResetState(state) {
      state.reset = {
        status: "idle",
        error: null,
        message: null,
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.status = "authenticated";
        state.error = null;
        state.meFetchedAt = Date.now();
        state.meStatus = "succeeded";
        state.meError = null;
        persistSession({ user: action.payload.user, token: action.payload.token });
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload ?? "Sign in failed";
        state.user = null;
        state.token = null;
        state.meFetchedAt = null;
        state.meStatus = "idle";
        state.meError = null;
        persistSession(null);
      })
      .addCase(ensureMe.pending, (state) => {
        state.meStatus = "loading";
        state.meError = null;
      })
      .addCase(ensureMe.fulfilled, (state, action) => {
        const token = state.token;
        state.user = action.payload.user;
        state.status = "authenticated";
        state.meStatus = "succeeded";
        state.meError = null;
        state.meFetchedAt = Date.now();
        if (token) {
          persistSession({ user: action.payload.user, token });
        }
      })
      .addCase(ensureMe.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.meStatus = "failed";
        state.meError = action.payload ?? "Unable to refresh session.";
        // Soft fail keeps cached user/token unless logout already cleared them.
      })
      .addCase(forgotPasswordThunk.pending, (state) => {
        state.forgot.status = "loading";
        state.forgot.error = null;
        state.forgot.message = null;
      })
      .addCase(forgotPasswordThunk.fulfilled, (state, action) => {
        state.forgot.status = "succeeded";
        state.forgot.error = null;
        state.forgot.message = action.payload.message;
        state.forgot.lastEmail = action.payload.email;
      })
      .addCase(forgotPasswordThunk.rejected, (state, action) => {
        state.forgot.status = "failed";
        state.forgot.error = action.payload ?? "Unable to send reset link.";
        state.forgot.message = null;
      })
      .addCase(resetPasswordThunk.pending, (state) => {
        state.reset.status = "loading";
        state.reset.error = null;
        state.reset.message = null;
      })
      .addCase(resetPasswordThunk.fulfilled, (state, action) => {
        state.reset.status = "succeeded";
        state.reset.error = null;
        state.reset.message = action.payload.message;
      })
      .addCase(resetPasswordThunk.rejected, (state, action) => {
        state.reset.status = "failed";
        state.reset.error = action.payload ?? "Unable to reset password.";
        state.reset.message = null;
      });
  },
});

export const {
  setCredentials,
  logout,
  sessionScopeChanged,
  clearAuthError,
  clearForgotState,
  clearResetState,
} = authSlice.actions;
export default authSlice.reducer;
