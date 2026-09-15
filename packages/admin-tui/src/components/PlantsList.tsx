import React from 'react';
import { Box, Text } from 'ink';
import type { Plant } from '@jasmine-exchange/shared';
import { TitledBox } from './TitledBox.js';
import { colors } from '../theme/colors.js';

interface PlantsListProps {
  plants: Plant[];
  selectedIndex: number;
  scrollOffset: number;
  visibleCount: number;
  width: number;
}

export function PlantsList({ plants, selectedIndex, scrollOffset, visibleCount, width }: PlantsListProps) {
  const visible = plants.slice(scrollOffset, scrollOffset + visibleCount);

  return (
    <TitledBox title={`PLANTS (${plants.length})`} width={width}>
      <Box flexDirection="column">
        <Box>
          <Box width={10}><Text bold color={colors.muted}>TICKER</Text></Box>
          <Box width={20}><Text bold color={colors.muted}>NAME</Text></Box>
          <Box width={12}><Text bold color={colors.muted}>PRICE</Text></Box>
        </Box>
        {visible.map((p, i) => {
          const idx = scrollOffset + i;
          const active = idx === selectedIndex;
          return (
            <Box key={p.id}>
              <Box width={10}>
                <Text color={active ? colors.primary : colors.secondary} inverse={active}>
                  {p.ticker}
                </Text>
              </Box>
              <Box width={20}><Text>{p.name}</Text></Box>
              <Box width={12}><Text color={colors.gold}>{p.currentPrice}g</Text></Box>
            </Box>
          );
        })}
      </Box>
    </TitledBox>
  );
}
