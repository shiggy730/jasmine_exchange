import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Plant } from '@jasmine-exchange/shared';
import { plantRepo } from '../db.js';
import { colors } from '../theme/colors.js';
import { TitledBox } from './TitledBox.js';

interface PlantEditPanelProps {
  plant: Plant;
  width: number;
  onClose: (changed: boolean) => void;
}

export function PlantEditPanel({ plant, width, onClose }: PlantEditPanelProps) {
  const priceRef = useRef(String(plant.currentPrice));
  const [priceDisplay, setPriceDisplay] = useState(String(plant.currentPrice));
  const [error, setError] = useState<string | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleInput = useCallback((input: string, key: { return: boolean; escape: boolean; backspace: boolean; delete: boolean; ctrl: boolean; meta: boolean; tab: boolean }) => {
    if (key.escape) {
      onCloseRef.current(false);
      return;
    }
    if (key.return) {
      if (!/^\d+$/.test(priceRef.current)) {
        setError('Digits only — no letters or symbols');
        return;
      }
      const price = parseInt(priceRef.current, 10);
      if (price <= 0) {
        setError('Price must be at least 1g');
        return;
      }
      plantRepo.updatePrice(plant.id, price, Date.now());
      onCloseRef.current(true);
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
  }, [plant.id]);

  useInput(handleInput);

  return (
    <TitledBox title={`EDIT PRICE — ${plant.ticker} ${plant.name}`} width={width} borderColor={colors.primary}>
      <Text>
        {'Current: '}
        <Text color={colors.gold}>{plant.currentPrice}g</Text>
      </Text>
      <Box marginTop={1}>
        <Text>{'New price: '}</Text>
        <Text color={colors.primary}>{'['}{priceDisplay}{'_]'}</Text>
      </Box>
      <Text color={colors.muted} dimColor>
        Updates current_price and appends a price_history point. [Enter] confirm  [Esc] cancel
      </Text>
      {error && <Text color={colors.danger}>{error}</Text>}
    </TitledBox>
  );
}
