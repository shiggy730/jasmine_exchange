import React from 'react';
import { Box, Text } from 'ink';
import { TitledBox } from './TitledBox.js';
import { buildVolumeChart } from '../lib/brailleChart.js';
import { colors } from '../theme/colors.js';

interface RequestsChartProps {
  /** Per-second total request counts across all routes, oldest first — 1s buckets, so this is TPS over time. */
  series: number[];
  width: number;
}

export function RequestsChart({ series, width }: RequestsChartProps) {
  const charWidth = Math.max(4, width - 2);
  const window = series.slice(-charWidth * 2);
  const peak = window.length > 0 ? Math.max(...window) : 0;
  const avg = window.length > 0 ? window.reduce((s, n) => s + n, 0) / window.length : 0;

  const title = `REQUESTS/SEC — last ${window.length}s`;
  const runs = buildVolumeChart(series, charWidth, () => colors.up);

  return (
    <TitledBox title={title} width={width}>
      <Box>
        {runs.length > 0 ? (
          runs.map((run, i) => <Text key={i} color={run.color}>{run.chars}</Text>)
        ) : (
          <Text color={colors.muted} dimColor>No traffic yet…</Text>
        )}
      </Box>
      <Text color={colors.muted} dimColor>{`avg ${avg.toFixed(2)}/s  peak ${peak}/s`}</Text>
    </TitledBox>
  );
}
