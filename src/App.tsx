import { useEffect } from "react";
import { Provider } from "react-redux";
import { Redirect, Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspaceModeProvider } from "@/contexts/WorkspaceModeContext";
import { store } from "@/store";
import { useAppDispatch } from "@/store/hooks";
import { ensureRegions } from "@/store/slices/regionsSlice";
import { AdminShell } from "@/components/admin/AdminShell";
import { LoginPage } from "@/pages/Login";
import { ForgotPasswordPage } from "@/pages/ForgotPassword";
import { ResetPasswordPage } from "@/pages/ResetPassword";
import { AcceptInviteResetPasswordPage } from "@/pages/AcceptInviteResetPassword";
import { InvestorInviteResetPasswordPage } from "@/pages/InvestorInviteResetPassword";
import { DashboardPage } from "@/pages/Dashboard";
import { InvestorsPage } from "@/pages/Investors";
import { InvestorDetailPage } from "@/pages/InvestorDetail";
import { InviteInvestorPage } from "@/pages/InviteInvestor";
import { InvestorNewPage } from "@/pages/InvestorNew";
import { PropertiesPage } from "@/pages/Properties";
import { PropertyFormPage } from "@/pages/PropertyForm";
import { PriceHistoryPage } from "@/pages/PriceHistory";
import { PriceHistoryDetailPage } from "@/pages/PriceHistoryDetail";
import { DevelopmentsPage } from "@/pages/Developments";
import { DevelopmentFormPage } from "@/pages/DevelopmentForm";
import { EnquiriesPage } from "@/pages/Enquiries";
import { SignalsPage } from "@/pages/Signals";
import { AssumptionsPage } from "@/pages/Assumptions";
import { JourneyCalculatorPage } from "@/pages/JourneyCalculator";
import { JourneyCalculator2Page } from "@/pages/JourneyCalculator2";
import { PaymentsPage } from "@/pages/Payments";
import { ContentPage } from "@/pages/Content";
import { ContentFormPage } from "@/pages/ContentForm";
import { ContentPreviewPage } from "@/pages/ContentPreview";
import { UsersPage } from "@/pages/Users";
import { ActivityPage } from "@/pages/Activity";
import { SettingsPage } from "@/pages/Settings";
import { ComingSoonPage } from "@/pages/ComingSoon";
import { WhatsAppOverviewPage } from "@/pages/whatsapp/Overview";
import { WhatsAppLeadsPage } from "@/pages/whatsapp/Leads";
import { WhatsAppLeadDetailPage } from "@/pages/whatsapp/LeadDetail";
import { WhatsAppWebinarsPage } from "@/pages/whatsapp/Webinars";
import {
  WhatsAppWebinarDetailPage,
  WhatsAppWebinarNewPage,
} from "@/pages/whatsapp/WebinarDetail";
import { WhatsAppDataPage } from "@/pages/whatsapp/Data";

/** Load Land Registry regions once at app start into Redux. */
function RegionsBootstrap() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    void dispatch(ensureRegions());
  }, [dispatch]);
  return null;
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  if (!user || !token) return <Redirect to="/login" />;
  return <AdminShell>{children}</AdminShell>;
}


function Routes() {
  const { user, token } = useAuth();
  const signedIn = Boolean(user && token);

  return (
    <Switch>
      <Route path="/login">
        {signedIn ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route path="/forgot-password">
        {signedIn ? <Redirect to="/" /> : <ForgotPasswordPage />}
      </Route>
      <Route path="/reset-password">
        {signedIn ? <Redirect to="/" /> : <ResetPasswordPage />}
      </Route>
      <Route path="/accept-invite">
        {signedIn ? <Redirect to="/" /> : <AcceptInviteResetPasswordPage />}
      </Route>
      <Route path="/investor/invite">
        {signedIn ? <Redirect to="/" /> : <InvestorInviteResetPasswordPage />}
      </Route>
      <Route path="/">
        <Protected>
          <DashboardPage />
        </Protected>
      </Route>
      <Route path="/investors">
        <Protected>
          <InvestorsPage />
        </Protected>
      </Route>
      <Route path="/investors/invite">
        <Protected>
          <InviteInvestorPage />
        </Protected>
      </Route>
      <Route path="/investors/new">
        <Protected>
          <InvestorNewPage />
        </Protected>
      </Route>
      <Route path="/investors/:id">
        <Protected>
          <InvestorDetailPage />
        </Protected>
      </Route>
      <Route path="/properties">
        <Protected>
          <PropertiesPage />
        </Protected>
      </Route>
      <Route path="/properties/price-history/:id">
        <Protected>
          <PriceHistoryDetailPage />
        </Protected>
      </Route>
      <Route path="/properties/price-history">
        <Protected>
          <PriceHistoryPage />
        </Protected>
      </Route>
      <Route path="/properties/new">
        <Protected>
          <PropertyFormPage />
        </Protected>
      </Route>
      <Route path="/properties/:id">
        <Protected>
          <PropertyFormPage />
        </Protected>
      </Route>
      <Route path="/developments">
        <Protected>
          <DevelopmentsPage />
        </Protected>
      </Route>
      <Route path="/developments/new">
        <Protected>
          <DevelopmentFormPage />
        </Protected>
      </Route>
      <Route path="/developments/:id">
        <Protected>
          <DevelopmentFormPage />
        </Protected>
      </Route>
      <Route path="/enquiries">
        <Protected>
          <EnquiriesPage />
        </Protected>
      </Route>
      <Route path="/signals">
        <Protected>
          <SignalsPage />
        </Protected>
      </Route>
      <Route path="/assumptions">
        <Protected>
          <AssumptionsPage />
        </Protected>
      </Route>
      <Route path="/calculator">
        <Protected>
          <JourneyCalculator2Page />
        </Protected>
      </Route>
      <Route path="/calculator-old">
        <Protected>
          <JourneyCalculatorPage />
        </Protected>
      </Route>
      <Route path="/calculator-2">
        <Redirect to="/calculator" />
      </Route>
      <Route path="/payments">
        <Protected>
          <PaymentsPage />
        </Protected>
      </Route>
      <Route path="/documents">
        <Redirect to="/investors" />
      </Route>
      <Route path="/content/new">
        <Protected>
          <ContentFormPage />
        </Protected>
      </Route>
      <Route path="/content/:id/preview">
        <Protected>
          <ContentPreviewPage />
        </Protected>
      </Route>
      <Route path="/content/:id">
        <Protected>
          <ContentFormPage />
        </Protected>
      </Route>
      <Route path="/content">
        <Protected>
          <ContentPage />
        </Protected>
      </Route>
      <Route path="/coming-soon">
        <Protected>
          <ComingSoonPage />
        </Protected>
      </Route>
      <Route path="/users">
        <Protected>
          <UsersPage />
        </Protected>
      </Route>
      <Route path="/activity">
        <Protected>
          <ActivityPage />
        </Protected>
      </Route>
      <Route path="/settings">
        <Protected>
          <SettingsPage />
        </Protected>
      </Route>
      <Route path="/whatsapp">
        <Protected>
          <WhatsAppOverviewPage />
        </Protected>
      </Route>
      <Route path="/whatsapp/leads">
        <Protected>
          <WhatsAppLeadsPage />
        </Protected>
      </Route>
      <Route path="/whatsapp/leads/:id">
        <Protected>
          <WhatsAppLeadDetailPage />
        </Protected>
      </Route>
      <Route path="/whatsapp/webinars/new">
        <Protected>
          <WhatsAppWebinarNewPage />
        </Protected>
      </Route>
      <Route path="/whatsapp/webinars/:id">
        <Protected>
          <WhatsAppWebinarDetailPage />
        </Protected>
      </Route>
      <Route path="/whatsapp/webinars">
        <Protected>
          <WhatsAppWebinarsPage />
        </Protected>
      </Route>
      <Route path="/whatsapp/data">
        <Protected>
          <WhatsAppDataPage />
        </Protected>
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <RegionsBootstrap />
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceModeProvider>
            <TooltipProvider>
              <Routes />
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </WorkspaceModeProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}
