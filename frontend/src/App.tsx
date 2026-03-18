import { useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from "react-router-dom";
import { useAuth } from "./AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SuitesPage from "./pages/SuitesPage";
import SuiteEditorPage from "./pages/SuiteEditorPage";
import TimelinePage from "./pages/TimelinePage";
import RunDetailPage from "./pages/RunDetailPage";
import AlertsPage from "./pages/AlertsPage";
import SettingsPage from "./pages/SettingsPage";
import RunsPage from "./pages/RunsPage";
import PoliciesPage from "./pages/PoliciesPage";
import { AuthProvider } from "./AuthContext";
import LandingPage from "./pages/LandingPage";
import PublicDemoPage from "./pages/PublicDemoPage";
import { APP_ROUTES, PUBLIC_ROUTES } from "./lib/routes";

function RequireAuth() {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to={PUBLIC_ROUTES.login} state={{ from: location }} replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function LegacySuiteEditRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={APP_ROUTES.editSuite(id ?? "")} replace />;
}

function LegacyRunRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={APP_ROUTES.run(id ?? "")} replace />;
}

function LegacyTimelineRedirect() {
  const location = useLocation();
  return <Navigate to={`${APP_ROUTES.timeline}${location.search}`} replace />;
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <AuthProvider>
      <Routes>
        <Route path={PUBLIC_ROUTES.home} element={<LandingPage />} />
        <Route path={PUBLIC_ROUTES.demo} element={<PublicDemoPage />} />
        <Route path={PUBLIC_ROUTES.login} element={<LoginPage />} />

        <Route path="/dashboard" element={<Navigate to={APP_ROUTES.root} replace />} />
        <Route path="/suites" element={<Navigate to={APP_ROUTES.suites} replace />} />
        <Route path="/suites/new" element={<Navigate to={APP_ROUTES.newSuite} replace />} />
        <Route path="/suites/:id/edit" element={<LegacySuiteEditRedirect />} />
        <Route path="/runs" element={<Navigate to={APP_ROUTES.runs} replace />} />
        <Route path="/runs/:id" element={<LegacyRunRedirect />} />
        <Route path="/timeline" element={<LegacyTimelineRedirect />} />
        <Route path="/alerts" element={<Navigate to={APP_ROUTES.alerts} replace />} />
        <Route path="/policies" element={<Navigate to={APP_ROUTES.policies} replace />} />
        <Route path="/settings" element={<Navigate to={APP_ROUTES.settings} replace />} />

        <Route path="/app" element={<RequireAuth />}>
          <Route index element={<DashboardPage />} />
          <Route path="suites" element={<SuitesPage />} />
          <Route path="suites/new" element={<SuiteEditorPage />} />
          <Route path="suites/:id/edit" element={<SuiteEditorPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="runs/:id" element={<RunDetailPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to={PUBLIC_ROUTES.home} replace />} />
      </Routes>
    </AuthProvider>
  );
}
