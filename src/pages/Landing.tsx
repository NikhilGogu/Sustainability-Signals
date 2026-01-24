import { Helmet } from 'react-helmet-async';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useReportsCount } from '../utils/reportsCount';

const features = [
  {
    title: 'AI Chat Assistant',
    description: 'Ask questions about any report and get instant, accurate answers. Extract insights, compare metrics, and understand complex sustainability data effortlessly.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
      ? { ...f, description: `Browse ${reportsCount} CSRD-compliant sustainability reports. View PDFs in-app and chat with our AI to extract insights instantly.` }

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
      <section className="relative overflow-hidden min-h-[90vh] flex items-center justify-center">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-100/50 via-gray-50 to-gray-50 dark:from-brand-900/20 dark:via-gray-900 dark:to-gray-950" />
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-brand-400/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-sm animate-fade-up">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Now tracking {reportsCount} sustainability reports
              </span>
            </div>

            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-gray-900 dark:text-white animate-fade-up-delay-1">
              AI-Powered Insights for <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-teal-500 dark:from-brand-400 dark:to-teal-400">
                Sustainability Reports
              </span>
            </h1>

            <p className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed animate-fade-up-delay-2">
              Extract key metrics, compare data, and analyze over <strong>{reportsCount} CSRD-compliant reports</strong> instantly with our advanced AI assistant.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 animate-fade-up-delay-2">
              <Button to="/reports" size="xl" className="shadow-xl shadow-brand-500/20 hover:shadow-brand-500/30 transition-all hover:-translate-y-1">
                Browse Reports
                <svg className="w-5 h-5 ml-2 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Button>
              <Button to="/methodology" variant="outline" size="xl" className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white/80 dark:hover:bg-gray-800 transition-all hover:-translate-y-1">
                View Methodology
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white dark:bg-gray-900 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Intelligence at Scale
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Our platform combines advanced AI processing with comprehensive ESG data to deliver actionable insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {dynamicFeatures.map((feature) => (
              <div key={feature.title} className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-brand-500 to-teal-500 rounded-2xl opacity-0 group-hover:opacity-100 transition duration-500 blur" />
                <Card className="relative h-full bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-100 dark:border-gray-700/50 shadow-lg hover:shadow-xl transition-all duration-300">
                  <div className="w-14 h-14 bg-gradient-to-br from-brand-50 to-teal-50 dark:from-brand-900/30 dark:to-teal-900/30 rounded-xl flex items-center justify-center text-brand-600 dark:text-brand-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reports Highlight Section */}
      <section className="py-24 bg-gray-50/50 dark:bg-gray-950/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
            <div className="grid md:grid-cols-2 gap-12 p-8 sm:p-16 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full text-sm font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                  </span>
                  Live Beta
                </div>
                <h3 className="text-4xl font-bold text-gray-900 dark:text-white">
                  Chat with your data
                </h3>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Stop searching through hundreds of pages. Open any report and ask our AI assistant to instantly find disclosure policies, emission data, and governance structures.
                </p>
                <div className="flex flex-wrap gap-3 pt-4">
                  {['Scope 1, 2, 3', 'GRI Standards', 'TCFD', 'SASB'].map((tag) => (
                    <span key={tag} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-brand-500 to-blue-500 opacity-20 blur-xl rounded-full" />
                <div className="relative bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-lg">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center text-brand-600 flex-shrink-0">
                      AI
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-700 shadow-sm">
                      <p className="text-gray-800 dark:text-gray-200 text-sm">
                        Based on the 2024 report, the company has reduced Scope 1 emissions by 15% through renewable energy adoption...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <div className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-brand-600/20">
                      What are the Scope 3 targets?
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 sm:p-12 shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
              <div className="max-w-2xl">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  Institutional-Grade Data
                </h3>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  In addition to our analyzed reports, we are integrating premium data feeds from leading providers to offer comprehensive market signals.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:scale-105 transition-transform cursor-default">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900 dark:text-white">Refinitiv</div>
                    <div className="text-xs text-gray-500">Coming Soon</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-brand-600">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent opacity-50" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8 tracking-tight">
            Ready to dive in?
          </h2>
          <p className="text-xl text-brand-100 max-w-2xl mx-auto mb-10 leading-relaxed">
            Join the community of analysts and sustainability professionals using our platform to make data-driven decisions.
          </p>
          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <Button to="/reports" variant="secondary" size="xl" className="shadow-xl shadow-black/10">
              Browse Reports
            </Button>
            <Button to="/methodology" variant="outline" size="xl" className="border-white text-white hover:bg-white/10">
              Read Methodology
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
