import React from "react";
import { AppProvider, useApp } from "./api/AppContext";
import { ADMIN_VIEWS, BUSINESS_VIEWS, CUSTOMER_VIEWS, WORKER_VIEWS, canAccessView, isBusiness, roleHome } from "./api/roles";
import AppShell, { shellVariant } from "./components/AppShell";
import ProfilePrompt from "./components/ProfilePrompt";
import { LangProvider, useLang } from "./i18n/LangContext";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import BusinessLanding from "./pages/BusinessLanding";
import CustomerHome from "./pages/customer/CustomerHome";
import CreateRequest from "./pages/customer/CreateRequest";
import FindingSolutions from "./pages/customer/FindingSolutions";
import MatchedProviders from "./pages/customer/MatchedProviders";
import ProviderDetails from "./pages/customer/ProviderDetails";
import RequestStatus from "./pages/customer/RequestStatus";
import MyRequests from "./pages/customer/MyRequests";
import CustomerMessages from "./pages/customer/CustomerMessages";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerNotifications from "./pages/customer/CustomerNotifications";
import BusinessOnboarding from "./pages/business/BusinessOnboarding";
import BusinessDashboard from "./pages/business/BusinessDashboard";
import WorkRequests from "./pages/business/WorkRequests";
import MyJobs from "./pages/business/MyJobs";
import BusinessCalendar from "./pages/business/BusinessCalendar";
import Reviews from "./pages/business/Reviews";
import Earnings from "./pages/business/Earnings";
import BusinessProfile from "./pages/business/BusinessProfile";
import BusinessMessages from "./pages/business/BusinessMessages";
import BusinessNotifications from "./pages/business/BusinessNotifications";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminPortal from "./pages/admin/AdminPortal";
import {
  CustomerBookings,
  CustomerReviewsPage,
  ProviderServices,
} from "./pages/shared/SimplePages";
import { FavoritesPage, LicensePage, LiveAnalytics, LiveWallet, SupportPage } from "./pages/shared/AccountModules";
import AccountSettings from "./pages/shared/AccountSettings";
import AiRecommend from "./pages/shared/AiRecommend";
import TeamPage from "./pages/business/TeamPage";
import ActiveJob from "./pages/shared/ActiveJob";
import WorkerTarget from "./pages/worker/WorkerTarget";
import WorkerNextJobs from "./pages/worker/WorkerNextJobs";
import WorkerCrews from "./pages/worker/WorkerCrews";
import WorkerPassport from "./pages/worker/WorkerPassport";
import WorkerSafety from "./pages/worker/WorkerSafety";
import PublicPassport from "./pages/worker/PublicPassport";
import FamilyWatch from "./pages/shared/FamilyWatch";
import FindCrew from "./pages/customer/FindCrew";
import PublicWorkerProfile from "./pages/PublicWorkerProfile";

class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 max-w-lg">
          <h1 className="text-xl font-bold font-display text-slate-900">This page could not load</h1>
          <p className="text-sm text-slate-500 mt-2">Stay here and try another menu item, or refresh.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell() {
  const { view, navigate, user, ready, selectedProvider, setSelectedProvider, requestData, setRequestData, logout } =
    useApp();
  const { setLang } = useLang();

  React.useEffect(() => {
    if (user?.lang === "ta" || user?.lang === "hi") setLang(user.lang);
  }, [user?.lang, setLang]);

  React.useEffect(() => {
    if (!ready) return;
    if (!canAccessView(user, view)) navigate(user ? roleHome(user) : "login");
  }, [ready, user, view, navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand text-white font-bold flex items-center justify-center mx-auto mb-3 font-display">F</div>
          <p className="text-slate-500 text-sm">Loading FixBuddy…</p>
        </div>
      </div>
    );
  }

  if (view === "landing") return <Landing navigate={navigate} />;
  if (view === "login") return <Auth mode="login" navigate={navigate} />;
  if (view === "signup") return <Auth mode="signup" navigate={navigate} />;
  if (view === "admin-login") return <AdminLogin navigate={navigate} />;
  if (view === "business-landing") return <BusinessLanding navigate={navigate} />;
  if (view === "public-passport") return <PublicPassport navigate={navigate} />;
  if (view === "family-watch") return <FamilyWatch navigate={navigate} />;
  if (view === "business-onboarding") return <BusinessOnboarding navigate={navigate} />;
  if (view === "finding-solutions" && (user?.role === "customer" || isBusiness(user?.role) || user?.role === "admin")) return <FindingSolutions navigate={navigate} />;
  if (view === "create-request" && (user?.role === "customer" || isBusiness(user?.role) || user?.role === "admin")) {
    return (
      <CreateRequest
        navigate={navigate}
        onRequestData={(d) => setRequestData({ ...requestData, ...d })}
        requestData={requestData}
      />
    );
  }

  const wrap = (child: React.ReactNode) => (
    <AppShell variant={shellVariant(user)} navigate={navigate} currentView={view} user={user} onLogout={logout}>
      <RouteErrorBoundary key={view}>{child}</RouteErrorBoundary>
      {user && !user.profileAsked && user.role !== "admin" ? <ProfilePrompt /> : null}
    </AppShell>
  );

  if (ADMIN_VIEWS.includes(view) && user?.role === "admin") {
    return wrap(<AdminPortal view={view} embedded />);
  }

  if (CUSTOMER_VIEWS.includes(view) && user?.role === "customer") {
    return wrap(
      <>
        {view === "customer-home" && <CustomerHome navigate={navigate} />}
        {view === "active-job" && <ActiveJob navigate={navigate} />}
        {view === "matched-providers" && <MatchedProviders navigate={navigate} onSelectProvider={setSelectedProvider} />}
        {view === "provider-details" && <ProviderDetails navigate={navigate} provider={selectedProvider} />}
        {view === "request-status" && <RequestStatus navigate={navigate} />}
        {view === "my-requests" && <MyRequests navigate={navigate} />}
        {view === "customer-bookings" && <CustomerBookings navigate={navigate} />}
        {view === "customer-messages" && <CustomerMessages navigate={navigate} />}
        {view === "customer-reviews" && <CustomerReviewsPage />}
        {view === "customer-wallet" && <LiveWallet />}
        {view === "customer-license" && <LicensePage />}
        {view === "customer-support" && <SupportPage />}
        {view === "customer-favorites" && <FavoritesPage />}
        {view === "customer-profile" && <CustomerProfile navigate={navigate} />}
        {view === "customer-settings" && <AccountSettings />}
        {view === "customer-notifications" && <CustomerNotifications navigate={navigate} />}
        {view === "ai-recommend" && <AiRecommend />}
        {view === "find-crew" && <FindCrew navigate={navigate} />}
      </>
    );
  }

  if (WORKER_VIEWS.includes(view) && user?.role === "worker") {
    return wrap(
      <>
        {view === "business-dashboard" && <BusinessDashboard navigate={navigate} />}
        {view === "active-job" && <ActiveJob navigate={navigate} />}
        {view === "work-requests" && <WorkRequests navigate={navigate} />}
        {view === "my-jobs" && <MyJobs navigate={navigate} />}
        {view === "job-details" && <RequestStatus navigate={navigate} />}
        {view === "business-calendar" && <BusinessCalendar navigate={navigate} />}
        {view === "business-messages" && <BusinessMessages navigate={navigate} />}
        {view === "reviews" && <Reviews navigate={navigate} />}
        {view === "earnings" && <Earnings navigate={navigate} />}
        {view === "business-profile" && <BusinessProfile navigate={navigate} />}
        {view === "provider-details" && <ProviderDetails navigate={navigate} provider={selectedProvider} />}
        {view === "business-notifications" && <BusinessNotifications navigate={navigate} />}
        {view === "provider-services" && <ProviderServices />}
        {view === "provider-settings" && <AccountSettings />}
        {view === "worker-license" && <LicensePage />}
        {view === "worker-wallet" && <LiveWallet />}
        {view === "ai-recommend" && <AiRecommend />}
        {view === "worker-target" && <WorkerTarget navigate={navigate} />}
        {view === "worker-next-jobs" && <WorkerNextJobs navigate={navigate} />}
        {view === "worker-crews" && <WorkerCrews navigate={navigate} />}
        {view === "worker-passport" && <WorkerPassport navigate={navigate} />}
        {view === "worker-safety" && <WorkerSafety navigate={navigate} />}
      </>
    );
  }

  if (BUSINESS_VIEWS.includes(view) && isBusiness(user?.role)) {
    return wrap(
      <>
        {view === "business-dashboard" && <BusinessDashboard navigate={navigate} />}
        {view === "active-job" && <ActiveJob navigate={navigate} />}
        {view === "my-jobs" && <MyJobs navigate={navigate} />}
        {view === "job-details" && <RequestStatus navigate={navigate} />}
        {view === "matched-providers" && <MatchedProviders navigate={navigate} onSelectProvider={setSelectedProvider} />}
        {view === "provider-details" && <ProviderDetails navigate={navigate} provider={selectedProvider} />}
        {view === "request-status" && <RequestStatus navigate={navigate} />}
        {view === "business-calendar" && <BusinessCalendar navigate={navigate} />}
        {view === "business-messages" && <BusinessMessages navigate={navigate} />}
        {view === "reviews" && <Reviews navigate={navigate} />}
        {view === "earnings" && <Earnings navigate={navigate} />}
        {view === "business-profile" && <BusinessProfile navigate={navigate} />}
        {view === "business-notifications" && <BusinessNotifications navigate={navigate} />}
        {view === "provider-services" && <ProviderServices />}
        {view === "provider-settings" && <AccountSettings />}
        {view === "business-analytics" && <LiveAnalytics />}
        {view === "business-license" && <LicensePage />}
        {view === "business-wallet" && <LiveWallet />}
        {view === "ai-recommend" && <AiRecommend />}
        {view === "find-crew" && <FindCrew navigate={navigate} />}
        {view === "business-team" && <TeamPage />}
      </>
    );
  }

  if (user) {
    return wrap(
      <div className="p-8">
        <h1 className="text-xl font-bold font-display">Page unavailable</h1>
        <p className="text-sm text-slate-500 mt-1">This screen is not available for your account.</p>
      </div>
    );
  }

  return <Landing navigate={navigate} />;
}

function PublicProfileEntry() {
  const userCode = window.location.pathname.split("/").filter(Boolean)[1] || "";
  return <PublicWorkerProfile userCode={userCode} />;
}

function Root() {
  const path = window.location.pathname;
  if (path.startsWith("/workers/") || path.startsWith("/pro/")) return <PublicProfileEntry />;
  return <Shell />;
}

export default function App() {
  return (
    <LangProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </LangProvider>
  );
}
