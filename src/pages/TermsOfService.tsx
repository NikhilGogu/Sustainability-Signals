import { Card, PageHero } from '../components/ui';
import { Seo } from '../components/seo';

export function TermsOfService() {
  return (
    <>
      <Seo
        title="Terms of Service | Sustainability Signals"
        description="Terms of Service for Sustainability Signals, including acceptable use, liability limitations, and educational project disclaimers."
        path="/terms"
        image="/og-image.png"
        imageAlt="Sustainability Signals — Terms of Service"
        breadcrumbs={[{ name: 'Terms of Service', path: '/terms' }]}
      />

      <PageHero
        label="Terms"
        align="center"
        tone="mesh"
        title={<>Terms of Service</>}
        description={
          <>
            SustainabilitySignals is a student-built prototype. Use of this site is subject to the terms below.
          </>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-6">
        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            1. Educational Prototype
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            This site is provided for research and demonstration purposes. Features may change, degrade, or be removed
            at any time.
          </p>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Effective date: February 15, 2026
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            2. No Professional Advice
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            Outputs (scores, entities, summaries, or chat responses) are not investment, legal, compliance, tax, or other
            professional advice. Always validate against primary sources and consult qualified professionals as needed.
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            3. Acceptable Use
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {[
              'Do not misuse the site (for example, attempt to disrupt, scrape excessively, probe, or bypass security controls).',
              'Do not upload or submit sensitive personal information.',
              'Do not rely on outputs as the sole basis for decisions.',
              'Respect third-party intellectual property in linked reports and PDFs.',
            ].map((x) => (
              <li key={x} className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                {x}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            4. Third-Party Content
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            Sustainability reports and PDFs are owned by their respective publishers. This project may link to or display
            third-party content for educational purposes. Third-party sites and content are governed by their own terms.
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            5. Disclaimers and Limitation of Liability
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            The site is provided on an "as is" and "as available" basis, without warranties of any kind. To the maximum
            extent permitted by law, we are not liable for any damages arising from use of the site or reliance on its
            outputs.
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            6. Contact
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            Questions about these terms: {' '}
            <a
              className="font-semibold text-brand-700 dark:text-brand-300 hover:underline break-all"
              href="mailto:nikhilreddy.gogu@student.ams.ac.be"
            >
              nikhilreddy.gogu@student.ams.ac.be
            </a>
            .
          </p>
        </Card>
      </div>
    </>
  );
}
