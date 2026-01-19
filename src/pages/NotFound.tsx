import { Helmet } from 'react-helmet-async';
import { Button } from '../components/ui/Button';

export function NotFound() {
  return (
    <>
      <Helmet>
        <title>Page Not Found - SustainabilitySignals</title>
      </Helmet>

      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl font-bold text-brand-600 mb-4">404</p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Page Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button to="/">Go Home</Button>
            <Button to="/dashboard" variant="outline">Open Dashboard</Button>
          </div>
        </div>
      </div>
    </>
  );
}
