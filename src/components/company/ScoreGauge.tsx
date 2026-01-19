interface ScoreGaugeProps {
  score: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreGauge({ score, label, size = 'md' }: ScoreGaugeProps) {
  const getColor = (score: number) => {
    if (score >= 70) return { fill: '#10b981', bg: '#d1fae5' };
    if (score >= 50) return { fill: '#f59e0b', bg: '#fef3c7' };
    return { fill: '#ef4444', bg: '#fee2e2' };
  };

  const { fill, bg } = getColor(score);
  
  const sizes = {
    sm: { width: 60, stroke: 6, fontSize: 'text-sm' },
    md: { width: 80, stroke: 8, fontSize: 'text-lg' },
    lg: { width: 100, stroke: 10, fontSize: 'text-xl' }
  };

  const { width, stroke, fontSize } = sizes[size];
  const radius = (width - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width, height: width }}>
        <svg className="transform -rotate-90" width={width} height={width}>
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="transparent"
            stroke={bg}
            strokeWidth={stroke}
          />
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            fill="transparent"
            stroke={fill}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold text-gray-900 dark:text-white ${fontSize}`}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        {label}
      </span>
    </div>
  );
}
