import React from 'react';
import { Box, Text } from 'ink';
import type { Plant } from '@jasmine-exchange/shared';
import { TitledBox } from './TitledBox.js';
import { colors } from '../theme/colors.js';

// Braille bit masks — "filled bar" style, bottom to top:
// Left column dots (7,3,2,1) → bits 6,2,1,0
// Right column dots (8,6,5,4) → bits 7,5,4,3
const LEFT_DOT  = [0x40, 0x04, 0x02, 0x01]; // level 0=bottom … 3=top
const RIGHT_DOT = [0x80, 0x20, 0x10, 0x08];

interface ColorRun { chars: string; color: string }

/**
 * Maps a price to a 0–3 braille level relative to prevDayClose.
 * prevDayClose → level 2 (second from top, symmetric split at 1.5).
 */
function priceLevel(price: number, prevDayClose: number, maxDev: number): number {
  const diff = price - prevDayClose;
  return Math.min(3, Math.max(0, Math.round(1.5 + (diff / maxDev) * 1.5)));
}

/**
 * Build a braille line chart anchored to prevDayClose.
 * Each terminal column represents TWO data points (left/right braille column).
 * Color is green above prevDayClose, red below, neutral at exactly equal.
 */
function buildBrailleChart(
  prices: number[],
  prevDayClose: number,
  charWidth: number,
): ColorRun[] {
  // Take last charWidth*2 prices (each char covers 2 data points)
  const data = prices.slice(-(charWidth * 2));
  if (data.length === 0) return [];

  const maxDev = Math.max(1, ...data.map((p) => Math.abs(p - prevDayClose)));

  const runs: ColorRun[] = [];
  for (let i = 0; i < data.length; i += 2) {
    const lp = data[i]!;
    const rp = data[i + 1] ?? lp; // pad last char if odd count

    const ll = priceLevel(lp, prevDayClose, maxDev);
    const rl = priceLevel(rp, prevDayClose, maxDev);
    const char = String.fromCodePoint(0x2800 + LEFT_DOT[ll]! | RIGHT_DOT[rl]!);

    // Color by average of the two prices in this character
    const avg = (lp + rp) / 2;
    const color =
      avg > prevDayClose ? colors.up : avg < prevDayClose ? colors.down : colors.neutral;

    const last = runs[runs.length - 1];
    if (last && last.color === color) {
      last.chars += char;
    } else {
      runs.push({ chars: char, color });
    }
  }
  return runs;
}

interface PriceChartProps {
  plant: Plant;
  /** Total outer width of the TitledBox (including ╭ ╮). */
  width: number;
}

export function PriceChart({ plant, width }: PriceChartProps) {
  const prices = plant.priceHistory.map((p) => p.price);
  const prevDayClose = plant.prevDayClose;

  // Inner chart character width: subtract TitledBox padding (2 × paddingX=1)
  const charWidth = Math.max(4, width - 2);

  if (prices.length < 2) {
    const title = `${plant.ticker}  ${plant.name}  ${plant.currentPrice}g`;
    return (
      <TitledBox title={title} width={width}>
        <Text color={colors.muted} dimColor>Waiting for first trades…</Text>
      </TitledBox>
    );
  }

  const window = prices.slice(-charWidth * 2);
  const min = Math.min(...window);
  const max = Math.max(...window);
  const last = window[window.length - 1]!;

  const delta = prevDayClose !== null ? last - prevDayClose : null;
  const deltaColor =
    delta === null ? colors.neutral
    : delta > 0 ? colors.up
    : delta < 0 ? colors.down
    : colors.neutral;

  const deltaStr =
    delta !== null ? (delta >= 0 ? '+' : '') + String(delta) + 'g' : '';

  const title = [
    plant.ticker,
    plant.name,
    `${last}g`,
    deltaStr ? deltaStr : null,
    prevDayClose !== null ? `prev ${prevDayClose}g` : null,
  ]
    .filter(Boolean)
    .join('  ');

  const runs =
    prevDayClose !== null
      ? buildBrailleChart(prices, prevDayClose, charWidth)
      : [{ chars: '⣀'.repeat(charWidth), color: colors.neutral }];

  return (
    <TitledBox title={title} width={width} titleColor={deltaColor}>
      <Box>
        {runs.map((run, i) => (
          <Text key={i} color={run.color}>{run.chars}</Text>
        ))}
      </Box>
      <Text color={colors.muted} dimColor>{`lo ${min}g  hi ${max}g`}</Text>
    </TitledBox>
  );
}
