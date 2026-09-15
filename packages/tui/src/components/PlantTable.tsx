import React from 'react';
import { Box, Text } from 'ink';
import type { Plant } from '@jasmine-exchange/shared';
import { PlantRow } from './PlantRow.js';
import { TitledBox } from './TitledBox.js';
import { colors } from '../theme/colors.js';

interface PlantTableProps {
  plants: Plant[];
  selectedIndex: number;
  scrollOffset: number;
  visibleCount: number;
  width: number;
}

export function PlantTable({ plants, selectedIndex, scrollOffset, visibleCount, width }: PlantTableProps) {
  const total = plants.length;
  const visible = plants.slice(scrollOffset, scrollOffset + visibleCount);
  const showUp = scrollOffset > 0;
  const showDown = scrollOffset + visibleCount < total;

  let rightLabel: string | undefined;
  if (total > visibleCount) {
    const end = Math.min(scrollOffset + visibleCount, total);
    rightLabel = `${showUp ? '↑ ' : ''}${scrollOffset + 1}–${end} / ${total}${showDown ? ' ↓' : ''}`;
  }

  return (
    <TitledBox title="MARKET" rightLabel={rightLabel} width={width}>
      {/* Header row */}
      <Box>
        <Text dimColor>{'  '}</Text>
        <Text dimColor bold>{'TICK'.padEnd(5)}</Text>
        <Text dimColor bold>{'LAST'.padStart(6)}</Text>
        <Text dimColor bold>{'PREV'.padStart(6)}</Text>
        <Text dimColor bold>{'BID'.padStart(7)}</Text>
        <Text dimColor bold>{'ASK'.padStart(7)}</Text>
        <Text dimColor bold>{'CHANGE'.padStart(9)}</Text>
      </Box>
      {visible.map((plant, i) => (
        <PlantRow
          key={plant.id}
          plant={plant}
          isSelected={scrollOffset + i === selectedIndex}
        />
      ))}
    </TitledBox>
  );
}
