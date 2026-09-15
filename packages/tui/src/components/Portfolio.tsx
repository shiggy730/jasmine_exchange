import React from 'react';
import { Box, Text } from 'ink';
import type { Plant } from '@jasmine-exchange/shared';
import type { Portfolio as PortfolioType } from '@jasmine-exchange/shared';
import { TitledBox } from './TitledBox.js';
import { colors } from '../theme/colors.js';

interface PortfolioProps {
  portfolio: PortfolioType;
  plants: Plant[];
  goldBalance: number;
  selectedIndex: number;
  isActive: boolean;
  scrollOffset: number;
  visibleCount: number;
  width: number;
}

export function Portfolio({
  portfolio,
  plants,
  goldBalance,
  selectedIndex,
  isActive,
  scrollOffset,
  visibleCount,
  width,
}: PortfolioProps) {
  const holdings = Object.entries(portfolio)
    .filter(([, count]) => count > 0)
    .map(([plantId, count]) => {
      const plant = plants.find((p) => p.id === plantId);
      return { plant, count };
    })
    .filter((h): h is { plant: Plant; count: number } => h.plant !== undefined);

  const total = holdings.length;
  const visible = holdings.slice(scrollOffset, scrollOffset + visibleCount);
  const showUp = scrollOffset > 0;
  const showDown = scrollOffset + visibleCount < total;

  let rightLabel: string | undefined;
  if (total > visibleCount) {
    const end = Math.min(scrollOffset + visibleCount, total);
    rightLabel = `${showUp ? '↑ ' : ''}${scrollOffset + 1}–${end} / ${total}${showDown ? ' ↓' : ''}`;
  }

  return (
    <TitledBox title="PORTFOLIO" rightLabel={rightLabel} width={width}>
      {isActive && (
        <Text color={colors.muted} dimColor>
          [↑↓] scroll  [Esc] back
        </Text>
      )}
      <Box>
        <Text color={colors.muted}>Gold: </Text>
        <Text color={colors.gold}>{goldBalance}g</Text>
      </Box>
      {holdings.length === 0 ? (
        <Text color={colors.muted} dimColor>No seeds held</Text>
      ) : (
        visible.map(({ plant, count }, i) => {
          const absIndex = scrollOffset + i;
          const isSel = isActive && absIndex === selectedIndex;
          return (
            <Box key={plant.id}>
              <Text color={isSel ? colors.primary : undefined} bold={isSel}>
                {isSel ? '> ' : '  '}
              </Text>
              <Text color={colors.secondary} bold>{plant.ticker.padEnd(5)}</Text>
              <Text color={colors.muted}>{String(count).padStart(4)}x</Text>
              <Text color={colors.gold}>{`  ${plant.currentPrice * count}g`}</Text>
            </Box>
          );
        })
      )}
      {!isActive && holdings.length > 0 && (
        <Text color={colors.muted} dimColor>[p] browse</Text>
      )}
    </TitledBox>
  );
}
