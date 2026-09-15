import React, { useState, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Player, Plant } from '@jasmine-exchange/shared';
import Database from 'better-sqlite3';
import { hashPassword } from '@jasmine-exchange/server/domain/auth';
import { db, playerRepo, sessionRepo, dailyRepo, orderRepo, tradeRepo } from '../db.js';
import { colors } from '../theme/colors.js';
import { TitledBox } from './TitledBox.js';

type Step = 'view' | 'edit-gold' | 'pick-plant' | 'edit-seed' | 'reset-password' | 'remove-confirm' | 'remove-blocked';

function clampOffset(selected: number, offset: number, visibleCount: number): number {
  if (selected < offset) return selected;
  if (selected >= offset + visibleCount) return selected - visibleCount + 1;
  return offset;
}

interface PlayerEditPanelProps {
  playerId: string;
  plants: Plant[];
  width: number;
  onClose: (changed: boolean) => void;
}

export function PlayerEditPanel({ playerId, plants, width, onClose }: PlayerEditPanelProps) {
  const [player, setPlayer] = useState<Player | null>(() => playerRepo.findById(playerId));
  const refresh = useCallback(() => setPlayer(playerRepo.findById(playerId)), [playerId]);

  const stepRef = useRef<Step>('view');
  const [step, setStep] = useState<Step>('view');

  const goldRef = useRef('');
  const [goldDisplay, setGoldDisplay] = useState('');

  const [plantPickIndex, setPlantPickIndex] = useState(0);
  const [plantPickOffset, setPlantPickOffset] = useState(0);
  const pickedPlantRef = useRef<Plant | null>(null);

  const seedRef = useRef('');
  const [seedDisplay, setSeedDisplay] = useState('');

  const passwordRef = useRef('');
  const [passwordDisplay, setPasswordDisplay] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [blockedOrderCount, setBlockedOrderCount] = useState(0);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const playerRef = useRef(player);
  playerRef.current = player;

  const toView = useCallback(() => {
    stepRef.current = 'view';
    setStep('view');
    setError(null);
  }, []);

  const plantVisibleCount = 10;

  const handleInput = useCallback(
    (
      input: string,
      key: { return: boolean; escape: boolean; backspace: boolean; delete: boolean; ctrl: boolean; meta: boolean; tab: boolean; upArrow: boolean; downArrow: boolean },
    ) => {
      const p = playerRef.current;
      setNotice(null);

      if (stepRef.current === 'view') {
        if (key.escape) { onCloseRef.current(true); return; }
        if (!p) return;
        if (input === 'g') {
          goldRef.current = String(p.goldBalance);
          setGoldDisplay(goldRef.current);
          stepRef.current = 'edit-gold'; setStep('edit-gold'); setError(null);
        } else if (input === 's') {
          setPlantPickIndex(0); setPlantPickOffset(0);
          stepRef.current = 'pick-plant'; setStep('pick-plant'); setError(null);
        } else if (input === 'r') {
          passwordRef.current = ''; setPasswordDisplay('');
          stepRef.current = 'reset-password'; setStep('reset-password'); setError(null);
        } else if (input === 'd') {
          stepRef.current = 'remove-confirm'; setStep('remove-confirm'); setError(null);
        }
        return;
      }

      if (stepRef.current === 'edit-gold') {
        if (key.escape) { toView(); return; }
        if (key.return) {
          if (!/^\d+$/.test(goldRef.current)) { setError('Digits only'); return; }
          const newValue = parseInt(goldRef.current, 10);
          const delta = newValue - (p?.goldBalance ?? 0);
          playerRepo.updateGold(playerId, delta);
          refresh();
          setNotice(`Gold set to ${newValue}g`);
          toView();
          return;
        }
        if (key.backspace || key.delete) { goldRef.current = goldRef.current.slice(0, -1); setGoldDisplay(goldRef.current); return; }
        if (input && input.length === 1 && /[0-9]/.test(input)) { goldRef.current += input; setGoldDisplay(goldRef.current); }
        return;
      }

      if (stepRef.current === 'pick-plant') {
        if (key.escape) { toView(); return; }
        if (key.upArrow) {
          const next = Math.max(0, plantPickIndex - 1);
          setPlantPickIndex(next);
          setPlantPickOffset(clampOffset(next, plantPickOffset, plantVisibleCount));
        } else if (key.downArrow) {
          const next = Math.min(plants.length - 1, plantPickIndex + 1);
          setPlantPickIndex(next);
          setPlantPickOffset(clampOffset(next, plantPickOffset, plantVisibleCount));
        } else if (key.return) {
          const plant = plants[plantPickIndex];
          if (!plant) return;
          pickedPlantRef.current = plant;
          seedRef.current = String(p?.portfolio[plant.id] ?? 0);
          setSeedDisplay(seedRef.current);
          stepRef.current = 'edit-seed'; setStep('edit-seed'); setError(null);
        }
        return;
      }

      if (stepRef.current === 'edit-seed') {
        if (key.escape) { toView(); return; }
        if (key.return) {
          if (!/^\d+$/.test(seedRef.current)) { setError('Digits only'); return; }
          const plant = pickedPlantRef.current;
          if (!plant) { toView(); return; }
          const newValue = parseInt(seedRef.current, 10);
          const current = p?.portfolio[plant.id] ?? 0;
          playerRepo.updatePortfolio(playerId, plant.id, newValue - current);
          refresh();
          setNotice(`${plant.ticker} holding set to ${newValue}`);
          toView();
          return;
        }
        if (key.backspace || key.delete) { seedRef.current = seedRef.current.slice(0, -1); setSeedDisplay(seedRef.current); return; }
        if (input && input.length === 1 && /[0-9]/.test(input)) { seedRef.current += input; setSeedDisplay(seedRef.current); }
        return;
      }

      if (stepRef.current === 'reset-password') {
        if (key.escape) { toView(); return; }
        if (key.return) {
          if (!passwordRef.current) { setError('Password cannot be empty'); return; }
          const hash = hashPassword(passwordRef.current);
          playerRepo.setPasswordHash(playerId, hash);
          sessionRepo.deleteAllForPlayer(playerId);
          setNotice('Password reset — existing sessions invalidated');
          toView();
          return;
        }
        if (key.backspace || key.delete) { passwordRef.current = passwordRef.current.slice(0, -1); setPasswordDisplay(passwordRef.current); return; }
        if (input && input.length === 1 && !key.ctrl && !key.meta && !key.tab) { passwordRef.current += input; setPasswordDisplay(passwordRef.current); }
        return;
      }

      if (stepRef.current === 'remove-confirm') {
        if (input === 'y' || input === 'Y') {
          try {
            // Atomic: if delete() throws (real orders/trades on record), the sessions/
            // portfolio/history clears above must roll back too — otherwise a *failed*
            // removal would still silently wipe the player's real holdings and history.
            const removePlayer = db.transaction(() => {
              sessionRepo.deleteAllForPlayer(playerId);
              playerRepo.clearPortfolio(playerId);
              dailyRepo.clearPortfolioHistory(playerId);
              playerRepo.delete(playerId);
            });
            removePlayer();
          } catch (err) {
            if (err instanceof Database.SqliteError && err.code.startsWith('SQLITE_CONSTRAINT')) {
              const tradeCount = tradeRepo.countByPlayer(playerId);
              // Don't use toView() here — it also clears `error`, and since these are
              // batched into the same render, its setError(null) would run after (and
              // silently wipe) the message below.
              if (tradeCount > 0) {
                stepRef.current = 'view';
                setStep('view');
                setError(
                  `Cannot remove — ${tradeCount} trade${tradeCount === 1 ? '' : 's'} on record. ` +
                    `A trade belongs to two players, not just this one, so it can't be force-deleted here.`,
                );
                return;
              }
              // Blocked by this player's own orders only — safe to offer a force option,
              // since an order has exactly one owner (unlike a trade).
              setBlockedOrderCount(orderRepo.countByPlayer(playerId));
              stepRef.current = 'remove-blocked';
              setStep('remove-blocked');
              return;
            }
            throw err;
          }
          onCloseRef.current(true);
          return;
        }
        if (input === 'n' || input === 'N' || key.escape) { toView(); }
        return;
      }

      if (stepRef.current === 'remove-blocked') {
        if (input === 'f' || input === 'F') {
          try {
            const forceRemove = db.transaction(() => {
              sessionRepo.deleteAllForPlayer(playerId);
              playerRepo.clearPortfolio(playerId);
              dailyRepo.clearPortfolioHistory(playerId);
              orderRepo.deleteAllForPlayer(playerId);
              playerRepo.delete(playerId);
            });
            forceRemove();
          } catch (err) {
            if (err instanceof Database.SqliteError && err.code.startsWith('SQLITE_CONSTRAINT')) {
              stepRef.current = 'view';
              setStep('view');
              setError('Cannot force-remove — this player now also has trades on record.');
              return;
            }
            throw err;
          }
          onCloseRef.current(true);
          return;
        }
        if (input === 'n' || input === 'N' || key.escape) { toView(); }
        return;
      }
    },
    [playerId, plants, plantPickIndex, plantPickOffset, refresh, toView],
  );

  useInput(handleInput);

  if (!player) {
    return (
      <TitledBox title="PLAYER NOT FOUND" width={width} borderColor={colors.danger}>
        <Text color={colors.danger}>This player no longer exists.</Text>
        <Text color={colors.muted} dimColor>[Esc] back</Text>
      </TitledBox>
    );
  }

  const holdings = Object.entries(player.portfolio).filter(([, n]) => n > 0);

  return (
    <TitledBox title={`PLAYER — ${player.name}`} width={width} borderColor={colors.primary}>
      <Box flexDirection="column">
        <Text>
          {'Gold: '}<Text color={colors.gold}>{player.goldBalance}g</Text>
        </Text>
        <Text bold color={colors.muted}>Holdings:</Text>
        {holdings.length === 0 && <Text color={colors.muted} dimColor>  none</Text>}
        {holdings.map(([plantId, count]) => {
          const plant = plants.find((pl) => pl.id === plantId);
          return <Text key={plantId}>  {plant?.ticker ?? plantId}: {count}</Text>;
        })}

        {step === 'edit-gold' && (
          <Box marginTop={1}>
            <Text>{'New gold balance: '}</Text>
            <Text color={colors.primary}>{'['}{goldDisplay}{'_]'}</Text>
          </Box>
        )}

        {step === 'pick-plant' && (
          <Box marginTop={1} flexDirection="column">
            <Text bold color={colors.muted}>Pick a plant to edit seed holding:</Text>
            {plants.slice(plantPickOffset, plantPickOffset + plantVisibleCount).map((pl, i) => {
              const idx = plantPickOffset + i;
              const active = idx === plantPickIndex;
              return (
                <Text key={pl.id} color={active ? colors.primary : undefined} inverse={active}>
                  {pl.ticker} — {pl.name} (holds {player.portfolio[pl.id] ?? 0})
                </Text>
              );
            })}
          </Box>
        )}

        {step === 'edit-seed' && pickedPlantRef.current && (
          <Box marginTop={1}>
            <Text>{`New ${pickedPlantRef.current.ticker} seed count: `}</Text>
            <Text color={colors.primary}>{'['}{seedDisplay}{'_]'}</Text>
          </Box>
        )}

        {step === 'reset-password' && (
          <Box marginTop={1}>
            <Text>{'New password: '}</Text>
            <Text color={colors.primary}>{'•'.repeat(passwordDisplay.length) || '_'}</Text>
          </Box>
        )}

        {step === 'remove-confirm' && (
          <Box marginTop={1} flexDirection="column">
            <Text bold color={colors.danger}>Remove {player.name}? This cannot be undone.</Text>
            <Text color={colors.muted} dimColor>Fails if this player has orders/trades on record.</Text>
          </Box>
        )}

        {step === 'remove-blocked' && (
          <Box marginTop={1} flexDirection="column">
            <Text bold color={colors.danger}>
              Blocked by {blockedOrderCount} order{blockedOrderCount === 1 ? '' : 's'} on record.
            </Text>
            <Text color={colors.muted} dimColor>An order belongs only to this player, so</Text>
            <Text color={colors.muted} dimColor>force-remove can safely delete their orders too.</Text>
            <Text color={colors.muted} dimColor>(Trades belong to two players and are never</Text>
            <Text color={colors.muted} dimColor>force-deleted — if trades are also blocking this,</Text>
            <Text color={colors.muted} dimColor>force-remove will fail and tell you.)</Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={colors.muted} dimColor>
          {step === 'view' && '[g] edit gold  [s] edit seeds  [r] reset password  [d] remove  [Esc] back'}
          {step === 'edit-gold' && '[Enter] confirm  [Esc] cancel'}
          {step === 'pick-plant' && '[↑↓] select  [Enter] edit  [Esc] cancel'}
          {step === 'edit-seed' && '[Enter] confirm  [Esc] cancel'}
          {step === 'reset-password' && '[Enter] confirm  [Esc] cancel'}
          {step === 'remove-confirm' && '[y] confirm remove  [n/Esc] cancel'}
          {step === 'remove-blocked' && '[f] force remove (also deletes their orders)  [n/Esc] cancel'}
        </Text>
      </Box>
      {notice && <Text color={colors.up}>{notice}</Text>}
      {error && <Text color={colors.danger}>{error}</Text>}
    </TitledBox>
  );
}
