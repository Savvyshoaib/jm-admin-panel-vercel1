import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { ApiError } from "@/lib/apiClient";
import {
  fetchDefaultCalculatorFlow,
  mockCalculatorFlow,
  putCalculatorFlow,
  putDefaultCalculatorFlow,
  type CalculatorFlowRecord,
} from "@/services/calculatorFlowsApi";
import {
  logout,
  loginThunk,
  sessionScopeChanged,
} from "@/store/slices/authSlice";

type Status = "idle" | "loading" | "saving" | "succeeded" | "failed";

type CalculatorFlowState = {
  flow: CalculatorFlowRecord | null;
  status: Status;
  error: string | null;
  fetchedAt: number | null;
  invalidated: boolean;
};

const initialState: CalculatorFlowState = {
  flow: null,
  status: "idle",
  error: null,
  fetchedAt: null,
  invalidated: true,
};

export const ensureCalculatorFlow = createAsyncThunk<
  CalculatorFlowRecord,
  { force?: boolean } | undefined,
  { state: { calculatorFlow: CalculatorFlowState }; rejectValue: string }
>(
  "calculatorFlow/ensure",
  async (_arg, { rejectWithValue }) => {
    try {
      return await fetchDefaultCalculatorFlow();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to load calculator flow.";
      return rejectWithValue(message);
    }
  },
  {
    condition: (arg, { getState }) => {
      const force = arg?.force ?? false;
      if (force) return true;
      const current = getState().calculatorFlow;
      if (current.status === "loading" || current.status === "saving") {
        return false;
      }
      if (!current.invalidated && current.flow && current.fetchedAt) {
        return false;
      }
      return true;
    },
  },
);

export const saveCalculatorFlow = createAsyncThunk<
  CalculatorFlowRecord,
  CalculatorFlowRecord,
  { rejectValue: string }
>("calculatorFlow/save", async (flow, { rejectWithValue }) => {
  try {
    if (
      flow.id != null &&
      String(flow.id) !== "default" &&
      String(flow.id) !== "mock-default" &&
      !flow.isDefault
    ) {
      return await putCalculatorFlow(flow.id, flow);
    }
    return await putDefaultCalculatorFlow(flow);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      return rejectWithValue("Session expired. Sign in again, then save.");
    }
    const message =
      err instanceof ApiError
        ? err.message
        : "Unable to save calculator flow.";
    return rejectWithValue(message);
  }
});

const calculatorFlowSlice = createSlice({
  name: "calculatorFlow",
  initialState,
  reducers: {
    invalidateCalculatorFlow(state) {
      state.invalidated = true;
    },
    resetCalculatorFlow() {
      return initialState;
    },
    patchCalculatorFlowLocal(
      state,
      action: { payload: Partial<CalculatorFlowRecord> },
    ) {
      if (!state.flow) {
        state.flow = { ...mockCalculatorFlow(), ...action.payload };
        return;
      }
      state.flow = { ...state.flow, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(loginThunk.fulfilled, () => initialState)
      .addCase(sessionScopeChanged, () => initialState)
      .addCase(ensureCalculatorFlow.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(ensureCalculatorFlow.fulfilled, (state, action) => {
        state.flow = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(ensureCalculatorFlow.rejected, (state, action) => {
        if (action.meta.condition) return;
        state.status = "failed";
        state.error = action.payload ?? "Unable to load calculator flow.";
      })
      .addCase(saveCalculatorFlow.pending, (state) => {
        state.status = "saving";
        state.error = null;
      })
      .addCase(saveCalculatorFlow.fulfilled, (state, action) => {
        state.flow = action.payload;
        state.status = "succeeded";
        state.error = null;
        state.fetchedAt = Date.now();
        state.invalidated = false;
      })
      .addCase(saveCalculatorFlow.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Unable to save calculator flow.";
      });
  },
});

export const {
  invalidateCalculatorFlow,
  resetCalculatorFlow,
  patchCalculatorFlowLocal,
} = calculatorFlowSlice.actions;

export default calculatorFlowSlice.reducer;
