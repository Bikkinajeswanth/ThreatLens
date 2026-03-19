import { useTheme } from '../context/ThemeContext';

/**
 * Returns Recharts-compatible style objects that read from CSS variables.
 * Call this inside any component that renders a chart.
 */
export function useChartTheme() {
  // Re-run whenever theme toggles so charts re-render with correct colours
  useTheme();

  const css = (v) => getComputedStyle(document.documentElement)
    .getPropertyValue(v).trim();

  return {
    grid:    css('--chart-grid')    || '#334155',
    tick:    css('--chart-tick')    || '#94a3b8',
    tooltip: {
      contentStyle: {
        backgroundColor: css('--chart-tooltip-bg')     || '#1e293b',
        border:          `1px solid ${css('--chart-tooltip-border') || '#334155'}`,
        borderRadius:    8,
        boxShadow:       '0 4px 16px rgba(0,0,0,0.3)',
      },
      labelStyle: { color: css('--chart-tooltip-text') || '#f1f5f9', fontWeight: 600 },
      itemStyle:  { color: css('--chart-tooltip-item') || '#94a3b8' },
    },
  };
}
