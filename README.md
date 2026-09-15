# Jasmine Exchange

A stock exchange simulation game where players trade plant seeds using gold as currency, on a real limit order book alongside automated market-maker and noise-trader bots. Prices move only from actual trades: each plant's market-maker bot requotes a fresh bid/ask around the last price roughly every 6 seconds, and noise-trader bots periodically buy/sell at market — so price movement reflects order flow, not a scripted drift.

## Prerequisites

- Node.js 18+
- npm 7+ (workspaces support)

## Setup

```bash
cd jasmine_exchange
npm install
```

## Running

### Both server and TUI together

```bash
npm run dev
```

### Individually

```bash
# Terminal 1 — REST API server (port 3000)
npm run dev:server

# Terminal 2 — Terminal UI client
npm run dev:tui

# Terminal 3 (optional) — admin/operational TUI, see "Admin/operational TUI" below
npm run dev:admin
```

## First run

When the TUI starts, you'll be asked to **Log in**, **Sign up**, or **Change password** (`↑`/`↓` to choose, **Enter** to continue), then to enter a name and password. Signing up with a name that's already taken is rejected — pick a different one. A brand-new account starts with a balance of **500 gold**; logging in restores an existing account exactly as you left it. Change password asks for your name, current password, then new password, and logs you straight in with the new one on success — it also invalidates any other active sessions for that account.

Once in the market view:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Select a plant |
| `b` | Buy seeds of the selected plant |
| `s` | Sell seeds of the selected plant |
| `o` | View / cancel your open orders |
| `p` | View your portfolio |
| `r` | Reset your account back to 500g and an empty portfolio (asks for confirmation) |
| `q` | Quit |

Inside the buy/sell panel, type a price in gold and press **Enter** to move to the quantity step, type a quantity and press **Enter** to place the order, or **Esc** to go back a step / cancel. The orders and portfolio screens use `↑`/`↓` to navigate and `Esc` to return to the market; the orders screen also has `x` to cancel the selected order.

## API (server only)

The server runs at `http://localhost:3000`. `/plants` and `/trades` are public/read-only. Every other route requires an `Authorization: Bearer <token>` header from `/players/signup` or `/players/login` — a request for or about another player's data (wrong id in the URL/body, an order you don't own) is rejected with `403`, and a missing/invalid token with `401`.

```bash
# All plants + best bid/ask (public)
curl http://localhost:3000/plants

# Single plant with full price history (public)
curl http://localhost:3000/plants/<id>

# Create a new account — fails 409 if the name is already taken
curl -X POST http://localhost:3000/players/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "password": "correct-horse-battery-staple"}'

# Log in to an existing account — both return { player, token }
curl -X POST http://localhost:3000/players/login \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "password": "correct-horse-battery-staple"}'

# Change password — verifies currentPassword like a login, then sets newPassword,
# invalidates existing sessions, and returns a fresh { player, token }
curl -X POST http://localhost:3000/players/change-password \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "currentPassword": "correct-horse-battery-staple", "newPassword": "another-fine-passphrase"}'

# Player details (only your own — requires your token)
curl http://localhost:3000/players/<id> -H "Authorization: Bearer <token>"

# Reset a player to a fresh 500g / empty-portfolio state (cancels open orders too)
curl -X POST http://localhost:3000/players/<id>/reset \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{}'

# Place a limit order — type is "bid" (buy) or "ask" (sell); playerId must be your own
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"playerId": "<id>", "plantId": "<id>", "type": "bid", "price": 12, "seedCount": 5}'

# Your own open orders
curl http://localhost:3000/orders -H "Authorization: Bearer <token>"

# Cancel an open order you own
curl -X DELETE http://localhost:3000/orders/<orderId> -H "Authorization: Bearer <token>"

# Recent trades (public, supports ?plantId=, ?limit=, ?offset=)
curl "http://localhost:3000/trades?limit=20"
```

## Admin/operational TUI

`packages/admin-tui` (`npm run dev:admin`) is a second Ink TUI, styled to match the player one, meant to run on the same machine as the server/database. It has no login of its own — being able to run it on that machine is the trust boundary — and two modes, toggled with **Tab**:

**Dashboard** (default) — polls `GET /admin/metrics` (~1.5s) for a per-route TPS table plus two Braille sparklines over the last 5 minutes: total requests/sec (to spot a traffic spike that might warrant scaling) and failed calls. Both charts are built from the same 1-second-bucketed history the server already tracks per route — the requests/sec chart just wasn't exposed at first. That endpoint is guarded to loopback callers only (`127.0.0.1`/`::1`) — not real auth, just a sanity backstop appropriate for a read-only, zero-mutation endpoint. **"Failed" means HTTP status ≥ 400** — order rejections (insufficient gold/seeds) return `200` with a `{status: 'rejected'}` body, so they never show up here; that chart is about auth/request failures and server errors, not business-logic rejections.

**Admin mode** (`u` players / `k` plants from either list) — browse every player (bots included) or plant, edit gold/seed holdings (`g`/`s`), reset a password (`r`, also invalidates that player's existing sessions), remove a player (`d`), or add a new player (`n`). Selecting a plant lets you overwrite its price directly, which updates `current_price` and appends a `price_history` point exactly like a real trade would; `n` on the plants list adds a brand-new plant (name, ticker, initial/last price, total supply), rejecting a ticker that's already taken. **A new plant won't get market-maker liquidity until the server restarts** — `BotEngine` only spins up a market maker per plant once, at server boot (`initBots()`), so a plant added while the server is already running sits with no bid/ask until the next restart; the form's hint says so.

**Removing a player** tries a plain delete first. If they have orders or trades on record, it's blocked, and what happens next depends on *which*: an **order** belongs to exactly one player, so if orders are the only thing blocking it, you're offered `[f]` **force remove**, which deletes those orders too before removing the account. A **trade** belongs to two players (buyer and seller) — deleting it would silently erase it from the *other* party's history as well, so trades are never force-deleted; if a player has any, removal (forced or not) stays blocked and says so. There's deliberately no cascade-delete of trades and no soft-delete/`is_disabled` flag — this keeps the boundary simple: an account with only its own leftover orders can always be cleaned up, an account with real trading history never gets silently gutted.

Unlike the player app, this tool talks to SQLite **directly** — its own `better-sqlite3` connection to the same `jasmine.db`, reusing the server's own repository classes (`@jasmine-exchange/server/repositories/*`, `domain/auth`) via an explicit `exports` map in `packages/server/package.json`, rather than a new HTTP API. That's why edits are careful to reuse the existing safe primitives instead of raw `UPDATE`s: gold/seed edits compute a delta and go through `updateGold()`/`updatePortfolio()` (both already `= x + delta`, never a blind `SET`) so they can't silently clobber a concurrent trade from the live server process; removing a player wraps clearing sessions/portfolio/`daily_portfolio_values` and the final `DELETE` in **one transaction**, so a removal that fails partway (because the player turns out to have real orders/trades) rolls back completely instead of leaving the account's current holdings wiped while the account itself survives — an actual bug caught during testing, not a hypothetical. It never runs migrations itself (that's the server's job); it fails loudly on startup if the schema looks stale rather than silently operating against it.

The [concurrency appendix](#appendix-concurrency-notes) above is specifically about two things happening inside *one* Node process — this tool is a second, independent process/connection, so that reasoning doesn't extend to it. It's protected the same way any two independent writers to a WAL-mode SQLite file are: SQLite's own locking, plus this tool's edits being delta-based rather than blind overwrites.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```
PORT=3000              # server port
PRICE_HISTORY_CAP=100  # max price points returned per plant in a single API response
```

`DB_PATH` is also read from the environment (defaults to `packages/server/jasmine.db`) if you need to point the server at a different SQLite file.

## Plants

| Name | Ticker | Start Price | Total Supply | MM Spread |
|------|--------|-------------:|--------------:|-----------:|
| Jasmine | JSM | 12g | 10,000 | 2.0% |
| Saffron | SFR | 95g | 2,000 | 4.0% |
| Vanilla | VNL | 45g | 5,000 | 3.0% |
| Lotus | LTS | 22g | 8,000 | 2.5% |
| Lavender | LVD | 9g | 15,000 | 1.5% |
| Ginseng | GNG | 60g | 3,000 | 3.5% |
| Orchid | ORC | 35g | 6,000 | 4.0% |
| Turmeric | TRM | 5g | 20,000 | 1.0% |
| Marigold | MRG | 3g | 28,000 | 0.8% |
| Hibiscus | HBS | 8g | 18,000 | 1.5% |
| Azalea | AZL | 14g | 11,000 | 2.0% |
| Gardenia | GDN | 17g | 9,000 | 2.0% |
| Rose | ROS | 19g | 8,500 | 2.5% |
| Satsuki | SAT | 21g | 7,500 | 3.0% |
| Chrysanthemum | CHR | 26g | 7,000 | 2.5% |
| Camellia | CAM | 29g | 6,000 | 3.0% |
| Wisteria | WST | 33g | 5,500 | 3.5% |
| Dahlia | DHL | 40g | 4,500 | 3.0% |
| Magnolia | MGL | 50g | 4,000 | 3.5% |
| Peony | PNY | 58g | 3,200 | 4.0% |

"MM Spread" is how far each plant's market-maker bot quotes its bid/ask from the last trade price — a rough proxy for how tight/volatile that plant's market is.

## Database & migrations

The server stores everything in a single SQLite file (`packages/server/jasmine.db` by default, WAL mode). On every boot, `getDb()` (`packages/server/src/db/database.ts`) runs two things:

1. The base `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` schema — safe to run every time, since it no-ops against tables that already exist. This is how brand-new tables/indexes and newly appended plants (`INITIAL_PLANTS` in `packages/shared/src/constants/seed-data.ts`) show up without touching existing data.
2. Any pending entries in `packages/server/src/db/migrations/index.ts`, applied in ascending `version` order, each inside its own transaction, each recorded in a `schema_migrations` table so it never runs twice.

**When you need a migration vs. just a restart:** pure code changes (routes, matching logic, bot behavior, config) only need a restart. A migration is only required when you're changing the *shape* of an existing table — a new/renamed column, a changed type or constraint, a dropped column, etc. — because `CREATE TABLE IF NOT EXISTS` can't alter a table that already exists. Removing/renaming an existing plant ticker in `INITIAL_PLANTS` also needs care for the same reason (`seedPlants()` upserts by ticker, so a rename creates an orphaned duplicate rather than updating the row).

**Writing one:** add an entry to the `migrations` array in `packages/server/src/db/migrations/index.ts`. The file's header comment has two worked examples — a plain `ALTER TABLE ADD COLUMN` for additive changes, and the create-new-table/copy-data/drop/rename pattern SQLite requires for anything ALTER TABLE can't do directly (changing a column's type or constraints, dropping a column, changing a primary key).

**Deploying one — the operator's actual workflow:**

```bash
# 1. Snapshot the real db — the live server runs in WAL mode, so a plain `cp` of
#    jasmine.db can silently miss recent writes sitting in the -wal file and hand
#    you an inconsistent copy. Use sqlite3's own (WAL-safe) backup command instead:
sqlite3 packages/server/jasmine.db ".backup '/tmp/jasmine-test.db'"

# 2. Test the migration against that snapshot first
DB_PATH=/tmp/jasmine-test.db npm run dev:server   # confirm it boots clean, Ctrl-C

# 3. Back up the live db the same WAL-safe way, timestamped
sqlite3 packages/server/jasmine.db ".backup 'packages/server/jasmine.db.bak-$(date +%s)'"

# 4. Deploy the new code and restart the server as usual — migrate() runs automatically on boot
```

If a migration throws, its transaction rolls back and the process should fail to boot rather than come up half-migrated — restore the step-3 backup and fix the migration rather than pushing through. There are deliberately no `down()` migrations; for a single self-hosted database at this scale, "restore the file backup" is the rollback story.

**A sharper version of the same lesson, if you run the server locally with `tsx watch` (as `npm run dev:server` does):** that process watches the source tree and hot-restarts on every save — including edits to `migrations/index.ts` itself. There is no "just trying it out" edit; the moment you save a new entry in that file while a watch process is pointed at the real `jasmine.db`, it *is* a deployment, against the real database, immediately. If you want to experiment with a migration without committing to running it for real, either point `DB_PATH` at a snapshot for that whole session (`DB_PATH=/tmp/jasmine-test.db npm run dev:server`, not the default `npm run dev`) or stop the watching process first. And because version numbers are permanent once anything applies them — even an experiment applied to the live db by accident — never reuse one; bump forward and leave a comment explaining why the number was skipped.

Deleting `jasmine.db` and starting over should now be a last resort for genuinely unrecoverable states, not the routine way to ship a schema change.

## Data retention

Three tables record price/trade activity over time, and they're treated differently:

- **`trades`** — every executed trade (buyer, seller, price, quantity). Rows older than **`config.dataRetentionMs`** (14 days) are deleted.
- **`price_history`** — one row per trade execution, the tick-level feed behind each plant's intraday price chart. Same **14-day** retention as `trades`.
- **`daily_plant_prices`** — one row per plant per trading day, snapshotted at day rollover by `DayRoller`. This is what powers the `prevDayClose`/**PREV** column. It is kept **forever, uncapped** — daily closes are cheap (one row per plant per day) and are the long-term price record once the tick-level detail ages out.

Pruning of `trades` and `price_history` runs inside `DayRoller` (`packages/server/src/domain/DayRoller.ts`): once immediately on server startup (so a backlog from downtime or a fresh deploy onto older data gets cleaned up promptly) and again at every daily rollover, via `TradeRepository.deleteOlderThan()` / `PlantRepository.pruneHistoryOlderThan()`. The retention window is a plain constant in `config.ts`, not an env var — nothing today needs it to be tunable per deployment.

Note this only deletes rows; it doesn't reclaim disk space. SQLite marks the freed pages for reuse but doesn't shrink the file itself unless you run `VACUUM` (a blocking, full-file rewrite) or enable incremental auto-vacuum. Not done here since it wasn't asked for and needs care around when it's safe to run against a live WAL-mode database — worth revisiting if `jasmine.db`'s on-disk size becomes a real problem even after old rows are being deleted.

Separately, `PRICE_HISTORY_CAP`/`config.priceHistoryCap` is unrelated to any of this — it only limits how many recent `price_history` points a single `GET /plants` or `GET /plants/:id` response returns for rendering the chart. The underlying table can (and does) hold far more than that within the 14-day window; the cap just trims what any one API response sends back.

## Build

```bash
npm run build
```

Outputs compiled JS + type declarations to each package's `dist/` directory.

```bash
npm run typecheck
```

Type-checks all three packages without emitting output.

## Appendix: concurrency notes

Can one resting bid/ask ever get filled twice by two different users racing each other? **No** — but the reason is worth understanding, because it's a side effect of how the DB layer is built, not an explicit lock.

**Why it's safe today:** `better-sqlite3` is fully synchronous (`.get()`/`.all()`/`.run()` block until done, no `await`, no callback), and Node runs JS on a single thread. `OrderMatcher.placeOrder()`'s entire body — read matching orders, compute trade quantities, insert trades, update balances, update the counterpart order's `filled_count`/status — runs inside `db.transaction(() => {...})()` with zero `await` points anywhere in that callback. Once Node starts executing one call to `placeOrder`, it runs start-to-finish as one uninterruptible block; a second, concurrent `POST /orders` (from another user, or a bot's timer) cannot begin until the first has fully committed. So if two orders would both match the same resting order, the second one's matching query only ever runs after the first trade already reduced (or fully consumed) that resting order — there's no window where both can read "100 available" and both fill against it.

**Why this is fragile, not just "fine":** this guarantee is a side effect of the driver choice, not an app-level lock. It would silently break if either of these changed later:
- Swapping `better-sqlite3` for an async driver — a real `await` between reading a resting order and writing its updated `filled_count` reopens the classic read-modify-write race.
- Adding worker threads or clustering — multiple OS threads/processes can genuinely run concurrently, and only SQLite's own (coarser) locking would remain, not per-order correctness.

Re-verify this specific property if either of those ever changes.

**Two related, narrower findings from the same review:**
- **Signup already had this exact class of bug, and it's already fixed.** The `findByName` existence check and the `INSERT` in `POST /players/signup` are two separate statements with a real gap, so a `try/catch` around the insert catches `SQLITE_CONSTRAINT_UNIQUE` as a backstop against two concurrent signups for the same name.
- **`POST /players/:id/reset` isn't wrapped in one transaction** (cancel orders → reset gold/portfolio → clear history are three separate statements). This is fine concurrency-wise for the same synchronous-execution reason above, but it's not crash-atomic: if the process died between the second and third statement, gold could be reset while stale portfolio-value history remains. Low-stakes at this scale, but a different failure mode (durability, not concurrency) from everything else in this section.
