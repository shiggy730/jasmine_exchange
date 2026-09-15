import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

interface StatusBarProps {
  message: string | null;
  isError: boolean;
  screen: 'dashboard' | 'players' | 'plants';
  width: number;
}

const HELP: Record<string, string> = {
  dashboard: '[Tab] admin mode  [q] quit',
  players:   '[↑↓] navigate  [Enter] edit  [n] new player  [k] plants  [Tab] dashboard  [q] quit',
  plants:    '[↑↓] navigate  [Enter] edit price  [n] new plant  [u] players  [Tab] dashboard  [q] quit',
};

export function StatusBar({ message, isError, screen, width }: StatusBarProps) {
  const sep = '─'.repeat(Math.max(0, width - 2));
  return (
    <Box flexDirection="column">
      <Text color={colors.border}>{` ${sep}`}</Text>
      <Box paddingX={1}>
        {message ? (
          <Text color={isError ? colors.danger : colors.up}>{message}</Text>
        ) : (
          <Text color={colors.muted} dimColor>{HELP[screen]}</Text>
        )}
      </Box>
    </Box>
  );
}
