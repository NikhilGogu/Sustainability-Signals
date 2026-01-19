import { useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import type { MomentumPoint } from '../../types';

interface MiniChartProps {
  data: MomentumPoint[];
  color?: string;
  height?: number;
}

export function MiniChart({ data, color = '#10b981', height = 80 }: MiniChartProps) {
  const { series, options } = useMemo(() => {
    const series = [{
      name: 'Score',
      data: data.map(point => point.value)
    }];

    const options: ApexOptions = {
      chart: {
        type: 'line',
        height,
        sparkline: {
          enabled: true
        },
        background: 'transparent'
      },
      colors: [color],
      stroke: {
        curve: 'smooth',
        width: 2
      },
      tooltip: {
        enabled: true,
        fixed: {
          enabled: false
        },
        theme: 'dark',
        y: {
          formatter: (value) => value.toFixed(1)
        }
      }
    };

    return { series, options };
  }, [data, color, height]);

  return (
    <div className="w-full">
      <ReactApexChart 
        options={options} 
        series={series} 
        type="line" 
        height={height} 
      />
    </div>
  );
}
