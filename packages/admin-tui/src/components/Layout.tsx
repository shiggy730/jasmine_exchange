import React from 'react';
import { Box } from 'ink';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <Box flexDirection="column" padding={0}>
      {children}
    </Box>
  );
}
