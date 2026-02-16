import { Button } from '../components/ui/Button';
import { Seo } from '../components/seo';

export function NotFound() {
  return (
    <>
      <Seo
        title="Page Not Found | Sustainability Signals"
        description="The requested page could not be found."
        path="/404"
        noindex
      />

      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-lg glass-panel-strong rounded-3xl p-8 sm:p-10 soft-shadow-xl">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-500/10 to-emerald-500/10 dark:from-brand-500/5 dark:to-emerald-500/5 mb-6">
            <span className="text-5xl font-extrabold gradient-text">404</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Page Not Found
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button to="/">Go Home</Button>
            <Button to="/reports" variant="outline">Explore Coverage</Button>
          </div>
        </div>
      </div>
    </>
  );
}
