import React, { useState, useCallback, useRef } from 'react';
import { Box, useApp, useInput } from 'ink';
import type { Player, Plant } from '@jasmine-exchange/shared';
import { playerRepo, plantRepo } from './db.js';
import { useMetrics } from './hooks/useMetrics.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { Layout } from './components/Layout.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { Dashboard } from './components/Dashboard.js';
import { PlayersList } from './components/PlayersList.js';
import { PlantsList } from './components/PlantsList.js';
import { PlayerEditPanel } from './components/PlayerEditPanel.js';
import { AddPlayerForm } from './components/AddPlayerForm.js';
import { PlantEditPanel } from './components/PlantEditPanel.js';
import { AddPlantForm } from './components/AddPlantForm.js';

function clampOffset(selected: number, offset: number, visibleCount: number): number {
  if (selected < offset) return selected;
  if (selected >= offset + visibleCount) return selected - visibleCount + 1;
  return offset;
}

type Screen =
  | { screen: 'dashboard' }
  | { screen: 'players' }
  | { screen: 'player-edit'; playerId: string }
  | { screen: 'add-player' }
  | { screen: 'plants' }
  | { screen: 'plant-edit'; plantId: string }
  | { screen: 'add-plant' };

const LIST_VISIBLE_COUNT = 15;

export function App() {
  const { exit } = useApp();
  const { columns: termCols } = useTerminalSize();
  const width = Math.max(60, termCols);

  const [state, setState] = useState<Screen>({ screen: 'dashboard' });
  const [players, setPlayers] = useState<Player[]>(() => playerRepo.getAll());
  const [plants, setPlants] = useState<Plant[]>(() => plantRepo.getAll());

  const [playerIndex, setPlayerIndex] = useState(0);
  const [playerOffset, setPlayerOffset] = useState(0);
  const [plantIndex, setPlantIndex] = useState(0);
  const [plantOffset, setPlantOffset] = useState(0);

  const refreshPlayers = useCallback(() => setPlayers(playerRepo.getAll()), []);
  const refreshPlants = useCallback(() => setPlants(plantRepo.getAll()), []);

  const stateRef = useRef(state);
  stateRef.current = state;
  const playersRef = useRef(players);
  playersRef.current = players;
  const playerIndexRef = useRef(playerIndex);
  playerIndexRef.current = playerIndex;
  const playerOffsetRef = useRef(playerOffset);
  playerOffsetRef.current = playerOffset;
  const plantIndexRef = useRef(plantIndex);
  plantIndexRef.current = plantIndex;
  const plantOffsetRef = useRef(plantOffset);
  plantOffsetRef.current = plantOffset;

  const { snapshot, error: metricsError } = useMetrics(state.screen === 'dashboard');

  useInput(
    useCallback(
      (input, key) => {
        const s = stateRef.current;

        if (key.tab) {
          setState(s.screen === 'dashboard' ? { screen: 'players' } : { screen: 'dashboard' });
          return;
        }

        if (s.screen === 'dashboard') {
          if (input === 'q') exit();
          return;
        }

        if (s.screen === 'players') {
          if (input === 'q') { exit(); return; }
          if (input === 'k') { setState({ screen: 'plants' }); return; }
          if (input === 'n') { setState({ screen: 'add-player' }); return; }
          if (key.upArrow) {
            const next = Math.max(0, playerIndexRef.current - 1);
            setPlayerIndex(next);
            setPlayerOffset(clampOffset(next, playerOffsetRef.current, LIST_VISIBLE_COUNT));
          } else if (key.downArrow) {
            const next = Math.min(playersRef.current.length - 1, playerIndexRef.current + 1);
            setPlayerIndex(next);
            setPlayerOffset(clampOffset(next, playerOffsetRef.current, LIST_VISIBLE_COUNT));
          } else if (key.return) {
            const p = playersRef.current[playerIndexRef.current];
            if (p) setState({ screen: 'player-edit', playerId: p.id });
          }
          return;
        }

        if (s.screen === 'plants') {
          if (input === 'q') { exit(); return; }
          if (input === 'u') { setState({ screen: 'players' }); return; }
          if (input === 'n') { setState({ screen: 'add-plant' }); return; }
          if (key.upArrow) {
            const next = Math.max(0, plantIndexRef.current - 1);
            setPlantIndex(next);
            setPlantOffset(clampOffset(next, plantOffsetRef.current, LIST_VISIBLE_COUNT));
          } else if (key.downArrow) {
            const next = Math.min(plants.length - 1, plantIndexRef.current + 1);
            setPlantIndex(next);
            setPlantOffset(clampOffset(next, plantOffsetRef.current, LIST_VISIBLE_COUNT));
          } else if (key.return) {
            const p = plants[plantIndexRef.current];
            if (p) setState({ screen: 'plant-edit', plantId: p.id });
          }
          return;
        }

        // player-edit / add-player / plant-edit: handled entirely by the mounted panel's own useInput
      },
      [exit, plants],
    ),
  );

  if (state.screen === 'player-edit') {
    return (
      <Layout>
        <Header mode="crud" width={width} />
        <PlayerEditPanel
          playerId={state.playerId}
          plants={plants}
          width={width}
          onClose={(changed) => {
            if (changed) refreshPlayers();
            setState({ screen: 'players' });
          }}
        />
      </Layout>
    );
  }

  if (state.screen === 'add-player') {
    return (
      <Layout>
        <Header mode="crud" width={width} />
        <AddPlayerForm
          width={width}
          onClose={(changed) => {
            if (changed) refreshPlayers();
            setState({ screen: 'players' });
          }}
        />
      </Layout>
    );
  }

  if (state.screen === 'add-plant') {
    return (
      <Layout>
        <Header mode="crud" width={width} />
        <AddPlantForm
          existingTickers={new Set(plants.map((p) => p.ticker))}
          width={width}
          onClose={(added) => {
            if (added) refreshPlants();
            setState({ screen: 'plants' });
          }}
        />
      </Layout>
    );
  }

  if (state.screen === 'plant-edit') {
    const plant = plants.find((p) => p.id === state.plantId);
    if (!plant) {
      // Unreachable in practice — plantId only ever comes from this same `plants` array,
      // and there's no delete-plant flow. Fall back to the list rather than update state mid-render.
      return (
        <Layout>
          <Header mode="crud" width={width} />
          <PlantsList
            plants={plants}
            selectedIndex={plantIndex}
            scrollOffset={plantOffset}
            visibleCount={LIST_VISIBLE_COUNT}
            width={width}
          />
        </Layout>
      );
    }
    return (
      <Layout>
        <Header mode="crud" width={width} />
        <PlantEditPanel
          plant={plant}
          width={width}
          onClose={() => setState({ screen: 'plants' })}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <Header mode={state.screen === 'dashboard' ? 'dashboard' : 'crud'} width={width} />
      <Box>
        {state.screen === 'dashboard' && (
          <Dashboard snapshot={snapshot} error={metricsError} width={width} />
        )}
        {state.screen === 'players' && (
          <PlayersList
            players={players}
            selectedIndex={playerIndex}
            scrollOffset={playerOffset}
            visibleCount={LIST_VISIBLE_COUNT}
            width={width}
          />
        )}
        {state.screen === 'plants' && (
          <PlantsList
            plants={plants}
            selectedIndex={plantIndex}
            scrollOffset={plantOffset}
            visibleCount={LIST_VISIBLE_COUNT}
            width={width}
          />
        )}
      </Box>
      <StatusBar
        message={null}
        isError={false}
        screen={state.screen === 'dashboard' ? 'dashboard' : state.screen === 'players' ? 'players' : 'plants'}
        width={width}
      />
    </Layout>
  );
}
