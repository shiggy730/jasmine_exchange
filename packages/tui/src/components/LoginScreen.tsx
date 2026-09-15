import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Player } from '@jasmine-exchange/shared';
import { api } from '../api/client.js';
import { Layout } from './Layout.js';
import { colors } from '../theme/colors.js';

interface LoginScreenProps {
  onLogin: (player: Player) => void;
}

type Step = 'select' | 'name' | 'password' | 'new-password';
type Mode = 'login' | 'signup' | 'change-password';

const MODES: Mode[] = ['login', 'signup', 'change-password'];
const MODE_LABEL: Record<Mode, string> = {
  login: 'Log in',
  signup: 'Sign up',
  'change-password': 'Change password',
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const stepRef = useRef<Step>('select');
  const [step, setStep] = useState<Step>('select');

  const modeIndexRef = useRef(0);
  const [modeIndex, setModeIndex] = useState(0);

  // Keep typed text in refs so the handler closure never goes stale.
  // setDisplay is called only to push updates to the render output.
  const nameRef = useRef('');
  const [nameDisplay, setNameDisplay] = useState('');
  const passwordRef = useRef('');
  const [passwordDisplay, setPasswordDisplay] = useState('');
  const newPasswordRef = useRef('');
  const [newPasswordDisplay, setNewPasswordDisplay] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;

  // useCallback with only stable deps → same function reference across renders
  // → useInput registers the listener exactly once, not on every keystroke.
  const handleInput = useCallback(
    (input: string, key: {
      return: boolean; backspace: boolean; delete: boolean;
      ctrl: boolean; meta: boolean; escape: boolean; tab: boolean;
      upArrow: boolean; downArrow: boolean;
    }) => {
      if (submittingRef.current) return;

      if (stepRef.current === 'select') {
        if (key.upArrow) {
          modeIndexRef.current = (modeIndexRef.current - 1 + MODES.length) % MODES.length;
          setModeIndex(modeIndexRef.current);
          return;
        }
        if (key.downArrow) {
          modeIndexRef.current = (modeIndexRef.current + 1) % MODES.length;
          setModeIndex(modeIndexRef.current);
          return;
        }
        if (key.return) {
          stepRef.current = 'name';
          setStep('name');
          setError(null);
          return;
        }
        return;
      }

      if (stepRef.current === 'name') {
        if (key.escape) {
          stepRef.current = 'select';
          setStep('select');
          setError(null);
          return;
        }
        if (key.return) {
          if (!nameRef.current.trim()) return;
          stepRef.current = 'password';
          setStep('password');
          setError(null);
          return;
        }
        if (key.backspace || key.delete) {
          nameRef.current = nameRef.current.slice(0, -1);
          setNameDisplay(nameRef.current);
          return;
        }
        if (input && input.length === 1 && !key.ctrl && !key.meta && !key.escape && !key.tab) {
          nameRef.current += input;
          setNameDisplay(nameRef.current);
        }
        return;
      }

      if (stepRef.current === 'password') {
        if (key.escape) {
          stepRef.current = 'name';
          setStep('name');
          passwordRef.current = '';
          setPasswordDisplay('');
          setError(null);
          return;
        }
        if (key.return) {
          if (!passwordRef.current) return;
          const mode = MODES[modeIndexRef.current]!;

          if (mode === 'change-password') {
            stepRef.current = 'new-password';
            setStep('new-password');
            setError(null);
            return;
          }

          const name = nameRef.current.trim();
          const password = passwordRef.current;

          submittingRef.current = true;
          setSubmitting(true);
          setError(null);

          const call = mode === 'login' ? api.login(name, password) : api.signup(name, password);
          call
            .then(({ player, token }) => {
              api.setAuthToken(token);
              onLoginRef.current(player);
            })
            .catch((err) => {
              submittingRef.current = false;
              setSubmitting(false);
              setError(
                err instanceof Error
                  ? err.message
                  : 'Could not reach server — make sure `npm run dev:server` is running.',
              );
            });
          return;
        }
        if (key.backspace || key.delete) {
          passwordRef.current = passwordRef.current.slice(0, -1);
          setPasswordDisplay(passwordRef.current);
          return;
        }
        if (input && input.length === 1 && !key.ctrl && !key.meta && !key.escape && !key.tab) {
          passwordRef.current += input;
          setPasswordDisplay(passwordRef.current);
        }
        return;
      }

      // stepRef.current === 'new-password'
      if (key.escape) {
        stepRef.current = 'password';
        setStep('password');
        newPasswordRef.current = '';
        setNewPasswordDisplay('');
        setError(null);
        return;
      }
      if (key.return) {
        if (!newPasswordRef.current) return;
        const name = nameRef.current.trim();
        const currentPassword = passwordRef.current;
        const newPassword = newPasswordRef.current;

        submittingRef.current = true;
        setSubmitting(true);
        setError(null);

        api
          .changePassword(name, currentPassword, newPassword)
          .then(({ player, token }) => {
            api.setAuthToken(token);
            onLoginRef.current(player);
          })
          .catch((err) => {
            submittingRef.current = false;
            setSubmitting(false);
            setError(
              err instanceof Error
                ? err.message
                : 'Could not reach server — make sure `npm run dev:server` is running.',
            );
          });
        return;
      }
      if (key.backspace || key.delete) {
        newPasswordRef.current = newPasswordRef.current.slice(0, -1);
        setNewPasswordDisplay(newPasswordRef.current);
        return;
      }
      if (input && input.length === 1 && !key.ctrl && !key.meta && !key.escape && !key.tab) {
        newPasswordRef.current += input;
        setNewPasswordDisplay(newPasswordRef.current);
      }
    },
    [],
  );

  useInput(handleInput);

  const mode = MODES[modeIndex]!;

  return (
    <Layout>
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={colors.primary}
        paddingX={2}
        paddingY={1}
      >
        <Text bold color={colors.primary}>
          Welcome to Jasmine Exchange
        </Text>

        {step === 'select' && (
          <>
            <Text>New traders start with 500g. Returning traders keep their balance.</Text>
            <Box marginTop={1} flexDirection="column">
              {MODES.map((m, i) => (
                <Text key={m} color={i === modeIndex ? colors.primary : undefined}>
                  {i === modeIndex ? '› ' : '  '}
                  {MODE_LABEL[m]}
                </Text>
              ))}
            </Box>
            <Text dimColor>[↑↓] select  [Enter] continue</Text>
          </>
        )}

        {step === 'name' && (
          <>
            <Text dimColor>{MODE_LABEL[mode]}</Text>
            <Box marginTop={1}>
              <Text>Name: </Text>
              <Text>
                {nameDisplay}
                <Text inverse> </Text>
              </Text>
            </Box>
            <Text dimColor>[Enter] continue  [Esc] back</Text>
          </>
        )}

        {step === 'password' && (
          <>
            <Text dimColor>
              {MODE_LABEL[mode]} — {nameRef.current}
            </Text>
            <Box marginTop={1}>
              <Text>{mode === 'change-password' ? 'Current password: ' : 'Password: '}</Text>
              {submitting ? (
                <Text color={colors.muted}>
                  {mode === 'login' ? 'Logging in...' : 'Creating account...'}
                </Text>
              ) : (
                <Text>
                  {'•'.repeat(passwordDisplay.length)}
                  <Text inverse> </Text>
                </Text>
              )}
            </Box>
            {!submitting && (
              <Text dimColor>
                [Enter] {mode === 'login' ? 'log in' : mode === 'signup' ? 'sign up' : 'continue'}  [Esc] back
              </Text>
            )}
          </>
        )}

        {step === 'new-password' && (
          <>
            <Text dimColor>
              {MODE_LABEL[mode]} — {nameRef.current}
            </Text>
            <Box marginTop={1}>
              <Text>New password: </Text>
              {submitting ? (
                <Text color={colors.muted}>Changing password...</Text>
              ) : (
                <Text>
                  {'•'.repeat(newPasswordDisplay.length)}
                  <Text inverse> </Text>
                </Text>
              )}
            </Box>
            {!submitting && <Text dimColor>[Enter] change password  [Esc] back</Text>}
          </>
        )}

        {error && <Text color={colors.danger}>{error}</Text>}
      </Box>
    </Layout>
  );
}
