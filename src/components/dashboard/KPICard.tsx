import type { KPIData } from '../../types';

interface KPICardProps {
  data: KPIData;
}

export function KPICard({ data }: KPICardProps) {
  const trendColors = {
    up: 'text-success-600 dark:text-success-400',
    down: 'text-error-600 dark:text-error-400',
    neutral: 'text-gray-500 dark:text-gray-400'
  };

  const trendBg = {
    up: 'bg-success-50 dark:bg-success-900/20',
    down: 'bg-error-50 dark:bg-error-900/20',
    neutral: 'bg-gray-50 dark:bg-gray-700'
  };

  const trendIcon = {
    up: '↑',
    down: '↓',
    neutral: '→'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
        {data.title}
      </p>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {data.value}
        </p>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${trendBg[data.trend]} ${trendColors[data.trend]}`}>
          <span>{trendIcon[data.trend]}</span>
          <span>{Math.abs(data.change)}{typeof data.change === 'number' && data.title !== 'Controversy Alerts' ? '%' : ''}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        {data.changeLabel}
      </p>
    </div>
  );
}
