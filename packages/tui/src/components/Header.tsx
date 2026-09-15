import React from 'react';
import { TitledBox } from './TitledBox.js';
import { colors } from '../theme/colors.js';

function tradingDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

interface HeaderProps {
  playerName: string | null;
  totalValue: number | null;
  prevDayPortfolioValue: number | null;
  width: number;
}

export function Header({ playerName, totalValue, prevDayPortfolioValue, width }: HeaderProps) {
  const delta =
    totalValue !== null && prevDayPortfolioValue !== null
      ? totalValue - prevDayPortfolioValue
      : null;
  const pct =
    delta !== null && prevDayPortfolioValue !== null && prevDayPortfolioValue > 0
      ? (delta / prevDayPortfolioValue) * 100
      : null;

  // Build the right-side label embedded in the top border
  let rightLabel = tradingDate() + ' PT';
  if (playerName && totalValue !== null) {
    const changeStr =
      delta !== null && pct !== null
        ? `  ${delta >= 0 ? '+' : ''}${delta}g (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`
        : '';
    rightLabel += `   ${playerName}  ${totalValue}g${changeStr}`;
  }

  // No children — header is just the two border lines with info embedded
  return (
    <TitledBox
      title="JASMINE EXCHANGE"
      rightLabel={rightLabel}
      width={width}
      borderColor={colors.border}
      titleColor={colors.title}
    />
  );
}
