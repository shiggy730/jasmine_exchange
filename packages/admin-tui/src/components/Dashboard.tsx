import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { MetricsSnapshot } from '@jasmine-exchange/shared';
import { TitledBox } from './TitledBox.js';
import { RequestsChart } from './RequestsChart.js';
import { FailedCallsChart } from './FailedCallsChart.js';
import { colors } from '../theme/colors.js';

interface DashboardProps {
  snapshot: MetricsSnapshot | null;
  error: string | null;
  width: number;
}

export function Dashboard({ snapshot, error, width }: DashboardProps) {
  if (!snapshot) {
    return (
      <Box paddingX={1}>
        <Text color={colors.up}><Spinner type="dots" /></Text>
        <Text color={colors.muted}> Connecting to {process.env['API_URL'] ?? 'http://localhost:3000'}…</Text>
        {error && <Text color={colors.danger}>  {error}</Text>}
      </Box>
    );
  }

  const routes = [...snapshot.routes].sort((a, b) => b.tps - a.tps);

  return (
    <Box flexDirection="column">
      <TitledBox title="REQUESTS/SEC BY ENDPOINT" width={width}>
        <Box flexDirection="column">
          <Box>
            <Box width={8}><Text bold color={colors.muted}>METHOD</Text></Box>
            <Box width={28}><Text bold color={colors.muted}>ROUTE</Text></Box>
            <Box width={10}><Text bold color={colors.muted}>TPS</Text></Box>
            <Box width={10}><Text bold color={colors.muted}>TOTAL</Text></Box>
            <Box width={10}><Text bold color={colors.muted}>FAILED</Text></Box>
          </Box>
          {routes.length === 0 && (
            <Text color={colors.muted} dimColor>No requests recorded yet.</Text>
          )}
          {routes.map((r) => (
            <Box key={`${r.method} ${r.route}`}>
              <Box width={8}><Text color={colors.secondary}>{r.method}</Text></Box>
              <Box width={28}><Text>{r.route}</Text></Box>
              <Box width={10}><Text color={colors.up}>{r.tps.toFixed(2)}</Text></Box>
              <Box width={10}><Text>{r.total}</Text></Box>
              <Box width={10}>
                <Text color={r.failed > 0 ? colors.danger : colors.muted}>{r.failed}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      </TitledBox>
      <RequestsChart series={snapshot.totalCallsSeries} width={width} />
      <FailedCallsChart series={snapshot.failedCallsSeries} width={width} />
      {error && <Text color={colors.danger}>Metrics error: {error}</Text>}
    </Box>
  );
}
