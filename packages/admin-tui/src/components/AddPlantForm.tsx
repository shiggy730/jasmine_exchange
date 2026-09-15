import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Database from 'better-sqlite3';
import type { Plant } from '@jasmine-exchange/shared';
import { plantRepo } from '../db.js';
import { colors } from '../theme/colors.js';
import { TitledBox } from './TitledBox.js';

type Step = 'name' | 'ticker' | 'price' | 'supply';
const STEP_ORDER: Step[] = ['name', 'ticker', 'price', 'supply'];

interface AddPlantFormProps {
  existingTickers: Set<string>;
  width: number;
  onClose: (added?: Plant) => void;
}

export function AddPlantForm({ existingTickers, width, onClose }: AddPlantFormProps) {
  const stepRef = useRef<Step>('name');
  const [step, setStep] = useState<Step>('name');

  const nameRef = useRef('');
  const [nameDisplay, setNameDisplay] = useState('');
  const tickerRef = useRef('');
  const [tickerDisplay, setTickerDisplay] = useState('');
  const priceRef = useRef('');
  const [priceDisplay, setPriceDisplay] = useState('');
  const supplyRef = useRef('');
  const [supplyDisplay, setSupplyDisplay] = useState('');

  const [error, setError] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const goBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(stepRef.current);
    if (idx === 0) { onCloseRef.current(); return; }
    const prev = STEP_ORDER[idx - 1]!;
    stepRef.current = prev; setStep(prev); setError(null);
  }, []);

  const handleInput = useCallback((input: string, key: { return: boolean; escape: boolean; backspace: boolean; delete: boolean; ctrl: boolean; meta: boolean; tab: boolean }) => {
    if (key.escape) { goBack(); return; }

    if (stepRef.current === 'name') {
      if (key.return) {
        if (!nameRef.current.trim()) return;
        setError(null);
        stepRef.current = 'ticker'; setStep('ticker');
        return;
      }
      if (key.backspace || key.delete) { nameRef.current = nameRef.current.slice(0, -1); setNameDisplay(nameRef.current); return; }
      if (input && input.length === 1 && !key.ctrl && !key.meta && !key.tab) {
        nameRef.current += input; setNameDisplay(nameRef.current);
      }
      return;
    }

    if (stepRef.current === 'ticker') {
      if (key.return) {
        const ticker = tickerRef.current.trim().toUpperCase();
        if (!ticker) return;
        if (existingTickers.has(ticker)) { setError(`Ticker ${ticker} already exists`); return; }
        setError(null);
        stepRef.current = 'price'; setStep('price');
        return;
      }
      if (key.backspace || key.delete) { tickerRef.current = tickerRef.current.slice(0, -1); setTickerDisplay(tickerRef.current); return; }
      if (input && input.length === 1 && !key.ctrl && !key.meta && !key.tab) {
        tickerRef.current += input.toUpperCase(); setTickerDisplay(tickerRef.current);
      }
      return;
    }

    if (stepRef.current === 'price') {
      if (key.return) {
        if (!/^\d+$/.test(priceRef.current)) { setError('Digits only'); return; }
        if (parseInt(priceRef.current, 10) <= 0) { setError('Price must be at least 1g'); return; }
        setError(null);
        stepRef.current = 'supply'; setStep('supply');
        return;
      }
      if (key.backspace || key.delete) { priceRef.current = priceRef.current.slice(0, -1); setPriceDisplay(priceRef.current); return; }
      if (input && input.length === 1 && /[0-9]/.test(input)) { priceRef.current += input; setPriceDisplay(priceRef.current); }
      return;
    }

    // supply
    if (key.return) {
      if (!/^\d+$/.test(supplyRef.current)) { setError('Digits only'); return; }
      const supply = parseInt(supplyRef.current, 10);
      if (supply <= 0) { setError('Total supply must be at least 1'); return; }

      const ticker = tickerRef.current.trim().toUpperCase();
      let plant: Plant;
      try {
        plant = plantRepo.create(nameRef.current.trim(), ticker, parseInt(priceRef.current, 10), supply);
      } catch (err) {
        if (err instanceof Database.SqliteError && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          setError(`Ticker ${ticker} already exists`);
          return;
        }
        throw err;
      }
      onCloseRef.current(plant);
      return;
    }
    if (key.backspace || key.delete) { supplyRef.current = supplyRef.current.slice(0, -1); setSupplyDisplay(supplyRef.current); return; }
    if (input && input.length === 1 && /[0-9]/.test(input)) { supplyRef.current += input; setSupplyDisplay(supplyRef.current); }
  }, [existingTickers, goBack]);

  useInput(handleInput);

  return (
    <TitledBox title="ADD PLANT" width={width} borderColor={colors.success}>
      <Box flexDirection="column">
        <Box>
          <Text>{'Name: '}</Text>
          <Text color={step === 'name' ? colors.primary : undefined}>{nameDisplay || '_'}</Text>
        </Box>
        {STEP_ORDER.indexOf(step) >= 1 && (
          <Box>
            <Text>{'Ticker: '}</Text>
            <Text color={step === 'ticker' ? colors.primary : undefined}>{tickerDisplay || '_'}</Text>
          </Box>
        )}
        {STEP_ORDER.indexOf(step) >= 2 && (
          <Box>
            <Text>{'Initial (last) price: '}</Text>
            <Text color={step === 'price' ? colors.primary : undefined}>{priceDisplay || '_'}g</Text>
          </Box>
        )}
        {STEP_ORDER.indexOf(step) >= 3 && (
          <Box>
            <Text>{'Total supply: '}</Text>
            <Text color={colors.primary}>{supplyDisplay || '_'}</Text>
          </Box>
        )}
      </Box>
      <Text color={colors.muted} dimColor>
        [Enter] continue  [Esc] back{step === 'supply' ? ' — new plants need a server restart to get market-maker liquidity' : ''}
      </Text>
      {error && <Text color={colors.danger}>{error}</Text>}
    </TitledBox>
  );
}
