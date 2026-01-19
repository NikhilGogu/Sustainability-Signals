import { useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import type { MomentumPoint } from '../../types';

interface MomentumChartProps {
  data: MomentumPoint[];
  height?: number;
}

export function MomentumChart({ data, height = 350 }: MomentumChartProps) {
  const { series, options } = useMemo(() => {
    const series = [{
      name: 'ESG Momentum Index',
      data: data.map(point => ({
        x: new Date(point.date).getTime(),
        y: point.value
      }))
    }];

    const options: ApexOptions = {
      chart: {
        type: 'area',
        height,
        fontFamily: 'Outfit, sans-serif',
        toolbar: {
          show: false
        },
        zoom: {
          enabled: false
        },
        background: 'transparent'
      },
      colors: ['#10b981'],
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.05,
          stops: [0, 100]
        }
      },
      stroke: {
        curve: 'smooth',
        width: 2
      },
      dataLabels: {
        enabled: false
      },
      grid: {
        borderColor: '#e5e7eb',
        strokeDashArray: 4,
        xaxis: {
          lines: { show: false }
        }
      },
      xaxis: {
        type: 'datetime',
        labels: {
          style: {
            colors: '#6b7280',
            fontSize: '12px'
          },
          datetimeFormatter: {
            year: 'yyyy',
            month: 'MMM',
            day: 'dd MMM'
          }
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        min: 0,
        max: 100,
        labels: {
          style: {
            colors: '#6b7280',
            fontSize: '12px'
          },
          formatter: (value) => value.toFixed(0)
        }
      },
      tooltip: {
        theme: 'dark',
        x: {
          format: 'dd MMM yyyy'
        },
        y: {
          formatter: (value) => value.toFixed(1)
        }
      },
      markers: {
        size: 0,
        hover: {
          size: 5
        }
      }
    };

    return { series, options };
  }, [data, height]);

  return (
    <div className="w-full">
      <ReactApexChart 
        options={options} 
        series={series} 
        type="area" 
        height={height} 
      />
    </div>
  );
}
