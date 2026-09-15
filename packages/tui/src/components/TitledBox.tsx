import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

interface TitledBoxProps {
  /** Text embedded in the top border left: ╭─ TITLE ─── */
  title: string;
  /** Optional label anchored to the right side of the top border: ─── label ─╮ */
  rightLabel?: string;
  /** Total outer width in terminal columns, including the ╭ ╮ corner chars */
  width: number;
  children?: React.ReactNode;
  borderColor?: string;
  titleColor?: string;
  flexDirection?: 'row' | 'column';
}

export function TitledBox({
  title,
  rightLabel,
  width,
  children,
  borderColor = colors.border,
  titleColor = colors.title,
  flexDirection = 'column',
}: TitledBoxProps) {
  // ╭─ TITLE ────────── rightLabel ─╮
  // 3 + T + 1+M + (R+4 with label | 1 without) = width
  const T = title.length;
  const R = rightLabel ? rightLabel.length : 0;
  const overhead = rightLabel ? T + R + 8 : T + 5;
  const middleDashes = Math.max(1, width - overhead);
  const middle = '─'.repeat(middleDashes);
  const bottomLine = `╰${'─'.repeat(width - 2)}╯`;

  return (
    <Box flexDirection="column">
      {/* Top border */}
      <Box>
        <Text color={borderColor}>{'╭─ '}</Text>
        <Text color={titleColor} bold>{title}</Text>
        <Text color={borderColor}>{` ${middle}`}</Text>
        {rightLabel ? (
          <>
            <Text color={colors.muted}>{` ${rightLabel} `}</Text>
            <Text color={borderColor}>{'─╮'}</Text>
          </>
        ) : (
          <Text color={borderColor}>{'╮'}</Text>
        )}
      </Box>
      {/* Content (optional — header uses no content between borders) */}
      {children !== undefined && (
        <Box flexDirection={flexDirection} paddingX={1}>
          {children}
        </Box>
      )}
      {/* Bottom border */}
      <Text color={borderColor}>{bottomLine}</Text>
    </Box>
  );
}
