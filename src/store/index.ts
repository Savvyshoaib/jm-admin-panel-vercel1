import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import agentsReducer from "./slices/agentsSlice";
import enquiriesReducer from "./slices/enquiriesSlice";
import contentReducer from "./slices/contentSlice";
import assumptionsReducer from "./slices/assumptionsSlice";
import activityLogReducer from "./slices/activitySlice";
import settingsReducer from "./slices/settingsSlice";
import investorsReducer from "./slices/investorsSlice";
import propertiesReducer from "./slices/propertiesSlice";
import developmentsReducer from "./slices/developmentsSlice";
import usersReducer from "./slices/usersSlice";
import paymentsReducer from "./slices/paymentsSlice";
import dashboardReducer from "./slices/dashboardSlice";
import signalsReducer from "./slices/signalsSlice";
import regionsReducer from "./slices/regionsSlice";
import calculatorFlowReducer from "./slices/calculatorFlowSlice";
import { setAuthTokenGetter } from "@/lib/apiClient";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    agents: agentsReducer,
    enquiries: enquiriesReducer,
    content: contentReducer,
    assumptions: assumptionsReducer,
    activityLog: activityLogReducer,
    settings: settingsReducer,
    investors: investorsReducer,
    properties: propertiesReducer,
    developments: developmentsReducer,
    users: usersReducer,
    payments: paymentsReducer,
    dashboard: dashboardReducer,
    signals: signalsReducer,
    regions: regionsReducer,
    calculatorFlow: calculatorFlowReducer,
  },
});

setAuthTokenGetter(() => store.getState().auth.token);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
