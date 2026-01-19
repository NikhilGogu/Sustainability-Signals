import { Helmet } from 'react-helmet-async';
import { Card } from '../components/ui/Card';

export function Methodology() {
  return (
    <>
      <Helmet>
        <title>Methodology - SustainabilitySignals</title>
        <meta name="description" content="Learn how SustainabilitySignals calculates ESG scores, tracks signals, and processes sustainability data." />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Methodology
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            How we collect, process, and present ESG data
          </p>
        </div>

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
                This methodology page reflects a student-built prototype by Nikhil Reddy Gogu, with a focus on ESG reporting and sustainable finance. Portfolio: <a className="text-brand-600 hover:text-brand-700" href="https://nikhil.chat">nikhil.chat</a>
              </p>
            </div>
          </div>
        </Card>

        {/* Data Sources */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Data Sources
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            SustainabilitySignals aggregates data from multiple sources to provide comprehensive ESG coverage:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Refinitiv (Planned)</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Institutional-grade ESG scores, controversy data, and company fundamentals from one of the world's leading financial data providers.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Public Disclosures</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Company sustainability reports, SEC filings, CDP questionnaires, and regulatory disclosures.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">News & Events</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time monitoring of ESG-relevant news, controversies, and corporate announcements.
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">NGO & Research Reports</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Analysis from environmental organizations, human rights groups, and academic research.
              </p>
            </div>
          </div>
        </Card>

        {/* Scoring Framework */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            ESG Scoring Framework
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Our ESG scores range from 0-100 and are broken down into three pillars:
          </p>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-3 h-3 bg-success-500 rounded-full"></span>
                Environmental (E)
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                Measures a company's impact on and management of environmental issues:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-5">
                <li>• Carbon emissions and climate strategy</li>
                <li>• Energy efficiency and renewable energy adoption</li>
                <li>• Waste management and circular economy practices</li>
                <li>• Water usage and conservation</li>
                <li>• Biodiversity impact</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                Social (S)
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                Evaluates relationships with employees, suppliers, customers, and communities:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-5">
                <li>• Labor practices and worker safety</li>
                <li>• Diversity, equity, and inclusion</li>
                <li>• Human rights in supply chain</li>
                <li>• Community engagement</li>
                <li>• Data privacy and product safety</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                Governance (G)
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                Assesses leadership, accountability, and ethical conduct:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-5">
                <li>• Board composition and independence</li>
                <li>• Executive compensation alignment</li>
                <li>• Shareholder rights</li>
                <li>• Business ethics and anti-corruption</li>
                <li>• Transparency and disclosure quality</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Signal Types */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Signal Types
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We track several categories of ESG-relevant events:
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">Signal Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Description</th>
                  <th className="text-left py-3 pl-4 font-semibold text-gray-900 dark:text-white">Example</th>
                </tr>
              </thead>
              <tbody className="text-gray-600 dark:text-gray-400">
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 pr-4 font-medium">Rating Change</td>
                  <td className="py-3 px-4">Upgrades or downgrades from ESG rating agencies</td>
                  <td className="py-3 pl-4">MSCI upgrades company from BBB to A</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 pr-4 font-medium">Controversy</td>
                  <td className="py-3 px-4">Negative events involving ESG issues</td>
                  <td className="py-3 pl-4">Environmental violation, labor dispute</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 pr-4 font-medium">Disclosure</td>
                  <td className="py-3 px-4">New sustainability reports or data releases</td>
                  <td className="py-3 pl-4">Annual sustainability report published</td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 pr-4 font-medium">Policy</td>
                  <td className="py-3 px-4">Company commitments and policy changes</td>
                  <td className="py-3 pl-4">Net-zero pledge, DEI initiative</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Momentum</td>
                  <td className="py-3 px-4">Trend changes in ESG performance</td>
                  <td className="py-3 pl-4">Significant improvement in emissions intensity</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Score Interpretation */}
        <Card className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Interpreting Scores
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-24 px-3 py-2 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 rounded-lg text-center font-semibold">
                70-100
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Leader</span>
                <p className="text-sm text-gray-600 dark:text-gray-400">Strong ESG practices, above industry average</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 px-3 py-2 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 rounded-lg text-center font-semibold">
                50-69
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Average</span>
                <p className="text-sm text-gray-600 dark:text-gray-400">Moderate ESG performance, room for improvement</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-24 px-3 py-2 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg text-center font-semibold">
                0-49
              </div>
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Laggard</span>
                <p className="text-sm text-gray-600 dark:text-gray-400">Below average ESG performance, material risks</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Limitations */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Limitations & Disclaimers
          </h2>
          <ul className="space-y-3 text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>ESG scores represent point-in-time assessments and may not reflect recent developments.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Different rating agencies may have varying methodologies and arrive at different conclusions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Self-reported company data may be subject to greenwashing or incomplete disclosure.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>AI-generated analyses should be treated as supplementary insights, not investment advice.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Past ESG performance is not indicative of future results or financial returns.</span>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
