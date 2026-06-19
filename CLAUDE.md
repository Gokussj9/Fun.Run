# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Style

Always respond to the user in **Roman Urdu** (Urdu written in English/Latin letters). This applies to all messages — explanations, questions, code reviews, and updates.

## Project Overview

**Fun.Run** is a Solana-based meme coin launchpad. Users create SPL tokens, trade them on a bonding curve, and earn rewards via a referral system. The backend manages custodial Solana wallets with AES-256 encrypted BIP39 mnemonics.

## Commands

### Frontend (`frontend/`)
```bash
npm run dev      # Vite dev server — proxies /api → http://127.0.0.1:5000
npm run build    # Production build → dist/
npm run lint     # ESLint (flat config)
npm run preview  # Preview production build
```

### Backend (root or `backend/`)
```bash
npm start        # node backend/server.js (Express on PORT from .env)
```

No test suite exists.

## Architecture

### Monorepo Layout
- `backend/server.js` — single ~2400-line Express server; all route handlers, helpers, and DB queries live here
- `backend/solana/` — Solana helpers: `connection.js`, `treasury.js` (encrypted keypair), `create-token.js`, `add-metadata.js`, `transfer-token.js`, `decrypt-wallet.js`, `balance.js`
- `backend/routes/wallet.js` — custodial wallet creation (BIP39 mnemonics)
- `frontend/src/App.jsx` — single ~1600-line React component; all UI state, navigation, and API calls live here
- `frontend/src/main.jsx` — Privy provider setup (Google OAuth + embedded Solana wallets)
- `frontend/src/IntroSplash.jsx`, `IntroFlow.jsx` — animated splash/intro screens

### Backend Key Concepts

**Bonding curve trading** — `doTrade()` in server.js updates `v_sol` / `v_tokens` virtual reserves for every buy/sell and calls `distributeFeeDirect()` to split fees to creator, platform owner, and referrer in one atomic DB transaction.

**Custodial wallets** — `createCustodialWallet()` generates a BIP39 mnemonic, encrypts it with AES-256 (key from `MNEMONIC_SECRET`), and stores the ciphertext in `profiles.encrypted_mnemonic`. `getCustodialKeypairFromMnemonic()` decrypts on demand; `sweepCustodialToTreasury()` moves funds to the treasury keypair.

**Caching** — `coinCache` (3 s TTL) and `profileCache` (10 s TTL) sit in front of DB reads on hot endpoints.

**OHLCV candles** — `upsertCandlesForTrade()` maintains the `candles` table across 1m/5m/15m/1h/4h/1d buckets after every trade. The frontend consumes these via `POST /coin/:id/candles`.

**Rate limits** — mnemonic reveal: 5/min; trades: 60/min; withdrawals & claims: 10/min; coin creation: 10/min.

### Database (PostgreSQL via Neon)
Schema is auto-created by `ensureSchema()` on startup. Key tables:
- `coins` — token metadata + bonding curve state (`v_sol`, `v_tokens`, `mint_address`)
- `profiles` — user state (wallet, referrer, `run_balance`, encrypted mnemonic)
- `transactions` — every buy/sell event
- `holdings` — per-user token balances
- `candles` — OHLCV data per coin/timeframe
- `audit_logs` — immutable event log (never delete rows)

### Frontend Key Concepts

**Single-component design** — nearly all logic is in `App.jsx`. Navigation state (`activeTab`, `activeCoin`, `showCreate`) is managed with `useState`; no router library is used.

**API calls** — a thin `api(path, opts)` wrapper handles fetch + JSON parse. The Vite dev proxy rewrites `/api/*` to the Express backend; in production the same domain serves both.

**Auth** — Privy provides `usePrivy()` (login/logout, `authenticated`, `user`) and `useSolanaWallets()` (embedded wallet for signing). The user's Privy wallet address is the primary key for all backend calls.

**WebSocket** — backend broadcasts price/trade events over WS; `App.jsx` connects to `ws://` or `wss://` derived from `VITE_API_BASE`.

### Environment Variables
- Backend: `backend/.env` — `PORT`, `DATABASE_URL`, `SOLANA_RPC`, `MNEMONIC_SECRET`, `TREASURY_KEYPAIR`, fee percentages, IPFS keys, CORS origins
- Frontend: `frontend/.env.local` — `VITE_API_BASE`, `VITE_PRIVY_APP_ID`
