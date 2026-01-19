import { Link } from 'react-router';
import type { Signal } from '../../types';

interface SignalsTableProps {
  signals: Signal[];
  onSort?: (field: 'date' | 'score') => void;
  sortBy?: 'date' | 'score';
  sortOrder?: 'asc' | 'desc';
}

export function SignalsTable({ signals, onSort, sortBy, sortOrder }: SignalsTableProps) {
  const getSignalBadge = (signal: Signal['signal']) => {
    const styles = {
      positive: 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400',
      negative: 'bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400',
      neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    };
    return styles[signal];
  };

  const getScoreColor = (score: number) => {
    if (score >= 50) return 'text-success-600 dark:text-success-400';
    if (score <= -20) return 'text-error-600 dark:text-error-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const SortButton = ({ field }: { field: 'date' | 'score' }) => (
    <button 
      onClick={() => onSort?.(field)}
      className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      aria-label={`Sort by ${field}`}
    >
      {sortBy === field ? (
        sortOrder === 'asc' ? '↑' : '↓'
      ) : '↕'}
    </button>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">
              Date
              {onSort && <SortButton field="date" />}
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Ticker</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Signal</th>
            <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-white">
              Score
              {onSort && <SortButton field="score" />}
            </th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Notes</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal, index) => (
            <tr 
              key={signal.id}
              className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                index === signals.length - 1 ? 'border-b-0' : ''
              }`}
            >
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {formatDate(signal.date)}
              </td>
              <td className="py-3 px-4">
                <Link 
                  to={`/company/${signal.ticker}`}
                  className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:underline"
                >
                  {signal.ticker}
                </Link>
              </td>
              <td className="py-3 px-4">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${getSignalBadge(signal.signal)}`}>
                  {signal.signal}
                </span>
              </td>
              <td className={`py-3 px-4 text-center font-semibold ${getScoreColor(signal.score)}`}>
                {signal.score > 0 ? '+' : ''}{signal.score}
              </td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={signal.notes}>
                {signal.notes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {signals.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No signals match your filters.
        </div>
      )}
    </div>
  );
}
