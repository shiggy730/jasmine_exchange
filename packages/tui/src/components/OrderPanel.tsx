import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Plant, Player, OrderResult } from '@jasmine-exchange/shared';
import { api } from '../api/client.js';
import { colors } from '../theme/colors.js';

type Mode = 'buy' | 'sell';
type Step = 'price' | 'qty';

interface OrderPanelProps {
  plant: Plant;
  player: Player;
  mode: Mode;
  onClose: (result?: OrderResult) => void;
}

export function OrderPanel({ plant, player, mode, onClose }: OrderPanelProps) {
  const priceRef = useRef(String(plant.currentPrice));
  const qtyRef = useRef('');
  const stepRef = useRef<Step>('price');
  const submittingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [priceDisplay, setPriceDisplay] = useState(String(plant.currentPrice));
  const [qtyDisplay, setQtyDisplay] = useState('');
  const [step, setStep] = useState<Step>('price');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleInput = useCallback(
    (
      input: string,
      key: {
        return: boolean;
        escape: boolean;
        backspace: boolean;
        delete: boolean;
        ctrl: boolean;
        meta: boolean;
        tab: boolean;
      },
    ) => {
      if (submittingRef.current) return;

      if (stepRef.current === 'price') {
        if (key.escape) {
          onCloseRef.current();
          return;
        }
        if (key.return) {
          if (!/^\d+$/.test(priceRef.current)) {
            setError('Digits only — no letters or symbols');
            return;
          }
          const p = parseInt(priceRef.current, 10);
          if (p <= 0) {
            setError('Price must be at least 1g');
            return;
          }
          setError(null);
          stepRef.current = 'qty';
          setStep('qty');
          return;
        }
        if (key.backspace || key.delete) {
          priceRef.current = priceRef.current.slice(0, -1);
          setPriceDisplay(priceRef.current);
          return;
        }
        if (input && input.length === 1 && !key.ctrl && !key.meta && !key.tab) {
          if (/[0-9]/.test(input)) {
            priceRef.current += input;
            setPriceDisplay(priceRef.current);
          }
        }
      } else {
        if (key.escape) {
          stepRef.current = 'price';
          setStep('price');
          setError(null);
          return;
        }
        if (key.return) {
          if (!/^\d+$/.test(qtyRef.current)) {
            setError('Digits only — no letters or symbols');
            return;
          }
          const p = parseInt(priceRef.current, 10);
          const q = parseInt(qtyRef.current, 10);
          if (q <= 0) {
            setError('Quantity must be at least 1');
            return;
          }
          const maxAtPrice =
            mode === 'buy'
              ? Math.floor(player.goldBalance / p)
              : (player.portfolio[plant.id] ?? 0);
          if (q > maxAtPrice) {
            setError(`Max ${mode === 'buy' ? 'affordable' : 'sellable'}: ${maxAtPrice}`);
            return;
          }

          submittingRef.current = true;
          setSubmitting(true);
          setError(null);

          api
            .placeOrder({
              playerId: player.id,
              plantId: plant.id,
              type: mode === 'buy' ? 'bid' : 'ask',
              price: p,
              seedCount: q,
            })
            .then((result) => {
              onCloseRef.current(result);
            })
            .catch((err) => {
              submittingRef.current = false;
              setSubmitting(false);
              setError(err instanceof Error ? err.message : 'Order failed');
            });
          return;
        }
        if (key.backspace || key.delete) {
          qtyRef.current = qtyRef.current.slice(0, -1);
          setQtyDisplay(qtyRef.current);
          return;
        }
        if (input && input.length === 1 && !key.ctrl && !key.meta && !key.tab) {
          if (/[0-9]/.test(input)) {
            qtyRef.current += input;
            setQtyDisplay(qtyRef.current);
          }
        }
      }
    },
    [mode, plant, player],
  );

  useInput(handleInput);

  const isBuy = mode === 'buy';
  const borderColor = isBuy ? colors.success : colors.danger;
  const parsedPrice = parseInt(priceDisplay, 10);
  const parsedQty = parseInt(qtyDisplay, 10);
  const estimatedTotal = !isNaN(parsedPrice) && !isNaN(parsedQty) ? parsedPrice * parsedQty : null;
  const maxAtPrice =
    !isNaN(parsedPrice) && parsedPrice > 0
      ? isBuy
        ? Math.floor(player.goldBalance / parsedPrice)
        : (player.portfolio[plant.id] ?? 0)
      : 0;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1}>
      <Text bold color={borderColor}>
        {isBuy ? 'BUY' : 'SELL'} {plant.ticker} — {plant.name}
      </Text>
      <Text>
        {'Last: '}
        <Text color={colors.gold}>{plant.currentPrice}g</Text>
        {'  |  Best bid: '}
        <Text color={colors.success}>
          {plant.bestBid !== null ? `${plant.bestBid}g` : '----'}
        </Text>
        {'  |  Best ask: '}
        <Text color={colors.danger}>
          {plant.bestAsk !== null ? `${plant.bestAsk}g` : '----'}
        </Text>
      </Text>
      <Text>
        {'Gold: '}
        <Text color={colors.gold}>{player.goldBalance}g</Text>
        {'  |  Seeds held: '}
        <Text>{player.portfolio[plant.id] ?? 0}</Text>
      </Text>

      <Box marginTop={1} flexDirection="column">
        {step === 'price' ? (
          <>
            <Box>
              <Text>{'Price per seed: '}</Text>
              <Text color={colors.primary}>
                {'['}
                {priceDisplay}
                {'_]'}
              </Text>
            </Box>
            <Text color={colors.muted} dimColor>
              [Enter] continue  [Esc] cancel
            </Text>
          </>
        ) : (
          <>
            <Text>
              {'Price: '}
              <Text color={colors.gold}>{priceDisplay}g each</Text>
            </Text>
            <Box>
              <Text>{'Quantity: '}</Text>
              {submitting ? (
                <Text color={colors.muted}>Submitting...</Text>
              ) : (
                <Text color={colors.primary}>
                  {'['}
                  {qtyDisplay || '___'}
                  {'_]'}
                </Text>
              )}
            </Box>
            {qtyDisplay.length > 0 && estimatedTotal !== null && (
              <Text color={colors.muted}>
                Estimated total: {estimatedTotal}g  (max {maxAtPrice} at this price)
              </Text>
            )}
            <Text color={colors.muted} dimColor>
              [Enter] place order  [Esc] back
            </Text>
          </>
        )}
      </Box>

      {error && <Text color={colors.danger}>{error}</Text>}
    </Box>
  );
}
