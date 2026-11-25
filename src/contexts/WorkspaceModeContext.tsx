import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type WorkspaceMode = "admin" | "whatsapp";

const STORAGE_KEY = "jm-workspace-mode";

type WorkspaceModeContextValue = {
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
};

const WorkspaceModeContext = createContext<WorkspaceModeContextValue | null>(null);

function readStoredMode(): WorkspaceMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "whatsapp" || raw === "admin") return raw;
  } catch {
    /* ignore */
  }
  return "admin";
}

export function WorkspaceModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<WorkspaceMode>(readStoredMode);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const setMode = useCallback((next: WorkspaceMode) => {
    setModeState(next);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <WorkspaceModeContext.Provider value={value}>
      {children}
    </WorkspaceModeContext.Provider>
  );
}

export function useWorkspaceMode(): WorkspaceModeContextValue {
  const ctx = useContext(WorkspaceModeContext);
  if (!ctx) {
    throw new Error("useWorkspaceMode must be used within WorkspaceModeProvider");
  }
  return ctx;
}
