import { Helmet } from 'react-helmet-async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useReportsCount } from '../utils/reportsCount';

const features = [
  {
    title: 'Market Signals',
    description: 'Real-time ESG momentum tracking across sectors. Identify emerging trends before they hit mainstream.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  },
  {
    title: 'Reports Library',
    description: null, // Will be populated dynamically in component
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    title: 'Company Snapshots',
    description: 'Deep-dive ESG profiles with risk analysis, score breakdowns, and AI-powered insights.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  }
];

export function Landing() {
  const { formatted: reportsCount } = useReportsCount();

  // Update features with dynamic count
  const dynamicFeatures = features.map(f =>
    f.title === 'Reports Library'
      ? { ...f, description: `Access ${reportsCount} CSRD-compliant sustainability reports with our integrated PDF viewer and AI-powered chat.` }

      : f
  );

  return (
    <>
      <Helmet>
        <title>SustainabilitySignals - ESG Market Intelligence</title>
        <meta name="description" content={`Track ESG momentum, analyze company sustainability profiles, and access ${reportsCount} CSRD-compliant reports. Data-driven insights for responsible investing.`} />
        <meta property="og:title" content="SustainabilitySignals - ESG Market Intelligence" />
        <meta property="og:description" content="Track ESG momentum, analyze company sustainability profiles, and make informed investment decisions." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://sustainabilitysignals.com" />
      </Helmet>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 to-white dark:from-gray-900 dark:to-gray-800" />
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-brand-100/60 blur-3xl animate-float" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white tracking-tight animate-fade-up-delay-1">
              ESG Intelligence for{' '}
              <span className="text-brand-600">Smarter Decisions</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl animate-fade-up-delay-2">
              Track sustainability signals, analyze ESG momentum, and access <strong>{reportsCount} CSRD-compliant reports</strong> with AI-powered insights. Data-driven insights for responsible investing.

            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-up-delay-2">
              <Button to="/reports" size="lg">
                Browse Reports
              </Button>
              <Button to="/methodology" variant="outline" size="lg">
                Methodology
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Key Features
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Comprehensive ESG monitoring and sustainability research tools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {dynamicFeatures.map((feature) => (
              <Card key={feature.title} padding="lg" hover className="animate-fade-up">
                <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/30 rounded-xl flex items-center justify-center text-brand-600 dark:text-brand-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Reports Highlight Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 sm:p-12">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm font-medium mb-4">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  New Feature
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {reportsCount} Sustainability Reports
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-xl">
                  Browse CSRD-compliant sustainability disclosures from European companies. Get specific insights instantly via the AI-powered chat.


                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">30+ Countries</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">15+ Sectors</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-brand-50 to-green-50 dark:from-gray-800 dark:to-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 sm:p-12">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 rounded-full text-sm font-medium mb-4">
                  <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
                  Coming Soon
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Premium Data Sources
                </h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-xl">
                  The platform integrates institutional-grade ESG data from Refinitiv and other leading providers. Currently showing demo signals to showcase capabilities.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Refinitiv</span>
                  <span className="text-xs text-gray-500">(planned)</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 rounded-lg">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Public Sources</span>
                  <span className="text-xs text-gray-500">(planned)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-brand-600 animate-shimmer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Start Exploring
          </h2>
          <p className="text-lg text-brand-100 max-w-2xl mx-auto mb-8">
            Browse {reportsCount} sustainability reports or explore our ESG methodology. Click on any company to view their full disclosure directly in the app.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button to="/reports" variant="secondary" size="lg">
              Browse Reports
            </Button>
            <Button to="/methodology" variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
              Methodology
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
