import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { lazy, Suspense, Component } from 'react';
import type { ReactNode } from 'react';
import { Layout } from './components/layout';
import { AppBackdrop } from './components/layout/AppBackdrop';
import { Landing, About, Methodology, Reports, Admin, Disclosure, PrivacyPolicy, TermsOfService, NotFound } from './pages';

const CompanyReport = lazy(() =>
  import('./pages/CompanyReport').then((m) => ({ default: m.CompanyReport }))
);

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="ss-shell min-h-screen relative isolate bg-gray-50 dark:bg-gray-950" data-variant="report">
          <AppBackdrop variant="report" />
          <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
            <div className="text-center max-w-md space-y-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Something went wrong</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{this.state.error.message}</p>
              <a href="/reports" className="inline-block text-sm font-medium text-brand-600 hover:underline">&larr; Back to Coverage</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="ss-shell min-h-screen relative isolate bg-gray-50 dark:bg-gray-950" data-variant="report">
      <AppBackdrop variant="report" />
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    </div>
  );
}

function isAdminHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'admin.sustainabilitysignals.com' || host.startsWith('admin.');
}

function RootEntry() {
  if (typeof window !== 'undefined') {
    if (isAdminHostname(window.location.hostname)) {
      return <Admin />;
    }
  }

  return <Landing />;
}

function AdminRouteEntry() {
  if (typeof window !== 'undefined') {
    if (!isAdminHostname(window.location.hostname)) {
      window.location.replace('https://admin.sustainabilitysignals.com/');
      return null;
    }

    return <Navigate to="/" replace />;
  }

  if (typeof window === 'undefined') {
    return null;
  }
  return null;
}

export default function App() {
  return (
    <HelmetProvider>
      <Router>
        <Routes>
          {/* Company report gets its own full-page layout (no site header/footer) */}
          <Route
            path="/reports/:reportId"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <CompanyReport />
                </Suspense>
              </ErrorBoundary>
            }
          />

          <Route element={<Layout />}>
            {/* Main Pages */}
            <Route index element={<RootEntry />} />
            <Route path="/about" element={<About />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/admin" element={<AdminRouteEntry />} />
            <Route path="/disclosure" element={<Disclosure />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
    </HelmetProvider>
  );
}
