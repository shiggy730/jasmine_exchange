import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

interface StatusBarProps {
  message: string | null;
  isError: boolean;
  screen: 'market' | 'order' | 'orders' | 'portfolio' | 'reset';
  width: number;
}

const HELP: Record<string, string> = {
  market:    '[↑↓] navigate  [b] buy  [s] sell  [o] orders  [p] portfolio  [r] reset  [q] quit',
  order:     '[Enter] confirm  [Esc] cancel',
  orders:    '[↑↓] navigate  [x] cancel order  [Esc] back',
  portfolio: '[↑↓] scroll  [Esc] back',
  reset:     '[y] confirm reset  [n/Esc] cancel',
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
