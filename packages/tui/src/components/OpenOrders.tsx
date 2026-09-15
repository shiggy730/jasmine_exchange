import React from 'react';
import { Box, Text } from 'ink';
import type { Order, Plant } from '@jasmine-exchange/shared';
import { TitledBox } from './TitledBox.js';
import { colors } from '../theme/colors.js';

interface OpenOrdersProps {
  orders: Order[];
  plants: Plant[];
  selectedIndex: number;
  isActive: boolean;
  scrollOffset: number;
  visibleCount: number;
  width: number;
}

export function OpenOrders({ orders, plants, selectedIndex, isActive, scrollOffset, visibleCount, width }: OpenOrdersProps) {
  const tickerOf = (plantId: string) =>
    plants.find((p) => p.id === plantId)?.ticker ?? '???';

  const total = orders.length;
  const visible = orders.slice(scrollOffset, scrollOffset + visibleCount);
  const showUp = scrollOffset > 0;
  const showDown = scrollOffset + visibleCount < total;

  let rightLabel: string | undefined;
  if (total > visibleCount) {
    const end = Math.min(scrollOffset + visibleCount, total);
    rightLabel = `${showUp ? '↑ ' : ''}${scrollOffset + 1}–${end} / ${total}${showDown ? ' ↓' : ''}`;
  }

  return (
    <TitledBox title="OPEN ORDERS" rightLabel={rightLabel} width={width}>
      {isActive && (
        <Text color={colors.muted} dimColor>
          [↑↓] select  [x] cancel  [Esc] back
        </Text>
      )}
      {orders.length === 0 ? (
        <Text color={colors.muted} dimColor>No open orders</Text>
      ) : (
        visible.map((order, i) => {
          const absIndex = scrollOffset + i;
          const isSel = isActive && absIndex === selectedIndex;
          const remaining = order.seedCount - order.filledCount;
          const filled = order.filledCount > 0 ? ` (${order.filledCount}✓)` : '';
          const isBid = order.type === 'bid';
          return (
            <Box key={order.id}>
              <Text color={isSel ? colors.primary : undefined} bold={isSel}>
                {isSel ? '> ' : '  '}
              </Text>
              <Text color={isBid ? colors.success : colors.danger} bold>
                {order.type.toUpperCase()}
              </Text>
              <Text> {tickerOf(order.plantId)} </Text>
              <Text>{String(remaining).padStart(3)}</Text>
              <Text color={colors.muted}>@</Text>
              <Text color={colors.gold}>{order.price}g</Text>
              {order.filledCount > 0 && (
                <Text color={colors.muted} dimColor>{filled}</Text>
              )}
            </Box>
          );
        })
      )}
      {!isActive && orders.length > 0 && (
        <Text color={colors.muted} dimColor>[o] manage</Text>
      )}
    </TitledBox>
  );
}
