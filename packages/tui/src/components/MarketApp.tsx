import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import type { Player, OrderResult } from '@jasmine-exchange/shared';
import { useMarket } from '../hooks/useMarket.js';
import { usePlayer } from '../hooks/usePlayer.js';
import { useOrders } from '../hooks/useOrders.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { Layout } from './Layout.js';
import { Header } from './Header.js';
import { PlantTable } from './PlantTable.js';
import { Portfolio } from './Portfolio.js';
import { OpenOrders } from './OpenOrders.js';
import { OrderPanel } from './OrderPanel.js';
import { ResetConfirm } from './ResetConfirm.js';
import { StatusBar } from './StatusBar.js';
import { PriceChart } from './PriceChart.js';
import { colors } from '../theme/colors.js';
import { api } from '../api/client.js';

const RIGHT_WIDTH = 32;

/** Adjusts scroll offset to keep `selected` inside the visible window. */
function clampOffset(selected: number, offset: number, visibleCount: number): number {
  if (selected < offset) return selected;
  if (selected >= offset + visibleCount) return selected - visibleCount + 1;
  return offset;
}

type MarketState =
  | { screen: 'market' }
  | { screen: 'order'; mode: 'buy' | 'sell' }
  | { screen: 'orders' }
  | { screen: 'portfolio' }
  | { screen: 'reset' };

interface MarketAppProps {
  initialPlayer: Player;
}

export function MarketApp({ initialPlayer }: MarketAppProps) {
  const { exit } = useApp();
  const { columns: termCols, rows: termRows } = useTerminalSize();
  const leftWidth = Math.max(46, termCols - RIGHT_WIDTH);

  // Visible row counts derived from terminal height.
  // Left panel: Header(2) + PlantTable borders+colheader(3) + N plants + Chart(4) + StatusBar(2) = 11+N
  const plantVisibleCount = Math.max(3, termRows - 11);
  // Right panel: Portfolio borders+gold(3) + K holdings + Orders borders(2) + M orders = 5+K+M
  // Available right height = termRows - 4 (header + statusbar); overhead = 5 → K+M = termRows-9
  // Subtract 1 for the orders hint/manage row → K+M = termRows-10; split evenly.
  const portfolioVisibleCount = Math.max(3, Math.floor((termRows - 10) / 2));
  const ordersVisibleCount   = Math.max(3, Math.ceil((termRows - 10) / 2));

  const { market, error: marketError } = useMarket();
  const { player, refresh: refreshPlayer } = usePlayer(initialPlayer.id, initialPlayer);
  const { orders, refresh: refreshOrders } = useOrders(initialPlayer.id);

  const [state, setState] = useState<MarketState>({ screen: 'market' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [ordersIndex, setOrdersIndex] = useState(0);
  const [portfolioIndex, setPortfolioIndex] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isStatusError, setIsStatusError] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [ordersScrollOffset, setOrdersScrollOffset] = useState(0);
  const [portfolioScrollOffset, setPortfolioScrollOffset] = useState(0);

  const plants = market?.plants ?? [];
  const portfolio = player?.portfolio ?? {};

  const totalValue = player
    ? player.goldBalance +
      Object.entries(portfolio).reduce((sum, [plantId, count]) => {
        const plant = plants.find((p) => p.id === plantId);
        return sum + (plant?.currentPrice ?? 0) * count;
      }, 0)
    : null;

  const holdingsCount = Object.entries(portfolio).filter(([, count]) => count > 0).length;

  // Stable refs so useCallback handlers never capture stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;
  const plantsRef = useRef(plants);
  plantsRef.current = plants;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const ordersIndexRef = useRef(ordersIndex);
  ordersIndexRef.current = ordersIndex;
  const portfolioIndexRef = useRef(portfolioIndex);
  portfolioIndexRef.current = portfolioIndex;
  const scrollOffsetRef = useRef(scrollOffset);
  scrollOffsetRef.current = scrollOffset;
  const ordersScrollOffsetRef = useRef(ordersScrollOffset);
  ordersScrollOffsetRef.current = ordersScrollOffset;
  const portfolioScrollOffsetRef = useRef(portfolioScrollOffset);
  portfolioScrollOffsetRef.current = portfolioScrollOffset;
  const plantVisibleCountRef = useRef(plantVisibleCount);
  plantVisibleCountRef.current = plantVisibleCount;
  const ordersVisibleCountRef = useRef(ordersVisibleCount);
  ordersVisibleCountRef.current = ordersVisibleCount;
  const portfolioVisibleCountRef = useRef(portfolioVisibleCount);
  portfolioVisibleCountRef.current = portfolioVisibleCount;
  const holdingsCountRef = useRef(holdingsCount);
  holdingsCountRef.current = holdingsCount;

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setIsStatusError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const handleCancelOrder = useCallback(async () => {
    const order = ordersRef.current[ordersIndexRef.current];
    if (!order) return;
    try {
      await api.cancelOrder(order.id);
      const plant = plantsRef.current.find((p) => p.id === order.plantId);
      showStatus(`Cancelled ${order.type.toUpperCase()} ${plant?.ticker ?? ''} order`);
      refreshOrders();
    } catch (err) {
      showStatus(err instanceof Error ? err.message : 'Cancel failed', true);
    }
  }, [showStatus, refreshOrders]);

  useInput(
    useCallback(
      (input, key) => {
        const s = stateRef.current;
        if (s.screen === 'market') {
          if (input === 'q') { exit(); return; }
          if (key.upArrow) {
            const next = Math.max(0, selectedIndexRef.current - 1);
            setSelectedIndex(next);
            setScrollOffset(clampOffset(next, scrollOffsetRef.current, plantVisibleCountRef.current));
          } else if (key.downArrow) {
            const next = Math.min(plantsRef.current.length - 1, selectedIndexRef.current + 1);
            setSelectedIndex(next);
            setScrollOffset(clampOffset(next, scrollOffsetRef.current, plantVisibleCountRef.current));
          } else if (input === 'b') setState({ screen: 'order', mode: 'buy' });
          else if (input === 's') setState({ screen: 'order', mode: 'sell' });
          else if (input === 'o') {
            setOrdersIndex(0);
            setOrdersScrollOffset(0);
            setState({ screen: 'orders' });
          } else if (input === 'p') {
            setPortfolioIndex(0);
            setPortfolioScrollOffset(0);
            setState({ screen: 'portfolio' });
          } else if (input === 'r') {
            setState({ screen: 'reset' });
          }
        } else if (s.screen === 'orders') {
          if (key.escape) { setState({ screen: 'market' }); return; }
          if (key.upArrow) {
            const next = Math.max(0, ordersIndexRef.current - 1);
            setOrdersIndex(next);
            setOrdersScrollOffset(clampOffset(next, ordersScrollOffsetRef.current, ordersVisibleCountRef.current));
          } else if (key.downArrow) {
            const next = Math.min(ordersRef.current.length - 1, ordersIndexRef.current + 1);
            setOrdersIndex(next);
            setOrdersScrollOffset(clampOffset(next, ordersScrollOffsetRef.current, ordersVisibleCountRef.current));
          } else if (input === 'x') { void handleCancelOrder(); }
        } else if (s.screen === 'portfolio') {
          if (key.escape) { setState({ screen: 'market' }); return; }
          if (key.upArrow) {
            const next = Math.max(0, portfolioIndexRef.current - 1);
            setPortfolioIndex(next);
            setPortfolioScrollOffset(clampOffset(next, portfolioScrollOffsetRef.current, portfolioVisibleCountRef.current));
          } else if (key.downArrow) {
            const next = Math.min(holdingsCountRef.current - 1, portfolioIndexRef.current + 1);
            setPortfolioIndex(next);
            setPortfolioScrollOffset(clampOffset(next, portfolioScrollOffsetRef.current, portfolioVisibleCountRef.current));
          }
        }
      },
      [exit, handleCancelOrder],
    ),
  );

  function handleResetClose(updated?: Player) {
    setState({ screen: 'market' });
    if (!updated) return;
    refreshPlayer(updated);
    refreshOrders();
    showStatus('Account reset — 500g, empty portfolio');
  }

  function handleOrderClose(result?: OrderResult) {
    setState({ screen: 'market' });
    if (!result) {
      showStatus('Order cancelled');
      return;
    }
    if (result.status === 'rejected') {
      showStatus(`Order rejected: ${result.reason ?? 'unknown'}`, true);
      return;
    }
    if (result.updatedPlayer) refreshPlayer(result.updatedPlayer);
    refreshOrders();

    const plant = result.order ? plantsRef.current.find((p) => p.id === result.order?.plantId) : null;
    const ticker = plant?.ticker ?? '';

    if (result.status === 'filled' && result.trades && result.trades.length > 0) {
      const totalQty = result.trades.reduce((s, t) => s + t.seedCount, 0);
      const avgPrice = result.trades.reduce((s, t) => s + t.price * t.seedCount, 0) / totalQty;
      showStatus(`Filled: ${totalQty} ${ticker} @ avg ${Math.round(avgPrice)}g`);
    } else if (result.status === 'partially_filled') {
      const filled = result.trades?.reduce((s, t) => s + t.seedCount, 0) ?? 0;
      showStatus(`Partial fill: ${filled} ${ticker} traded, rest resting`);
    } else {
      showStatus(`Order resting: ${result.order?.seedCount ?? 0} ${ticker} @ ${result.order?.price ?? '?'}g`);
    }
  }

  if (!market) {
    return (
      <Layout>
        <Box paddingX={1}>
          <Text color={colors.up}><Spinner type="dots" /></Text>
          <Text color={colors.muted}> Connecting to exchange…</Text>
        </Box>
        {marketError && <Text color={colors.danger}>{marketError}</Text>}
      </Layout>
    );
  }

  const selectedPlant = plants[selectedIndex];
  const isOrdersMode = state.screen === 'orders';
  const isPortfolioMode = state.screen === 'portfolio';

  // Clamp offsets in render to handle list shrinkage between renders.
  const plantScrollClamped = Math.min(scrollOffset, Math.max(0, plants.length - plantVisibleCount));
  const portfolioScrollClamped = Math.min(portfolioScrollOffset, Math.max(0, holdingsCount - portfolioVisibleCount));
  const ordersScrollClamped = Math.min(ordersScrollOffset, Math.max(0, orders.length - ordersVisibleCount));

  if (state.screen === 'order' && selectedPlant && player) {
    return (
      <Layout>
        <Header
          playerName={player.name}
          totalValue={totalValue}
          prevDayPortfolioValue={player.prevDayPortfolioValue}
          width={termCols}
        />
        <OrderPanel
          plant={selectedPlant}
          player={player}
          mode={state.mode}
          onClose={handleOrderClose}
        />
      </Layout>
    );
  }

  if (state.screen === 'reset' && player) {
    return (
      <Layout>
        <Header
          playerName={player.name}
          totalValue={totalValue}
          prevDayPortfolioValue={player.prevDayPortfolioValue}
          width={termCols}
        />
        <ResetConfirm player={player} onClose={handleResetClose} />
      </Layout>
    );
  }

  return (
    <Layout>
      <Header
        playerName={player?.name ?? null}
        totalValue={totalValue}
        prevDayPortfolioValue={player?.prevDayPortfolioValue ?? null}
        width={termCols}
      />
      <Box>
        {/* Left panel — market table + price chart */}
        <Box flexDirection="column" flexGrow={1}>
          <PlantTable
            plants={plants}
            selectedIndex={isOrdersMode || isPortfolioMode ? -1 : selectedIndex}
            scrollOffset={plantScrollClamped}
            visibleCount={plantVisibleCount}
            width={leftWidth}
          />
          {selectedPlant && (
            <PriceChart plant={selectedPlant} width={leftWidth} />
          )}
        </Box>
        {/* Right panel — portfolio + open orders */}
        {player && (
          <Box flexDirection="column" width={RIGHT_WIDTH}>
            <Portfolio
              portfolio={portfolio}
              plants={plants}
              goldBalance={player.goldBalance}
              selectedIndex={portfolioIndex}
              isActive={isPortfolioMode}
              scrollOffset={portfolioScrollClamped}
              visibleCount={portfolioVisibleCount}
              width={RIGHT_WIDTH}
            />
            <OpenOrders
              orders={orders}
              plants={plants}
              selectedIndex={ordersIndex}
              isActive={isOrdersMode}
              scrollOffset={ordersScrollClamped}
              visibleCount={ordersVisibleCount}
              width={RIGHT_WIDTH}
            />
          </Box>
        )}
      </Box>
      {marketError && (
        <Box paddingX={1}>
          <Text color={colors.danger}>Market error: {marketError}</Text>
        </Box>
      )}
      <StatusBar
        message={statusMsg}
        isError={isStatusError}
        screen={state.screen}
        width={termCols}
      />
    </Layout>
  );
}
