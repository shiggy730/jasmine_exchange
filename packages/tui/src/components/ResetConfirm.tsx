import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Player } from '@jasmine-exchange/shared';
import { api } from '../api/client.js';
import { colors } from '../theme/colors.js';

interface ResetConfirmProps {
  player: Player;
  onClose: (updatedPlayer?: Player) => void;
}

export function ResetConfirm({ player, onClose }: ResetConfirmProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleInput = useCallback(
    (input: string, key: { escape: boolean }) => {
      if (submittingRef.current) return;

      if (input === 'y' || input === 'Y') {
        submittingRef.current = true;
        setSubmitting(true);
        setError(null);
        api
          .resetPlayer(player.id)
          .then((updated) => onCloseRef.current(updated))
          .catch((err) => {
            submittingRef.current = false;
            setSubmitting(false);
            setError(err instanceof Error ? err.message : 'Reset failed');
          });
        return;
      }
      if (input === 'n' || input === 'N' || key.escape) {
        onCloseRef.current();
      }
    },
    [player.id],
  );

  useInput(handleInput);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.danger} paddingX={1}>
      <Text bold color={colors.danger}>
        Reset account?
      </Text>
      <Text>
        This sets your gold back to <Text color={colors.gold}>500g</Text> and clears your entire
        portfolio and open orders.
      </Text>
      <Text color={colors.danger}>This cannot be undone.</Text>
      <Box marginTop={1}>
        {submitting ? (
          <Text color={colors.muted}>Resetting...</Text>
        ) : (
          <Text color={colors.muted} dimColor>
            [y] confirm reset  [n/Esc] cancel
          </Text>
        )}
      </Box>
      {error && <Text color={colors.danger}>{error}</Text>}
    </Box>
  );
}
