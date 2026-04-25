import { lazy, Suspense, useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/AuthContext";
import Layout from "./components/Layout";
import { APP_ROUTES, PUBLIC_ROUTES } from "./lib/routes";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SuitesPage = lazy(() => import("./pages/SuitesPage"));
const SuiteEditorPage = lazy(() => import("./pages/SuiteEditorPage"));
const TimelinePage = lazy(() => import("./pages/TimelinePage"));
const RunDetailPage = lazy(() => import("./pages/RunDetailPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const RunsPage = lazy(() => import("./pages/RunsPage"));
const PoliciesPage = lazy(() => import("./pages/PoliciesPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const PublicDemoPage = lazy(() => import("./pages/PublicDemoPage"));
const TruthfulQaResearchPage = lazy(() => import("./pages/TruthfulQaResearchPage"));

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

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 text-sm text-gray-400">
      Loading...
    </div>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <AuthProvider>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path={PUBLIC_ROUTES.home} element={<LandingPage />} />
          <Route path={PUBLIC_ROUTES.demo} element={<PublicDemoPage />} />
          <Route
            path={PUBLIC_ROUTES.truthfulQaResearch}
            element={<TruthfulQaResearchPage />}
          />
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
      </Suspense>
    </AuthProvider>
  );
}
