import { useEffect, useRef } from 'react';
import Chart, { type ChartConfiguration } from 'chart.js/auto';

interface ChartCanvasProps {
  config: ChartConfiguration;
  height?: number;
}

export function ChartCanvas({ config, height = 240 }: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const nextConfig: ChartConfiguration = reducedMotion
      ? {
          ...config,
          options: {
            ...config.options,
            animation: false,
          },
        }
      : config;
    chartRef.current = new Chart(canvasRef.current, nextConfig);
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config]);

  return (
    <div style={{ height: `${height}px` }} className="relative w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
