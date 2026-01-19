import { Link } from 'react-router';
import type { SectorScore } from '../../types';

interface SectorHeatmapProps {
  data: SectorScore[];
}

export function SectorHeatmap({ data }: SectorHeatmapProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400';
    if (score >= 50) return 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400';
    return 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400';
  };

  const getMomentumColor = (momentum: number) => {
    if (momentum >= 10) return 'text-success-600 dark:text-success-400';
    if (momentum <= -10) return 'text-error-600 dark:text-error-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getRiskBadge = (level: SectorScore['riskLevel']) => {
    const styles = {
      low: 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400',
      medium: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
      high: 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400'
    };
    return styles[level];
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Sector</th>
            <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">ESG Score</th>
            <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">Momentum</th>
            <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">Risk</th>
            <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">Signals</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Top Company</th>
          </tr>
        </thead>
        <tbody>
          {data.map((sector, index) => (
            <tr 
              key={sector.sector}
              className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                index === data.length - 1 ? 'border-b-0' : ''
              }`}
            >
              <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                {sector.sector}
              </td>
              <td className="py-3 px-4 text-center">
                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getScoreColor(sector.esgScore)}`}>
                  {sector.esgScore}
                </span>
              </td>
              <td className={`py-3 px-4 text-center font-medium ${getMomentumColor(sector.momentum)}`}>
                {sector.momentum > 0 ? '+' : ''}{sector.momentum}%
              </td>
              <td className="py-3 px-4 text-center">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${getRiskBadge(sector.riskLevel)}`}>
                  {sector.riskLevel}
                </span>
              </td>
              <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                {sector.signalCount}
              </td>
              <td className="py-3 px-4">
                <Link 
                  to={`/company/${sector.topCompany.split(' ')[0].toUpperCase()}`}
                  className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:underline"
                >
                  {sector.topCompany}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
