import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Helmet } from 'react-helmet-async';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { MiniChart, ScoreGauge } from '../components/company';
import { fetchCompanySnapshot, fetchMomentumSeries, explainCompanySnapshot } from '../providers';
import type { CompanySnapshot, MomentumPoint, GPTExplanation } from '../types';

export function Company() {
  const { ticker } = useParams<{ ticker: string }>();
  const [company, setCompany] = useState<CompanySnapshot | null>(null);
  const [momentumData, setMomentumData] = useState<MomentumPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // GPT Modal state
  const [gptModalOpen, setGptModalOpen] = useState(false);
  const [gptLoading, setGptLoading] = useState(false);
  const [gptExplanation, setGptExplanation] = useState<GPTExplanation | null>(null);

  useEffect(() => {
    async function loadCompany() {
      if (!ticker) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const [companyRes, momentumRes] = await Promise.all([
          fetchCompanySnapshot(ticker),
          fetchMomentumSeries(ticker, 3)
        ]);
        
        if (companyRes.success && companyRes.data) {
          setCompany(companyRes.data);
        } else {
          setError(companyRes.error || 'Company not found');
        }
        
        if (momentumRes.success) {
          setMomentumData(momentumRes.data);
        }
      } catch (err) {
        setError('Failed to load company data');
      }
      
      setLoading(false);
    }
    
    loadCompany();
  }, [ticker]);

  const handleExplainWithGPT = async () => {
    if (!company) return;
    
    setGptModalOpen(true);
    setGptLoading(true);
    
    try {
      const response = await explainCompanySnapshot(company);
      if (response.success) {
        setGptExplanation(response.data);
      }
    } catch (err) {
      console.error('GPT explanation failed:', err);
    }
    
    setGptLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center text-gray-500">Loading company data...</div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Company Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || `No data available for ticker "${ticker}"`}
          </p>
          <Button to="/dashboard">Back to Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{company.name} ({company.ticker}) - SustainabilitySignals</title>
        <meta name="description" content={`ESG profile for ${company.name}. Overall score: ${company.esgScore}/100. ${company.description}`} />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <li><Link to="/dashboard" className="hover:text-brand-600">Dashboard</Link></li>
            <li>/</li>
            <li className="text-gray-900 dark:text-white font-medium">{company.ticker}</li>
          </ol>
        </nav>

        {/* Company Header */}
        <Card className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  {company.name}
                </h1>
                <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-mono text-sm">
                  {company.ticker}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span>{company.sector}</span>
                <span>•</span>
                <span>{company.industry}</span>
                <span>•</span>
                <span>Market Cap: {company.marketCap}</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
                {company.description}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                Last updated: {new Date(company.lastUpdated).toLocaleDateString()}
              </p>
            </div>
            
            {/* ESG Score Summary */}
            <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <ScoreGauge score={company.esgScore} label="Overall ESG" size="lg" />
              <div className="flex flex-col gap-3">
                <ScoreGauge score={company.environmentScore} label="Environment" size="sm" />
                <ScoreGauge score={company.socialScore} label="Social" size="sm" />
                <ScoreGauge score={company.governanceScore} label="Governance" size="sm" />
              </div>
            </div>
          </div>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* ESG Score Trend */}
          <Card className="lg:col-span-2">
            <CardHeader 
              title="ESG Score Trend" 
              subtitle="90-day momentum for this company"
            />
            <div className="h-[200px]">
              {momentumData.length > 0 ? (
                <MiniChart data={momentumData} height={200} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  No trend data available
                </div>
              )}
            </div>
          </Card>

          {/* AI Analysis Button */}
          <Card className="flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              AI-Powered Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Get GPT-generated insights about this company's ESG profile
            </p>
            <Button onClick={handleExplainWithGPT}>
              Explain with GPT
            </Button>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              (Demo: uses mock AI response)
            </p>
          </Card>
        </div>

        {/* Risks and Positives */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Key Risks */}
          <Card>
            <CardHeader 
              title="Key Risks" 
              subtitle="Material ESG concerns to monitor"
            />
            <ul className="space-y-3">
              {company.keyRisks.map((risk, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-error-100 dark:bg-error-900/20 text-error-600 dark:text-error-400 rounded-full flex items-center justify-center text-sm">
                    !
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{risk}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Key Positives */}
          <Card>
            <CardHeader 
              title="Key Positives" 
              subtitle="Sustainability strengths"
            />
            <ul className="space-y-3">
              {company.keyPositives.map((positive, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-success-100 dark:bg-success-900/20 text-success-600 dark:text-success-400 rounded-full flex items-center justify-center text-sm">
                    ✓
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{positive}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* GPT Explanation Modal */}
      <Modal
        isOpen={gptModalOpen}
        onClose={() => setGptModalOpen(false)}
        title={`AI Analysis: ${company.name}`}
        size="lg"
      >
        {gptLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Generating analysis...</p>
          </div>
        ) : gptExplanation ? (
          <div className="space-y-6">
            {/* Summary */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Summary</h4>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                {gptExplanation.summary}
              </p>
            </div>

            {/* Key Points */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Key Points</h4>
              <ul className="space-y-2">
                {gptExplanation.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <span className="text-brand-600">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sentiment & Confidence */}
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Sentiment</span>
                <span className={`font-semibold capitalize ${
                  gptExplanation.sentiment === 'bullish' ? 'text-success-600' :
                  gptExplanation.sentiment === 'bearish' ? 'text-error-600' :
                  'text-gray-600'
                }`}>
                  {gptExplanation.sentiment}
                </span>
              </div>
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Confidence</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Math.round(gptExplanation.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
              <p className="text-sm text-warning-800 dark:text-warning-300">
                <strong>Disclaimer:</strong> {gptExplanation.disclaimer}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">Failed to generate analysis.</p>
        )}
      </Modal>
    </>
  );
}
