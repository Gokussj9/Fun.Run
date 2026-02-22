// backend/server.js (FULL FILE) — FAST FILE-DB + SAME API

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";

import { createClient } from "@supabase/supabase-js";
import { Connection, PublicKey } from "@solana/web3.js";

import { fileURLToPath } from "url";
import fs from "fs";
import fsp from "fs/promises";

const app = express();

// -------------------- TRUST PROXY (Railway/Render) --------------------
if (String(process.env.TRUST_PROXY || "") === "1") {
  app.set("trust proxy", 1);
}

// -------------------- MIDDLEWARE --------------------
app.use(morgan("tiny"));
app.use(helmet());
app.use(compression());

const JSON_LIMIT = process.env.JSON_LIMIT || "15mb";
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// -------------------- CORS --------------------
function parseOrigins(val) {
  return String(val || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const CORS_ORIGINS = parseOrigins(
  process.env.CORS_ORIGINS ||
    [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://fun-run-lovat.vercel.app",
    ].join(",")
);

const ALLOW_VERCEL_PREVIEWS =
  String(process.env.ALLOW_VERCEL_PREVIEWS || "1") === "1";

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (CORS_ORIGINS.includes("*")) return true;
  if (CORS_ORIGINS.includes(origin)) return true;

  if (ALLOW_VERCEL_PREVIEWS) {
    try {
      const u = new URL(origin);
      if (u.hostname.endsWith(".vercel.app")) return true;
    } catch {}
  }
  return false;
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

app.options("*", cors());

// -------------------- CONFIG --------------------
const PORT = Number(process.env.PORT || 5000);

const DB_MODE_RAW = String(process.env.DB_MODE || "file").toLowerCase();
const DB_MODE = DB_MODE_RAW === "local" ? "file" : DB_MODE_RAW;

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "pumpmini_store";

const SOLANA_RPC =
  process.env.SOLANA_RPC ||
  process.env.SOLANA_RPC_URL ||
  "http://127.0.0.1:8899";

const connection = new Connection(SOLANA_RPC, "confirmed");

// Economics
const STARTING_MC_USD = Number(process.env.STARTING_MC_USD || 6500);
const TOTAL_SUPPLY_DEFAULT = Number(process.env.TOTAL_SUPPLY_DEFAULT || 1_000_000_000);
const CREATOR_PERCENT = Number(process.env.CREATOR_PERCENT || 2);

// Fee
const FEE_PCT = Number(process.env.FEE_PCT || 1);

// Trade split
const TRADE_DEV_PCT = Number(process.env.TRADE_DEV_PCT || 40);
const TRADE_CREATOR_PCT = Number(process.env.TRADE_CREATOR_PCT || 40);
const TRADE_REF_PCT = Number(process.env.TRADE_REF_PCT || 10);
const TRADE_RESERVE_PCT = Number(process.env.TRADE_RESERVE_PCT || 10);

// Create split
const CREATE_DEV_PCT = Number(process.env.CREATE_DEV_PCT || 70);
const CREATE_REF_PCT = Number(process.env.CREATE_REF_PCT || 20);
const CREATE_RESERVE_PCT = Number(process.env.CREATE_RESERVE_PCT || 10);

const DEV_WALLET = String(process.env.DEV_WALLET || "DEV_TREASURY").trim();
const RESERVE_WALLET = String(process.env.RESERVE_WALLET || "RESERVE_TREASURY").trim();

// -------------------- FILE DB PATH --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE_DB_PATH = path.join(__dirname, "db.json");

// -------------------- SUPABASE --------------------
const supabase =
  DB_MODE === "supabase" && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

// -------------------- UTIL --------------------
function nowMs() {
  return Date.now();
}
function uid() {
  return crypto.randomUUID();
}
function safeNum(n, d = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : d;
}
function clampPct(n) {
  const x = safeNum(n, 0);
  return Math.max(0, Math.min(100, x));
}
function pctToFrac(p) {
  return clampPct(p) / 100;
}

function defaultStore() {
  return {
    coins: [],
    profiles: {},
    referrals: {},
    treasury: { devSol: 0, reserveSol: 0, updatedAt: nowMs() },
    logs: [],
  };
}

function ensureCoin(c) {
  const createdAt = safeNum(c?.createdAt, nowMs());
  const status = c?.status || "DRAFT";
  const mc = safeNum(c?.mc, status === "LIVE" ? STARTING_MC_USD : 0);
  const ath = safeNum(c?.ath, mc || STARTING_MC_USD);
  const chart =
    Array.isArray(c?.chart) && c.chart.length ? c.chart : [mc, mc, mc, mc, mc];

  return {
    id: c?.id || uid(),
    name: String(c?.name || "").trim(),
    symbol: String(c?.symbol || "").trim().toUpperCase(),
    story: String(c?.story || "").trim(),
    logo: c?.logo || "",
    creatorWallet: c?.creatorWallet || c?.owner || "",
    owner: c?.owner || c?.creatorWallet || "",
    createdAt,
    status,
    mc,
    ath,
    chart,
    volumeSol: safeNum(c?.volumeSol, 0),
    creatorRewardsSol: safeNum(c?.creatorRewardsSol, 0),
    totalSupply: safeNum(c?.totalSupply, TOTAL_SUPPLY_DEFAULT),
    holders: c?.holders && typeof c.holders === "object" ? c.holders : {},
    lastTradeAt: safeNum(c?.lastTradeAt, 0),
  };
}

function ensureProfile(p, wallet) {
  const w = String(wallet || p?.wallet || "").trim();
  const base = p && typeof p === "object" ? p : {};
  return {
    wallet: w,
    holdings: Array.isArray(base.holdings) ? base.holdings : [],
    txs: Array.isArray(base.txs) ? base.txs : [],
    rewards:
      base.rewards && typeof base.rewards === "object"
        ? base.rewards
        : { totalSol: 0, byCoin: {} },
    referralRewards:
      base.referralRewards && typeof base.referralRewards === "object"
        ? base.referralRewards
        : { totalSol: 0, byWallet: {} },
    referrer: base.referrer || "",
    updatedAt: nowMs(),
  };
}

function logPush(store, item) {
  store.logs = Array.isArray(store.logs) ? store.logs : [];
  store.logs.unshift({ t: nowMs(), ...item });
  store.logs = store.logs.slice(0, 300);
}

function normalizeStore(store) {
  const merged = { ...defaultStore(), ...(store || {}) };
  merged.coins = Array.isArray(merged.coins) ? merged.coins.map(ensureCoin) : [];
  merged.profiles = merged.profiles && typeof merged.profiles === "object" ? merged.profiles : {};
  merged.referrals = merged.referrals && typeof merged.referrals === "object" ? merged.referrals : {};
  merged.treasury = merged.treasury && typeof merged.treasury === "object" ? merged.treasury : defaultStore().treasury;
  merged.logs = Array.isArray(merged.logs) ? merged.logs : [];
  return merged;
}

function ensureTreasury(store) {
  store.treasury = store.treasury && typeof store.treasury === "object" ? store.treasury : {};
  store.treasury.devSol = safeNum(store.treasury.devSol, 0);
  store.treasury.reserveSol = safeNum(store.treasury.reserveSol, 0);
  store.treasury.updatedAt = nowMs();
}

function creditCreatorReward(store, coin, amountSol) {
  const creator = String(coin?.creatorWallet || coin?.owner || "").trim();
  if (!creator || amountSol <= 0) return;

  const p = ensureProfile(store.profiles?.[creator], creator);
  p.rewards.totalSol = safeNum(p.rewards?.totalSol, 0) + amountSol;
  p.rewards.byCoin = p.rewards.byCoin && typeof p.rewards.byCoin === "object" ? p.rewards.byCoin : {};
  p.rewards.byCoin[coin.id] = safeNum(p.rewards.byCoin[coin.id], 0) + amountSol;
  p.updatedAt = nowMs();
  store.profiles[creator] = p;

  coin.creatorRewardsSol = safeNum(coin.creatorRewardsSol, 0) + amountSol;
}

function creditReferralReward(store, traderWallet, amountSol) {
  const w = String(traderWallet || "").trim();
  if (!w || amountSol <= 0) return;

  const ref = String(store.referrals?.[w] || "").trim();
  if (!ref || ref.length < 20) return;

  const rp = ensureProfile(store.profiles?.[ref], ref);
  rp.referralRewards.totalSol = safeNum(rp.referralRewards?.totalSol, 0) + amountSol;
  rp.referralRewards.byWallet =
    rp.referralRewards.byWallet && typeof rp.referralRewards.byWallet === "object"
      ? rp.referralRewards.byWallet
      : {};
  rp.referralRewards.byWallet[w] = safeNum(rp.referralRewards.byWallet[w], 0) + amountSol;
  rp.updatedAt = nowMs();
  store.profiles[ref] = rp;
}

function takeFee(solAmount) {
  const fee = solAmount * pctToFrac(FEE_PCT);
  const net = Math.max(0, solAmount - fee);
  return { feeSol: fee, netSol: net };
}

function findCoin(store, coinId) {
  const id = String(coinId || "").trim();
  return (store.coins || []).find((x) => x.id === id) || null;
}

// -------------------- FAST FILE DB (CACHE + DEBOUNCED WRITE) --------------------
let fileCache = null;          // in-memory store
let fileLoaded = false;
let writeTimer = null;
let writeInFlight = false;
let pendingWrite = false;

async function loadFileStoreOnce() {
  if (fileLoaded && fileCache) return fileCache;

  try {
    await fsp.access(FILE_DB_PATH, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(FILE_DB_PATH, JSON.stringify(defaultStore()));
  }

  const raw = await fsp.readFile(FILE_DB_PATH, "utf-8");
  const parsed = raw ? JSON.parse(raw) : {};
  fileCache = normalizeStore(parsed);
  fileLoaded = true;
  return fileCache;
}

async function flushFileStoreNow() {
  if (writeInFlight) {
    pendingWrite = true;
    return;
  }
  writeInFlight = true;
  pendingWrite = false;

  const tmp = FILE_DB_PATH + ".tmp";
  const data = JSON.stringify(fileCache); // no pretty print (FAST)
  await fsp.writeFile(tmp, data, "utf-8");
  await fsp.rename(tmp, FILE_DB_PATH);

  writeInFlight = false;
  if (pendingWrite) {
    await flushFileStoreNow();
  }
}

function scheduleFileWrite() {
  if (writeTimer) return;
  writeTimer = setTimeout(async () => {
    writeTimer = null;
    try {
      await flushFileStoreNow();
    } catch (e) {
      console.error("File DB flush failed:", e?.message || e);
    }
  }, 600); // debounce
}

// -------------------- DB API --------------------
async function readDB() {
  if (DB_MODE === "supabase") {
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select("data")
      .eq("id", "main")
      .maybeSingle();

    if (error) throw new Error("Supabase read failed: " + error.message);

    if (!data) {
      const init = defaultStore();
      const { error: upErr } = await supabase
        .from(SUPABASE_TABLE)
        .upsert({ id: "main", data: init }, { onConflict: "id" });
      if (upErr) throw new Error("Supabase init failed: " + upErr.message);
      return normalizeStore(init);
    }

    return normalizeStore(data?.data || defaultStore());
  }

  return await loadFileStoreOnce();
}

async function writeDB(store) {
  if (DB_MODE === "supabase") {
    if (!supabase) throw new Error("Supabase not configured");

    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .upsert({ id: "main", data: store }, { onConflict: "id" });

    if (error) throw new Error("Supabase write failed: " + error.message);
    return;
  }

  // file mode: update cache + schedule write (FAST)
  fileCache = normalizeStore(store);
  fileLoaded = true;
  scheduleFileWrite();
}

// -------------------- SOLANA HELPERS --------------------
async function getSolBalance(wallet) {
  try {
    if (!wallet) return 0;
    const pub = new PublicKey(wallet);
    const lamports = await connection.getBalance(pub);
    return lamports / 1_000_000_000;
  } catch (err) {
    console.log("Balance fetch failed, returning 0:", err.message);
    return 0;
  }
}

// -------------------- ROUTES --------------------
app.get("/", (req, res) =>
  res.json({ ok: true, name: "funrun-backend", ts: nowMs(), dbMode: DB_MODE })
);

app.get("/api/coin/list", async (req, res) => {
  try {
    const store = await readDB();
    const coins = (store.coins || []).map(ensureCoin);
    coins.sort((a, b) => safeNum(b.createdAt) - safeNum(a.createdAt));
    res.json({ ok: true, coins });
  } catch (e) {
    console.error("coin/list error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/profile/:wallet", async (req, res) => {
  try {
    const wallet = String(req.params.wallet || "").trim();
    const store = await readDB();
    const p = ensureProfile(store.profiles?.[wallet], wallet);

    if (!p.referrer && store.referrals?.[wallet]) p.referrer = store.referrals[wallet];

    store.profiles[wallet] = p;
    await writeDB(store); // in file mode: debounced
    res.json({ ok: true, profile: p });
  } catch (e) {
    console.error("profile error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/balance/:wallet", async (req, res) => {
  try {
    const wallet = String(req.params.wallet || "").trim();
    if (!wallet) return res.json({ ok: false, error: "wallet required" });
    const sol = await getSolBalance(wallet);
    res.json({ ok: true, sol });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- REFERRAL (immutable set) --------------------
app.post("/api/referral/set", async (req, res) => {
  try {
    const wallet = String(req.body?.wallet || "").trim();
    const referrer = String(req.body?.referrer || "").trim();

    if (!wallet || wallet.length < 20) return res.json({ ok: false, error: "wallet required" });
    if (!referrer || referrer.length < 20) return res.json({ ok: false, error: "referrer invalid" });
    if (wallet === referrer) return res.json({ ok: false, error: "self referral not allowed" });

    const store = await readDB();
    store.referrals = store.referrals && typeof store.referrals === "object" ? store.referrals : {};

    if (store.referrals[wallet]) {
      return res.json({ ok: false, error: "immutable: referral already set" });
    }

    store.referrals[wallet] = referrer;

    const p = ensureProfile(store.profiles?.[wallet], wallet);
    p.referrer = referrer;
    p.updatedAt = nowMs();
    store.profiles[wallet] = p;

    logPush(store, { type: "referral_set", wallet, referrer });
    await writeDB(store);

    res.json({ ok: true });
  } catch (e) {
    console.error("referral/set error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- CREATE COIN --------------------
app.post("/api/coin/create", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const symbol = String(req.body?.symbol || "").trim().toUpperCase();
    const story = String(req.body?.story || "").trim();
    const logo = req.body?.logo || "";
    const initialSol = safeNum(req.body?.initialSol, 0);
    const creatorWallet = String(req.body?.creatorWallet || "").trim();

    if (!name || !symbol || !creatorWallet) {
      return res.json({ ok: false, error: "name/symbol/creatorWallet required" });
    }

    const store = await readDB();
    ensureTreasury(store);

    const status = initialSol >= 0.01 ? "LIVE" : "DRAFT";

    let createFeeSol = 0;
    if (status === "LIVE" && initialSol > 0) {
      const f = takeFee(initialSol);
      createFeeSol = f.feeSol;

      const dev = createFeeSol * pctToFrac(CREATE_DEV_PCT);
      const ref = createFeeSol * pctToFrac(CREATE_REF_PCT);
      const reserve = createFeeSol * pctToFrac(CREATE_RESERVE_PCT);

      store.treasury.devSol += dev;
      store.treasury.reserveSol += reserve;

      creditReferralReward(store, creatorWallet, ref);

      logPush(store, {
        type: "create_fee",
        wallet: creatorWallet,
        feeSol: createFeeSol,
        split: { dev, ref, reserve },
        devWallet: DEV_WALLET,
        reserveWallet: RESERVE_WALLET,
      });
    }

    const coin = ensureCoin({
      id: uid(),
      name,
      symbol,
      story,
      logo,
      creatorWallet,
      owner: creatorWallet,
      status,
      createdAt: nowMs(),
      mc: status === "LIVE" ? STARTING_MC_USD : 0,
      ath: status === "LIVE" ? STARTING_MC_USD : 0,
      chart:
        status === "LIVE"
          ? [STARTING_MC_USD, STARTING_MC_USD, STARTING_MC_USD, STARTING_MC_USD, STARTING_MC_USD]
          : [0, 0, 0, 0, 0],
      volumeSol: status === "LIVE" ? initialSol : 0,
      totalSupply: TOTAL_SUPPLY_DEFAULT,
      holders: {},
    });

    const creatorTokens = Math.floor((coin.totalSupply * CREATOR_PERCENT) / 100);
    coin.holders[creatorWallet] = (coin.holders[creatorWallet] || 0) + creatorTokens;

    store.coins.unshift(coin);

    const p = ensureProfile(store.profiles?.[creatorWallet], creatorWallet);
    const existing = p.holdings.find((h) => h.coinId === coin.id);
    if (existing) existing.amount = (existing.amount || 0) + creatorTokens;
    else p.holdings.unshift({ coinId: coin.id, symbol: coin.symbol, amount: creatorTokens, lastAt: nowMs() });

    p.txs.unshift({
      id: uid(),
      t: nowMs(),
      coinId: coin.id,
      side: "CREATE",
      sol: initialSol,
      feeSol: createFeeSol,
    });
    store.profiles[creatorWallet] = p;

    logPush(store, { type: "coin_create", coinId: coin.id, creatorWallet, status, initialSol });
    await writeDB(store);

    res.json({ ok: true, coin });
  } catch (e) {
    console.error("coin/create error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- TRADE CORE --------------------
async function handleTrade(req, res, forcedSide) {
  try {
    const wallet = String(req.body?.wallet || "").trim();
    const coinId = String(req.body?.coinId || "").trim();
    const sideRaw = String(forcedSide || req.body?.side || "").trim().toLowerCase();
    const sol = safeNum(req.body?.sol, 0);

    if (!wallet || !coinId || !sideRaw || sol <= 0) {
      return res.json({ ok: false, error: "wallet/coinId/side/sol required" });
    }
    if (sideRaw !== "buy" && sideRaw !== "sell") {
      return res.json({ ok: false, error: "side must be buy or sell" });
    }

    const store = await readDB();
    ensureTreasury(store);

    const coin = findCoin(store, coinId);
    if (!coin) return res.json({ ok: false, error: "Coin not found" });
    if (coin.status !== "LIVE") return res.json({ ok: false, error: "Coin not LIVE" });

    const p = ensureProfile(store.profiles?.[wallet], wallet);

    const { feeSol } = takeFee(sol);

    const feeDev = feeSol * pctToFrac(TRADE_DEV_PCT);
    const feeCreator = feeSol * pctToFrac(TRADE_CREATOR_PCT);
    const feeRef = feeSol * pctToFrac(TRADE_REF_PCT);
    const feeReserve = feeSol * pctToFrac(TRADE_RESERVE_PCT);

    store.treasury.devSol += feeDev;
    store.treasury.reserveSol += feeReserve;

    creditCreatorReward(store, coin, feeCreator);
    creditReferralReward(store, wallet, feeRef);

    const mc = Math.max(coin.mc || STARTING_MC_USD, 1000);
    const tokensPerSol = Math.max(1, Math.floor(coin.totalSupply / mc));
    const tokens = Math.max(1, Math.floor(sol * tokensPerSol));

    if (sideRaw === "buy") {
      coin.holders[wallet] = (coin.holders[wallet] || 0) + tokens;

      const h = p.holdings.find((x) => x.coinId === coinId);
      if (h) {
        h.amount = safeNum(h.amount, 0) + tokens;
        h.lastAt = nowMs();
      } else {
        p.holdings.unshift({ coinId, symbol: coin.symbol, amount: tokens, lastAt: nowMs() });
      }

      coin.volumeSol = safeNum(coin.volumeSol, 0) + sol;

      coin.mc = Math.round(Math.max(1000, coin.mc + sol * 120));
      coin.ath = Math.max(coin.ath || coin.mc, coin.mc);
      coin.chart = Array.isArray(coin.chart) ? coin.chart : [];
      coin.chart.push(coin.mc);
      coin.chart = coin.chart.slice(-60);

      p.txs.unshift({ id: uid(), t: nowMs(), coinId, side: "BUY", sol, tokens, feeSol });

      logPush(store, {
        type: "trade",
        side: "BUY",
        wallet,
        coinId,
        sol,
        tokens,
        feeSol,
        split: { dev: feeDev, creator: feeCreator, ref: feeRef, reserve: feeReserve },
      });
    } else {
      const h = p.holdings.find((x) => x.coinId === coinId);
      const have = safeNum(h?.amount, 0);
      if (!h || have <= 0) return res.json({ ok: false, error: "No tokens to sell" });

      const sellTokens = Math.min(have, tokens);
      h.amount = have - sellTokens;
      h.lastAt = nowMs();

      coin.holders[wallet] = Math.max(0, safeNum(coin.holders[wallet], 0) - sellTokens);
      coin.volumeSol = safeNum(coin.volumeSol, 0) + sol;

      coin.mc = Math.round(Math.max(1000, coin.mc - sol * 110));
      coin.chart = Array.isArray(coin.chart) ? coin.chart : [];
      coin.chart.push(coin.mc);
      coin.chart = coin.chart.slice(-60);

      p.txs.unshift({ id: uid(), t: nowMs(), coinId, side: "SELL", sol, tokens: sellTokens, feeSol });

      logPush(store, {
        type: "trade",
        side: "SELL",
        wallet,
        coinId,
        sol,
        tokens: sellTokens,
        feeSol,
        split: { dev: feeDev, creator: feeCreator, ref: feeRef, reserve: feeReserve },
      });
    }

    coin.lastTradeAt = nowMs();
    p.updatedAt = nowMs();
    store.profiles[wallet] = p;

    await writeDB(store);

    res.json({ ok: true, coin: ensureCoin(coin), profile: store.profiles[wallet] });
  } catch (e) {
    console.error("trade error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

app.post("/api/coin/buy", (req, res) => handleTrade(req, res, "buy"));
app.post("/api/coin/sell", (req, res) => handleTrade(req, res, "sell"));
app.post("/api/trade", (req, res) => handleTrade(req, res, null));
app.get("/api/coin/buy", (req, res) => res.json({ ok: true, note: "BUY route is LIVE. Use POST." }));
app.get("/api/coin/sell", (req, res) => res.json({ ok: true, note: "SELL route is LIVE. Use POST." }));
// -------------------- WITHDRAW (demo accounting) --------------------
async function handleWithdraw(req, res, mode) {
  try {
    const wallet = String(req.body?.wallet || "").trim();
    const to = String(req.body?.to || "").trim();
    const kind = String(req.body?.kind || mode || "").trim().toUpperCase();

    if (!wallet) return res.json({ ok: false, error: "wallet required" });
    if (!to) return res.json({ ok: false, error: "to required" });

    const store = await readDB();
    const p = ensureProfile(store.profiles?.[wallet], wallet);

    let withdrawn = 0;

    if (kind === "CREATOR") {
      withdrawn = safeNum(p.rewards?.totalSol, 0);
      p.rewards = { totalSol: 0, byCoin: {} };
    } else if (kind === "REF") {
      withdrawn = safeNum(p.referralRewards?.totalSol, 0);
      p.referralRewards = { totalSol: 0, byWallet: {} };
    } else {
      withdrawn = 0;
    }

    p.txs.unshift({ id: uid(), t: nowMs(), coinId: "", side: "WITHDRAW", sol: withdrawn, to, kind });
    p.updatedAt = nowMs();
    store.profiles[wallet] = p;

    logPush(store, { type: "withdraw", wallet, to, kind, sol: withdrawn });
    await writeDB(store);

    res.json({ ok: true, to, kind, sol: withdrawn });
  } catch (e) {
    console.error("withdraw error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

app.post("/api/withdraw", (req, res) => handleWithdraw(req, res, "MANUAL"));
app.post("/api/withdraw/manual", (req, res) => handleWithdraw(req, res, "MANUAL"));
app.post("/api/withdraw/creator", (req, res) => handleWithdraw(req, res, "CREATOR"));
app.post("/api/withdraw/referral", (req, res) => handleWithdraw(req, res, "REF"));
app.post("/api/transfer", (req, res) => handleWithdraw(req, res, "MANUAL"));
app.post("/api/payout", (req, res) => handleWithdraw(req, res, "MANUAL"));

// -------------------- START --------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running on port: ${PORT}`);
  console.log(`✅ Solana RPC: ${SOLANA_RPC}`);
  console.log(`✅ DB MODE: ${DB_MODE}`);
  console.log(`✅ CORS_ORIGINS: ${CORS_ORIGINS.join(", ")}`);
  console.log(`✅ JSON_LIMIT: ${JSON_LIMIT}`);
  console.log(`✅ Fee: ${FEE_PCT}%`);
});