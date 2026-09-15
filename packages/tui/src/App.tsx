import React, { useState } from 'react';
import type { Player } from '@jasmine-exchange/shared';
import { LoginScreen } from './components/LoginScreen.js';
import { MarketApp } from './components/MarketApp.js';

export function App() {
  const [player, setPlayer] = useState<Player | null>(null);

  if (!player) {
    return <LoginScreen onLogin={setPlayer} />;
  }

  return <MarketApp initialPlayer={player} />;
}
