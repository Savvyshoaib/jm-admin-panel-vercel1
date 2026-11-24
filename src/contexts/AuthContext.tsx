import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { InternalUser, Role } from "@/models";
import { can, canAccessNav, canMutate, type Action, type Resource } from "@/permissions/can";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { isThunkConditionError } from "@/store/thunkUtils";
import {
  clearAuthError,
  clearForgotState,
  clearResetState,
  ensureMe,
  forgotPasswordThunk,
  loginThunk,
  logoutThunk,
  resetPasswordThunk,
} from "@/store/slices/authSlice";

type AuthContextValue = {
  user: InternalUser | null;
  token: string | null;
  authStatus: "idle" | "loading" | "authenticated" | "error";
  loginWithCredentials: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  requestPasswordReset: (
    email: string,
  ) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  resetPassword: (input: {
    email: string;
    token: string;
    password: string;
    passwordConfirmation: string;
  }) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  refreshSession: (opts?: { force?: boolean }) => Promise<void>;
  can: (action: Action, resource: Resource) => boolean;
  canAccessNav: (resource: Resource) => boolean;
  canMutate: (resource: Resource) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.token);
  const authStatus = useAppSelector((s) => s.auth.status);

  const refreshSession = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!token) return;
      try {
        await dispatch(ensureMe(opts)).unwrap();
      } catch (err: unknown) {
        if (isThunkConditionError(err)) return;
        // Soft network failures keep the cached session; 401 already logged out.
      }
    },
    [dispatch, token],
  );

  // Boot + keep session live from GET /admin/auth/me
  useEffect(() => {
    if (!token) return;
    void refreshSession({ force: true });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps -- boot once per token

  useEffect(() => {
    if (!token) return;

    const onFocus = () => {
      void refreshSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token, refreshSession]);

  const loginWithCredentials = useCallback(
    async (email: string, password: string) => {
      dispatch(clearAuthError());
      const result = await dispatch(loginThunk({ email, password }));
      if (loginThunk.fulfilled.match(result)) {
        return {
          ok: true as const,
          message: result.payload.message || "Login successful.",
        };
      }
      const error =
        typeof result.payload === "string"
          ? result.payload
          : "Unable to sign in. Please try again.";
      return { ok: false as const, error };
    },
    [dispatch],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      dispatch(clearForgotState());
      const result = await dispatch(forgotPasswordThunk({ email }));
      if (forgotPasswordThunk.fulfilled.match(result)) {
        return { ok: true as const, message: result.payload.message };
      }
      const error =
        typeof result.payload === "string"
          ? result.payload
          : "Unable to send reset link. Please try again.";
      return { ok: false as const, error };
    },
    [dispatch],
  );

  const resetPassword = useCallback(
    async (input: {
      email: string;
      token: string;
      password: string;
      passwordConfirmation: string;
    }) => {
      dispatch(clearResetState());
      const result = await dispatch(resetPasswordThunk(input));
      if (resetPasswordThunk.fulfilled.match(result)) {
        return { ok: true as const, message: result.payload.message };
      }
      const error =
        typeof result.payload === "string"
          ? result.payload
          : "Unable to reset password. Please try again.";
      return { ok: false as const, error };
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    await dispatch(logoutThunk());
  }, [dispatch]);

  const value = useMemo<AuthContextValue>(() => {
    const role: Role = user?.role ?? "viewer";
    return {
      user,
      token,
      authStatus,
      loginWithCredentials,
      requestPasswordReset,
      resetPassword,
      logout,
      refreshSession,
      can: (action, resource) => (user ? can(role, action, resource) : false),
      canAccessNav: (resource) => (user ? canAccessNav(role, resource) : false),
      canMutate: (resource) => (user ? canMutate(role, resource) : false),
    };
  }, [
    user,
    token,
    authStatus,
    loginWithCredentials,
    requestPasswordReset,
    resetPassword,
    logout,
    refreshSession,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
