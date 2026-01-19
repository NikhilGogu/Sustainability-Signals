import { Helmet } from 'react-helmet-async';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function About() {
  return (
    <>
      <Helmet>
        <title>About - SustainabilitySignals</title>
        <meta name="description" content="Learn about SustainabilitySignals, our mission to democratize ESG data, and the team behind the platform." />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            About SustainabilitySignals
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Making ESG market intelligence accessible for better investment decisions
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
                SustainabilitySignals is a student-built project by Nikhil Reddy Gogu, a dual-degree candidate (Master in Finance + MBA in Financial Services). Portfolio: <a className="text-brand-600 hover:text-brand-700" href="https://nikhil.chat">nikhil.chat</a>
              </p>
            </div>
          </div>
        </Card>

        {/* Background */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Background Highlights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600 dark:text-gray-400">
            <div className="space-y-2">
              <p><strong className="text-gray-900 dark:text-white">Education:</strong> Antwerp Management School (Master in Finance, Class of ’26 Representative) · Woxsen School of Business (MBA in Financial Services, Co-Chair of Quant Finance CoE)</p>
              <p><strong className="text-gray-900 dark:text-white">Location:</strong> Antwerpen, Belgium</p>
            </div>
            <div className="space-y-2">
              <p><strong className="text-gray-900 dark:text-white">ESG Experience:</strong> Impactree Data Technologies — sustainability consulting support, impact reporting, compliance tooling QA.</p>
              <p><strong className="text-gray-900 dark:text-white">Leadership:</strong> PRME Global Working Group (Steering Committee) · Bloomberg Lab Student Representative.</p>
            </div>
          </div>
        </Card>

        {/* Mission */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Our Mission
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Environmental, Social, and Governance (ESG) factors are increasingly material to investment outcomes. Yet quality ESG data remains fragmented, expensive, and difficult to interpret.
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            SustainabilitySignals aims to bridge this gap by aggregating ESG signals from multiple sources, providing clear visualizations, and offering AI-powered analysis to help investors understand sustainability factors without requiring specialized expertise.
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            We believe that better access to sustainability data leads to better capital allocation decisions—benefiting both investors and the planet.
          </p>
        </Card>

        {/* What We Do */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            What We Provide
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center text-sm font-medium">1</span>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">ESG Signal Tracking</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Monitor rating changes, controversies, and disclosure events across thousands of companies.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center text-sm font-medium">2</span>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Sector Analysis</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Compare ESG performance across sectors to identify leaders and laggards.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center text-sm font-medium">3</span>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Company Profiles</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Deep-dive into individual companies with score breakdowns, risk factors, and strengths.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center text-sm font-medium">4</span>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">AI-Powered Insights</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Natural language explanations of complex ESG data powered by GPT.</p>
              </div>
            </li>
          </ul>
        </Card>

        {/* Current Status */}
        <Card className="mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Demo Mode
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                You're viewing a demo version of SustainabilitySignals with mock data. This showcases the platform's capabilities and user interface.
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                We're actively integrating premium data sources including Refinitiv and public regulatory filings. Stay tuned for real-time data in upcoming releases.
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
            Interested in learning more, providing feedback, or exploring partnership opportunities? We'd love to hear from you.
          </p>
          <Button href="mailto:hello@sustainabilitysignals.com">
            Contact Us
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
