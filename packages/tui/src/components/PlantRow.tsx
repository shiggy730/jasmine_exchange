import React from 'react';
import { Box, Text } from 'ink';
import type { Plant } from '@jasmine-exchange/shared';
import { colors } from '../theme/colors.js';

interface PlantRowProps {
  plant: Plant;
  isSelected: boolean;
}

function dayChangePct(plant: Plant): number {
  if (plant.prevDayClose === null || plant.prevDayClose === 0) return 0;
  return ((plant.currentPrice - plant.prevDayClose) / plant.prevDayClose) * 100;
}

export function PlantRow({ plant, isSelected }: PlantRowProps) {
  const delta = dayChangePct(plant);
  const deltaStr =
    delta > 0
      ? `^ ${delta.toFixed(2)}%`
      : delta < 0
        ? `v ${Math.abs(delta).toFixed(2)}%`
        : '  0.00%';
  const deltaColor = delta > 0 ? colors.up : delta < 0 ? colors.down : colors.neutral;

  // Merge suffix into the padded string so Ink can't break between number and 'g'
  const lastStr = (String(plant.currentPrice) + 'g').padStart(6);
  const prevStr = (plant.prevDayClose !== null ? String(plant.prevDayClose) + 'g' : '----').padStart(6);
  const bidStr  = (plant.bestBid !== null ? `${plant.bestBid}g` : '----').padStart(7);
  const askStr  = (plant.bestAsk !== null ? `${plant.bestAsk}g` : '----').padStart(7);

  // Total: 2+5+6+6+7+7+9 = 42 chars
  return (
    <Box>
      <Text color={isSelected ? colors.primary : undefined} bold={isSelected}>
        {isSelected ? '> ' : '  '}
      </Text>
      <Text color={colors.secondary} bold>
        {plant.ticker.padEnd(5)}
      </Text>
      <Text color={colors.gold}>{lastStr}</Text>
      <Text color={colors.muted}>{prevStr}</Text>
      <Text color={colors.success}>{bidStr}</Text>
      <Text color={colors.danger}>{askStr}</Text>
      <Text color={deltaColor}>{deltaStr.padStart(9)}</Text>
    </Box>
  );
}
