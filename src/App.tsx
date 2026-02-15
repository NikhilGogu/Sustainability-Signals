import { BrowserRouter as Router, Routes, Route } from 'react-router';
import { HelmetProvider } from 'react-helmet-async';
import { lazy, Suspense, Component } from 'react';
import type { ReactNode } from 'react';
import { Layout } from './components/layout';
import { Landing, About, Methodology, Reports, NotFound } from './pages';

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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-8">
          <div className="text-center max-w-md space-y-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Something went wrong</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{this.state.error.message}</p>
            <a href="/reports" className="inline-block text-sm font-medium text-brand-600 hover:underline">&larr; Back to Coverage</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
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
            <Route index element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/reports" element={<Reports />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
    </HelmetProvider>
  );
}
