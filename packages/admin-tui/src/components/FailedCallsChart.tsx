import React from 'react';
import { Box, Text } from 'ink';
import { TitledBox } from './TitledBox.js';
import { buildVolumeChart } from '../lib/brailleChart.js';
import { colors } from '../theme/colors.js';

interface FailedCallsChartProps {
  /** Per-second failed-call counts, oldest first. */
  series: number[];
  width: number;
}

export function FailedCallsChart({ series, width }: FailedCallsChartProps) {
  const charWidth = Math.max(4, width - 2);
  const window = series.slice(-charWidth * 2);
  const total = window.reduce((s, n) => s + n, 0);
  const peak = window.length > 0 ? Math.max(...window) : 0;

  const title = `FAILED CALLS — last ${window.length}s`;
  const runs = buildVolumeChart(series, charWidth, (l, r) => (l > 0 || r > 0 ? colors.danger : colors.muted));

  return (
    <TitledBox title={title} width={width}>
      <Box>
        {runs.length > 0 ? (
          runs.map((run, i) => <Text key={i} color={run.color}>{run.chars}</Text>)
        ) : (
          <Text color={colors.muted} dimColor>No traffic yet…</Text>
        )}
      </Box>
      <Text color={colors.muted} dimColor>{`total ${total}  peak/s ${peak}`}</Text>
    </TitledBox>
  );
}
