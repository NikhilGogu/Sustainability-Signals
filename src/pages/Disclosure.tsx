import { Button, Card, PageHero } from '../components/ui';
import { Seo } from '../components/seo';

export function Disclosure() {
  return (
    <>
      <Seo
        title="Disclosure | Sustainability Signals"
        description="Read project disclosure, limitations, and important context for interpreting scores, entities, and AI outputs in Sustainability Signals."
        path="/disclosure"
        image="/og-image.png"
        imageAlt="Sustainability Signals — Disclosure"
        breadcrumbs={[{ name: 'Disclosure', path: '/disclosure' }]}
      />

      <PageHero
        label="Disclosure"
        align="center"
        tone="mesh"
        title={<>Student Project Disclosure</>}
        description={
          <>
            SustainabilitySignals is an educational prototype built as a student project. Please read this before using
            any scores or AI outputs.
          </>
        }
      >
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button to="/reports">Explore Coverage</Button>
          <Button to="/" variant="outline">
            Back to Home
          </Button>
        </div>
      </PageHero>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-6">
        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Educational prototype
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            This site is a student-built research and demonstration project. Features may change without notice and may
            be incomplete. We are not affiliated with, endorsed by, or representing any company whose disclosures appear
            in the coverage universe.
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Not professional advice
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            Nothing on this site constitutes investment, legal, compliance, tax, or other professional advice. Do not
            make decisions based on this site without consulting qualified professionals and reviewing primary sources.
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Accuracy and limitations
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {[
              'Coverage can be incomplete or outdated; document links may change or fail.',
              'Disclosure Quality is a best-effort, evidence-grounded heuristic. It measures disclosure presence/structure, not the truthfulness of claims.',
              'Entity extraction is experimental and can miss items, mislabel entities, or associate the wrong evidence span.',
              'Scores and outputs may vary between runs as the pipeline and models evolve.',
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
            AI outputs
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            AI systems can produce incorrect, incomplete, or misleading outputs. Always validate answers against the
            source report PDF and cited evidence. Do not submit sensitive personal information or confidential data.
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Source documents and attribution
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            Sustainability reports and PDFs referenced in coverage are the property of their respective owners. This
            project links to source disclosures and uses them for educational and research purposes. If you are a rights
            holder and have concerns, please contact us.
          </p>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Contact
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            For feedback, corrections, or takedown requests, email{' '}
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
