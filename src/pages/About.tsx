import { Helmet } from 'react-helmet-async';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useReportsCount } from '../utils/reportsCount';

export function About() {
  const { formatted: reportsCount } = useReportsCount();
  return (
    <>
      <Helmet>
        <title>About - SustainabilitySignals</title>
        <meta name="description" content="Learn about SustainabilitySignals and the team behind the platform." />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            About SustainabilitySignals
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Making sustainability research accessible
          </p>
        </div>

        {/* Student Note */}
        <Card className="mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3v7h6v-7c0-1.657-1.343-3-3-3zM8 8V7a4 4 0 118 0v1" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Student Project
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                SustainabilitySignals is built by Nikhil Reddy Gogu, a dual-degree candidate (Master in Finance + MBA in Financial Services). Portfolio: <a className="text-brand-600 hover:text-brand-700" href="https://nikhil.chat">nikhil.chat</a>
              </p>
            </div>
          </div>
        </Card>

        {/* Background */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Background
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="space-y-2">
              <p><strong className="text-gray-900 dark:text-white">Education:</strong> Antwerp Management School (Master in Finance, Class of '26 Representative) · Woxsen School of Business (MBA in Financial Services, Co-Chair of Quant Finance CoE)</p>
              <p><strong className="text-gray-900 dark:text-white">Location:</strong> Antwerpen, Belgium</p>
            </div>
            <div className="space-y-2">
              <p><strong className="text-gray-900 dark:text-white">ESG Experience:</strong> Impactree Data Technologies — sustainability consulting support, impact reporting, compliance tooling QA.</p>
              <p><strong className="text-gray-900 dark:text-white">Leadership:</strong> PRME Global Working Group (Steering Committee) · Bloomberg Lab Student Representative.</p>
            </div>
          </div>
        </Card>

        {/* What We Provide */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Platform Features
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">Reports Library</h3>
                <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">Live</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Access {reportsCount} CSRD-compliant sustainability reports with an AI-powered chat assistant. Ask questions, extract insights, and analyze complex data instantly.
              </p>

            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">ESG Signal Tracking</h3>
                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full">Coming Soon</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Monitor rating changes, controversies, and disclosure events across companies.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">Company Profiles</h3>
                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-full">Coming Soon</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Deep-dive ESG profiles with score breakdowns, risk factors, and insights.
              </p>
            </div>
          </div>
        </Card>

        {/* Contact */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Get in Touch
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Interested in learning more, providing feedback, or exploring opportunities?
          </p>
          <Button href="mailto:nikhilreddy.gogu@student.ams.ac.be">
            Contact
          </Button>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p>Email: <a className="text-brand-600 hover:text-brand-700" href="mailto:nikhilreddy.gogu@student.ams.ac.be">nikhilreddy.gogu@student.ams.ac.be</a></p>
            <p>LinkedIn: <a className="text-brand-600 hover:text-brand-700" href="https://linkedin.com/in/nikhilgogu">linkedin.com/in/nikhilgogu</a></p>
          </div>
        </Card>
      </div>
    </>
  );
}
