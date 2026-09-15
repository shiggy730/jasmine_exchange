import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Database from 'better-sqlite3';
import { hashPassword } from '@jasmine-exchange/server/domain/auth';
import { playerRepo } from '../db.js';
import { colors } from '../theme/colors.js';
import { TitledBox } from './TitledBox.js';

type Step = 'name' | 'gold' | 'password';

interface AddPlayerFormProps {
  width: number;
  onClose: (changed: boolean) => void;
}

export function AddPlayerForm({ width, onClose }: AddPlayerFormProps) {
  const stepRef = useRef<Step>('name');
  const [step, setStep] = useState<Step>('name');

  const nameRef = useRef('');
  const [nameDisplay, setNameDisplay] = useState('');
  const goldRef = useRef('500');
  const [goldDisplay, setGoldDisplay] = useState('500');
  const passwordRef = useRef('');
  const [passwordDisplay, setPasswordDisplay] = useState('');

  const [error, setError] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleInput = useCallback((input: string, key: { return: boolean; escape: boolean; backspace: boolean; delete: boolean; ctrl: boolean; meta: boolean; tab: boolean }) => {
    if (key.escape) {
      if (stepRef.current === 'name') { onCloseRef.current(false); return; }
      if (stepRef.current === 'gold') { stepRef.current = 'name'; setStep('name'); setError(null); return; }
      stepRef.current = 'gold'; setStep('gold'); setError(null); return;
    }

    if (stepRef.current === 'name') {
      if (key.return) {
        const name = nameRef.current.trim();
        if (!name) return;
        if (playerRepo.findByName(name)) { setError('Name already taken'); return; }
        setError(null);
        stepRef.current = 'gold'; setStep('gold');
        return;
      }
      if (key.backspace || key.delete) { nameRef.current = nameRef.current.slice(0, -1); setNameDisplay(nameRef.current); return; }
      if (input && input.length === 1 && !key.ctrl && !key.meta && !key.tab) {
        nameRef.current += input; setNameDisplay(nameRef.current);
      }
      return;
    }

    if (stepRef.current === 'gold') {
      if (key.return) {
        if (!/^\d+$/.test(goldRef.current)) { setError('Digits only'); return; }
        setError(null);
        stepRef.current = 'password'; setStep('password');
        return;
      }
      if (key.backspace || key.delete) { goldRef.current = goldRef.current.slice(0, -1); setGoldDisplay(goldRef.current); return; }
      if (input && input.length === 1 && /[0-9]/.test(input)) {
        goldRef.current += input; setGoldDisplay(goldRef.current);
      }
      return;
    }

    // password step
    if (key.return) {
      if (!passwordRef.current) { setError('Password cannot be empty'); return; }
      const name = nameRef.current.trim();
      const gold = parseInt(goldRef.current, 10);
      const hash = hashPassword(passwordRef.current);
      try {
        playerRepo.create(name, gold, hash);
      } catch (err) {
        if (err instanceof Database.SqliteError && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          setError('Name already taken');
          return;
        }
        throw err;
      }
      onCloseRef.current(true);
      return;
    }
    if (key.backspace || key.delete) { passwordRef.current = passwordRef.current.slice(0, -1); setPasswordDisplay(passwordRef.current); return; }
    if (input && input.length === 1 && !key.ctrl && !key.meta && !key.tab) {
      passwordRef.current += input; setPasswordDisplay(passwordRef.current);
    }
  }, []);

  useInput(handleInput);

  return (
    <TitledBox title="ADD PLAYER" width={width} borderColor={colors.success}>
      <Box flexDirection="column">
        <Box>
          <Text>{'Name: '}</Text>
          <Text color={step === 'name' ? colors.primary : undefined}>{nameDisplay || '_'}</Text>
        </Box>
        {(step === 'gold' || step === 'password') && (
          <Box>
            <Text>{'Starting gold: '}</Text>
            <Text color={step === 'gold' ? colors.primary : undefined}>{goldDisplay}g</Text>
          </Box>
        )}
        {step === 'password' && (
          <Box>
            <Text>{'Password: '}</Text>
            <Text color={colors.primary}>{'•'.repeat(passwordDisplay.length) || '_'}</Text>
          </Box>
        )}
      </Box>
      <Text color={colors.muted} dimColor>[Enter] continue  [Esc] back</Text>
      {error && <Text color={colors.danger}>{error}</Text>}
    </TitledBox>
  );
}
