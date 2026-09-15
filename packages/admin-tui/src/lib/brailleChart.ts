// Same Braille bit-mask technique as the player TUI's PriceChart — "filled bar"
// style, bottom to top. See packages/tui/src/components/PriceChart.tsx. That one
// centers on prevDayClose (up/down); this is a plain linear min/max volume scale,
// shared by every chart in this package (requests/sec, failed calls, ...).
const LEFT_DOT  = [0x40, 0x04, 0x02, 0x01]; // level 0=bottom … 3=top
const RIGHT_DOT = [0x80, 0x20, 0x10, 0x08];

export interface ColorRun { chars: string; color: string }

function level(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(3, Math.max(0, Math.round((value / max) * 3)));
}

/**
 * Builds a Braille line chart from a plain count/volume series (no centering —
 * just relative magnitude against the window's own max). Each terminal column
 * covers two data points (left/right Braille sub-columns), run-length-grouped
 * by color so Ink renders one <Text> per color run instead of per-character.
 */
export function buildVolumeChart(
  values: number[],
  charWidth: number,
  colorFor: (leftValue: number, rightValue: number) => string,
): ColorRun[] {
  const data = values.slice(-(charWidth * 2));
  if (data.length === 0) return [];

  const max = Math.max(1, ...data);

  const runs: ColorRun[] = [];
  for (let i = 0; i < data.length; i += 2) {
    const lv = data[i]!;
    const rv = data[i + 1] ?? lv;

    const ll = level(lv, max);
    const rl = level(rv, max);
    const char = String.fromCodePoint(0x2800 + LEFT_DOT[ll]! | RIGHT_DOT[rl]!);
    const color = colorFor(lv, rv);

    const last = runs[runs.length - 1];
    if (last && last.color === color) {
      last.chars += char;
    } else {
      runs.push({ chars: char, color });
    }
  }
  return runs;
}
