import { Card, PageHero } from '../components/ui';
import { Seo } from '../components/seo';

export function PrivacyPolicy() {
  return (
    <>
      <Seo
        title="Privacy Policy | Sustainability Signals"
        description="Privacy Policy for Sustainability Signals, including what technical and user-provided data may be processed in this student-built prototype."
        path="/privacy"
        image="/og-image.png"
        imageAlt="Sustainability Signals — Privacy Policy"
        breadcrumbs={[{ name: 'Privacy Policy', path: '/privacy' }]}
      />

      <PageHero
        label="Privacy"
        align="center"
        tone="mesh"
        title={<>Privacy Policy</>}
        description={
          <>
            SustainabilitySignals is a student-built prototype. This policy describes what data may be processed when
            you use the site.
          </>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-6">
        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Summary
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            We do not require accounts. If you browse the site, basic technical data may be processed for security,
            performance, and debugging (for example, IP address, user agent, and request metadata). If you submit input
            to interactive features (for example, chat), that content is processed to generate outputs. Avoid sharing
            personal or sensitive information.
          </p>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            Effective date: February 15, 2026
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Information We May Collect
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {[
              'Technical information: device/browser details, approximate location (derived from IP), and basic request logs.',
              'Usage data: pages visited and interactions used to diagnose issues and improve the product.',
              'User-provided content: anything you submit in forms or interactive features (e.g., chat prompts).',
              'Communications: if you email us, we receive the information you include in the message.',
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
            How We Use Information
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {[
              'Provide and operate the site and its features.',
              'Detect abuse, maintain security, and troubleshoot errors.',
              'Improve performance and product quality (for example, by investigating failures).',
              'Respond to inquiries and feedback.',
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
            Third-Party Processing
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            The site may be hosted on third-party infrastructure (for example, Cloudflare). Those providers may process
            technical request data to deliver the service. The site may also link to third-party websites; their privacy
            practices are governed by their own policies.
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Contact
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            Questions about this policy: {' '}
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
