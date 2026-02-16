import type { ReactNode } from 'react';
import { Button, Card, PageHero } from '../components/ui';
import { Seo } from '../components/seo';
import { useReportsCount } from '../utils/reportsCount';

type AboutFeature = {
  title: string;
  desc: ReactNode;
  icon: ReactNode;
};

const FEATURES: AboutFeature[] = [
  {
    title: 'Disclosure Quality (Live)',
    desc: 'A transparent 0-100 score across completeness, consistency, assurance, and transparency, with evidence highlights grounded in the report.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Entity Extraction (Live)',
    desc: 'Route chunks through FinBERT-ESG-9, then extract structured ESG entities (targets, emissions, policies, metrics) with evidence spans.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10" />
      </svg>
    ),
  },
  {
    title: 'Coverage Universe (Live)',
    desc: 'Explore disclosures as the evidence base. Open PDFs in-app and drill into scoring inputs.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'ESG Ratings (In Development)',
    desc: 'Building toward transparent, evidence-grounded ESG ratings using Disclosure Quality, extracted entities, and model signals.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
];

export function About() {
  const { formatted: reportsCount } = useReportsCount();

  return (
    <>
      <Seo
        title="About Sustainability Signals | Disclosure Quality and ESG Ratings Roadmap"
        description="Learn how Sustainability Signals turns disclosures into evidence-grounded scores and entities, and how the platform is evolving toward transparent ESG ratings."
        path="/about"
        image="/og-image.png"
        imageAlt="Sustainability Signals logo on dark background"
        keywords={['about sustainability signals', 'esg methodology', 'disclosure quality scoring']}
      />

      <PageHero
        label="About"
        align="center"
        tone="mesh"
        title={
          <>
            Sustainability<span className="gradient-text">Signals</span>
          </>
        }
        description={
          <>
            Evidence-grounded Disclosure Quality scoring and entity extraction, building toward transparent ESG ratings.
          </>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            What this platform does
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            SustainabilitySignals turns long sustainability reports into auditable signals. You can open the original PDFs,
            score Disclosure Quality, extract structured ESG entities, and trace everything back to evidence on the page.
          </p>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { k: 'Disclosures', v: reportsCount },
              { k: 'DQ Score', v: '0-100' },
              { k: 'Entities', v: 'Evidence spans' },
              { k: 'Chat', v: 'Report-grounded' },
            ].map((m) => (
              <div
                key={m.k}
                className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200/60 dark:border-gray-800/60 text-center hover-lift"
              >
                <div className="text-lg font-extrabold text-gray-900 dark:text-white">{m.v}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-1">{m.k}</div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <Card key={f.title} className="card-surface p-7 sm:p-8 hover-lift">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-emerald-500 text-white shadow-lg shadow-brand-500/20 flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="card-surface p-7 sm:p-8 overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Roadmap
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
                Disclosure Quality is the first layer. Next comes entity-backed indicators and peer benchmarks. The end
                state is a transparent methodology for ESG ratings grounded in auditable evidence.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button to="/methodology" variant="outline">
                Methodology
              </Button>
              <Button to="/reports">Explore Coverage</Button>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { t: 'Now', d: 'DQ scoring + grounded chat + entity extraction', cls: 'from-emerald-500 to-teal-500' },
              { t: 'Next', d: 'Entity-backed indicators + peer benchmarks', cls: 'from-sky-500 to-blue-600' },
              { t: 'Then', d: 'Transparent ESG ratings methodology', cls: 'from-amber-500 to-orange-500' },
            ].map((s) => (
              <div
                key={s.t}
                className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-200/60 dark:border-gray-800/60 hover-lift"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${s.cls}`} aria-hidden="true" />
                  <div className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{s.t}</div>
                </div>
                <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-white leading-snug">{s.d}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="card-surface p-7 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Contact
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
            Feedback and collaboration are welcome.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
            <Button href="mailto:nikhilreddy.gogu@student.ams.ac.be">Email</Button>
            <Button href="https://linkedin.com/in/nikhilgogu" variant="outline">
              LinkedIn
            </Button>
            <Button href="https://nikhil.chat" variant="ghost">
              Portfolio
            </Button>
          </div>
          <div className="mt-6 text-xs text-gray-400 dark:text-gray-500">Built by Nikhil Reddy Gogu. Student project.</div>
        </Card>
      </div>
    </>
  );
}
