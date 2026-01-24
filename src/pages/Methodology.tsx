import { Helmet } from 'react-helmet-async';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useReportsCount } from '../utils/reportsCount';

export function Methodology() {
  const { formatted: reportsCount } = useReportsCount();
  return (
    <>
      <Helmet>
        <title>Methodology - SustainabilitySignals</title>
        <meta name="description" content="Learn how SustainabilitySignals collects and presents sustainability report data." />
      </Helmet>

      <div className="relative overflow-hidden bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-100/40 via-gray-50 to-gray-50 dark:from-brand-900/20 dark:via-gray-900 dark:to-gray-950" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-4 animate-fade-up">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-teal-500 dark:from-brand-400 dark:to-teal-400">
                Methodology
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed animate-fade-up-delay-1 max-w-2xl mx-auto">
              How data is collected, organized, and presented
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <Card className="mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Built as a Student Project
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                This platform was built by Nikhil Reddy Gogu, with a focus on ESG reporting and sustainable finance. Portfolio: <a className="text-brand-600 hover:text-brand-700" href="https://nikhil.chat">nikhil.chat</a>
              </p>
            </div>
          </div>
        </Card>

        {/* Reports Library */}
        <Card className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Reports Library
            </h2>
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
              Live
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The database contains {reportsCount} CSRD-compliant sustainability reports from European companies:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Coverage</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• {reportsCount} sustainability reports</li>
                <li>• 30+ European countries</li>
                <li>• 15+ industry sectors</li>
                <li>• Fiscal year 2024 data</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Features</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• AI-powered chat assistant</li>
                <li>• In-app PDF viewer</li>
                <li>• Opens at exact sustainability section</li>
                <li>• Filter by country, sector, industry</li>
              </ul>
            </div>
          </div>
          <Button to="/reports">
            Browse Reports
          </Button>
        </Card>

        {/* Data Collection */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Data Collection
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Reports are sourced from official company filings and regulatory disclosures. Each report includes:
          </p>
          <ul className="space-y-2 text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-brand-500">✓</span>
              <span><strong>Company information:</strong> Name, country, sector, and industry classification</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500">✓</span>
              <span><strong>Report metadata:</strong> Publication year and direct PDF link</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-500">✓</span>
              <span><strong>Section mapping:</strong> Exact page range for sustainability content</span>
            </li>
          </ul>
        </Card>

        {/* Future Plans */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Coming Soon
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The roadmap includes implementing additional features:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">ESG Signals</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time tracking of ESG rating changes, controversies, and disclosure events.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Company Profiles</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deep-dive ESG profiles with score breakdowns and risk analysis.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Premium Data</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Integration with Refinitiv and other institutional data sources.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Advanced Analytics</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Comparative analysis, trend detection, and portfolio-level ESG insights.
              </p>
            </div>
          </div>
        </Card>

        {/* Disclaimers */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Disclaimers
          </h2>
          <ul className="space-y-3 text-gray-600 dark:text-gray-400 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Reports are sourced from publicly available company disclosures and may be subject to updates.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>This platform is for informational purposes only and does not constitute investment advice.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Self-reported company data may be subject to incomplete disclosure.</span>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
