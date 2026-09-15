import React from 'react';
import { Box, Text } from 'ink';
import type { Player } from '@jasmine-exchange/shared';
import { TitledBox } from './TitledBox.js';
import { colors } from '../theme/colors.js';

interface PlayersListProps {
  players: Player[];
  selectedIndex: number;
  scrollOffset: number;
  visibleCount: number;
  width: number;
}

export function PlayersList({ players, selectedIndex, scrollOffset, visibleCount, width }: PlayersListProps) {
  const visible = players.slice(scrollOffset, scrollOffset + visibleCount);

  return (
    <TitledBox title={`PLAYERS (${players.length})`} width={width}>
      <Box flexDirection="column">
        <Box>
          <Box width={30}><Text bold color={colors.muted}>NAME</Text></Box>
          <Box width={14}><Text bold color={colors.muted}>GOLD</Text></Box>
          <Box width={12}><Text bold color={colors.muted}>HOLDINGS</Text></Box>
        </Box>
        {players.length === 0 && <Text color={colors.muted} dimColor>No players yet.</Text>}
        {visible.map((p, i) => {
          const idx = scrollOffset + i;
          const active = idx === selectedIndex;
          const holdings = Object.values(p.portfolio).filter((n) => n > 0).length;
          return (
            <Box key={p.id}>
              <Box width={30}>
                <Text color={active ? colors.primary : undefined} inverse={active}>
                  {p.name}
                </Text>
              </Box>
              <Box width={14}><Text color={colors.gold}>{p.goldBalance}g</Text></Box>
              <Box width={12}><Text>{holdings} plant{holdings === 1 ? '' : 's'}</Text></Box>
            </Box>
          );
        })}
      </Box>
    </TitledBox>
  );
}
