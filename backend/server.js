// ===========================
// backend/server.js (FULL FILE) — FIXED + STRONG
// (No frontend/UI changes)
// ===========================

import "dotenv/config";

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";

import { createClient } from "@supabase/supabase-js";
import { Connection, PublicKey } from "@solana/web3.js";

const app = express();

// -------------------- CONFIG --------------------
const PORT = Number(process.env.PORT || 5000);

// ✅ CORS allowlist from env (add both local + vercel here)
const CORS_ORIGINS = (process.env.CORS_ORIGINS ||
  "http://localhost:5173,http://127.0.0.1:5173,https://fun-run-lovat.vercel.app")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ✅ accept local/file/supabase cleanly
const DB_MODE_RAW = String(process.env.DB_MODE || "file").toLowerCase();
const DB_MODE = DB_MODE_RAW === "local" ? "file" : DB_MODE_RAW; // local => file

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "pumpmini_store";

// ✅ accept SOLANA_RPC or SOLANA_RPC_URL
const SOLANA_RPC =
  process.env.SOLANA_RPC ||
  process.env.SOLANA_RPC_URL ||
  "http://127.0.0.1:8899";

const connection = new Connection(SOLANA_RPC, "confirmed");

// Boost config
const BOOST_COST_SOL = Number(process.env.BOOST_COST_SOL || 0.05);
const BOOST_DURATION_MINUTES = Number(process.env.BOOST_DURATION_MINUTES || 60);

// Owner cap
const OWNER_MAX_PERCENT = Number(process.env.OWNER_MAX_PERCENT || 20); // 20%

// -------------------- MIDDLEWARES (STRONG) --------------------
app.set("trust proxy", 1);

app.use(morgan("tiny"));
app.use(helmet());
app.use(compression());

// ✅ IMPORTANT: payload limit (fix 413 for base64 logo)
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ✅ Rate limit basic protection
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ✅ CORS (preflight included)
const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/postman
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked: " + origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
app.use(corsMiddleware);
app.options("*", corsMiddleware);

// -------------------- FILE DB FALLBACK --------------------
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

function defaultStore() {
  return {
    coins: [],
    profiles: {},
    referrals: {},
    logs: [],
  };
}

function ensureCoin(c) {
  const createdAt = c?.createdAt || nowMs();
  const status = c?.status || "DRAFT";
  const mc = safeNum(c?.mc, status === "LIVE" ? 6500 : 0);
  const ath = safeNum(c?.ath, mc || 6500);
  const chart =
    Array.isArray(c?.chart) && c.chart.length ? c.chart : [mc, mc, mc, mc, mc];

  return {
    id: c?.id || uid(),
    name: String(c?.name || "").trim(),
    symbol: String(c?.symbol || "").trim(),
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

    totalSupply: safeNum(c?.totalSupply, 1_000_000_000),
    holders: c?.holders && typeof c.holders === "object" ? c.holders : {},

    boostedUntil: safeNum(c?.boostedUntil, 0),
    boostCount: safeNum(c?.boostCount, 0),
    lastBoostAt: safeNum(c?.lastBoostAt, 0),
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

async function readDB() {
  if (DB_MODE === "supabase") {
    if (!supabase)
      throw new Error("Supabase not configured (missing URL or SERVICE ROLE key)");

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
      return init;
    }

    const store = data?.data || defaultStore();
    store.coins = Array.isArray(store.coins) ? store.coins.map(ensureCoin) : [];
    store.profiles =
      store.profiles && typeof store.profiles === "object" ? store.profiles : {};
    store.referrals =
      store.referrals && typeof store.referrals === "object"
        ? store.referrals
        : {};
    store.logs = Array.isArray(store.logs) ? store.logs : [];
    return store;
  }

  // file
  if (!fs.existsSync(FILE_DB_PATH)) {
    fs.writeFileSync(FILE_DB_PATH, JSON.stringify(defaultStore(), null, 2));
  }
  const raw = fs.readFileSync(FILE_DB_PATH, "utf-8");
  const store = JSON.parse(raw || "{}");
  const merged = { ...defaultStore(), ...store };
  merged.coins = Array.isArray(merged.coins) ? merged.coins.map(ensureCoin) : [];
  merged.profiles =
    merged.profiles && typeof merged.profiles === "object" ? merged.profiles : {};
  merged.referrals =
    merged.referrals && typeof merged.referrals === "object"
      ? merged.referrals
      : {};
  merged.logs = Array.isArray(merged.logs) ? merged.logs : [];
  return merged;
}

async function writeDB(store) {
  if (DB_MODE === "supabase") {
    if (!supabase)
      throw new Error("Supabase not configured (missing URL or SERVICE ROLE key)");

    const { error } = await supabase
      .from(SUPABASE_TABLE)
      .upsert({ id: "main", data: store }, { onConflict: "id" });

    if (error) throw new Error("Supabase write failed: " + error.message);
    return;
  }
  fs.writeFileSync(FILE_DB_PATH, JSON.stringify(store, null, 2));
}

function findCoin(store, coinId) {
  const id = String(coinId || "").trim();
  const c = store.coins.find((x) => x.id === id);
  return c || null;
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
  res.json({ ok: true, name: "pumpmini-backend", ts: nowMs(), dbMode: DB_MODE })
);

app.get("/api/logs", async (req, res) => {
  try {
    const store = await readDB();
    res.json({ ok: true, logs: store.logs || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/coin/list", async (req, res) => {
  try {
    const store = await readDB();
    const now = nowMs();

    const coins = (store.coins || []).map(ensureCoin);
    coins.sort((a, b) => {
      const aBoost = a.boostedUntil > now ? 1 : 0;
      const bBoost = b.boostedUntil > now ? 1 : 0;
      if (aBoost !== bBoost) return bBoost - aBoost;

      const al = a.status === "LIVE" ? 1 : 0;
      const bl = b.status === "LIVE" ? 1 : 0;
      if (al !== bl) return bl - al;

      return safeNum(b.createdAt) - safeNum(a.createdAt);
    });

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
    store.profiles[wallet] = p;
    await writeDB(store);
    res.json({ ok: true, profile: p });
  } catch (e) {
    console.error("profile error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/referral/:wallet", async (req, res) => {
  try {
    const wallet = String(req.params.wallet || "").trim();
    const store = await readDB();
    const ref = store.referrals?.[wallet] || "";
    res.json({ ok: true, wallet, referrer: ref });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/referral/set", async (req, res) => {
  try {
    const wallet = String(req.body?.wallet || "").trim();
    const referrer = String(req.body?.referrer || "").trim();
    if (!wallet || !referrer)
      return res.json({ ok: false, error: "wallet/referrer required" });
    if (wallet === referrer)
      return res.json({ ok: false, error: "self referral not allowed" });

    const store = await readDB();
    if (store.referrals?.[wallet])
      return res.json({
        ok: false,
        error: "immutable: referral already set",
      });

    store.referrals[wallet] = referrer;
    const p = ensureProfile(store.profiles?.[wallet], wallet);
    p.referrer = referrer;
    store.profiles[wallet] = p;

    logPush(store, { type: "ref_set", wallet, referrer });
    await writeDB(store);

    res.json({ ok: true });
  } catch (e) {
    console.error("ref/set error:", e);
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

// -------------------- CREATE COIN --------------------
app.post("/api/coin/create", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const symbol = String(req.body?.symbol || "")
      .trim()
      .toUpperCase();
    const story = String(req.body?.story || "").trim();
    const logo = req.body?.logo || "";
    const initialSol = safeNum(req.body?.initialSol, 0);
    const creatorWallet = String(req.body?.creatorWallet || "").trim();

    if (!name || !symbol || !creatorWallet)
      return res.json({ ok: false, error: "name/symbol/creatorWallet required" });
    if (symbol.length < 2 || symbol.length > 10)
      return res.json({ ok: false, error: "bad symbol" });

    const store = await readDB();

    const status = initialSol >= 0.01 ? "LIVE" : "DRAFT";
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
      mc: status === "LIVE" ? 6500 : 0,
      ath: status === "LIVE" ? 6500 : 0,
      chart: status === "LIVE" ? [6500, 6500, 6500, 6500, 6500] : [0, 0, 0, 0, 0],
      volumeSol: status === "LIVE" ? initialSol : 0,
      totalSupply: 1_000_000_000,
      holders: {},
    });

    const creatorTokens = Math.floor(coin.totalSupply * 0.02);
    coin.holders[creatorWallet] = (coin.holders[creatorWallet] || 0) + creatorTokens;

    store.coins.unshift(coin);

    const p = ensureProfile(store.profiles?.[creatorWallet], creatorWallet);
    const existing = p.holdings.find((h) => h.coinId === coin.id);
    if (existing) existing.amount = (existing.amount || 0) + creatorTokens;
    else p.holdings.unshift({ coinId: coin.id, symbol: coin.symbol, amount: creatorTokens, lastAt: nowMs() });

    p.txs.unshift({ id: uid(), t: nowMs(), coinId: coin.id, side: "CREATE", sol: initialSol });
    store.profiles[creatorWallet] = p;

    logPush(store, { type: "coin_create", coinId: coin.id, creatorWallet, status, initialSol });
    await writeDB(store);

    res.json({ ok: true, coin });
  } catch (e) {
    console.error("coin/create error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- TRADE (DEMO) --------------------
app.post("/api/trade", async (req, res) => {
  try {
    const wallet = String(req.body?.wallet || "").trim();
    const coinId = String(req.body?.coinId || "").trim();
    const side = String(req.body?.side || "BUY").toUpperCase();
    const sol = safeNum(req.body?.sol, 0);

    if (!wallet || !coinId)
      return res.json({ ok: false, error: "wallet/coinId required" });
    if (!(sol > 0)) return res.json({ ok: false, error: "sol must be > 0" });

    const store = await readDB();
    const coin = findCoin(store, coinId);
    if (!coin) return res.json({ ok: false, error: "coin not found" });
    if (coin.status !== "LIVE") return res.json({ ok: false, error: "coin not live" });

    const price = Math.max(0.000000001, coin.mc / coin.totalSupply);
    let tokens = Math.floor((sol * 1000) / price);
    if (tokens <= 0) tokens = 1;

    coin.holders = coin.holders || {};
    const prev = safeNum(coin.holders[wallet], 0);

    if (side === "SELL") {
      if (prev <= 0) return res.json({ ok: false, error: "not enough tokens" });
      const sellTokens = Math.min(prev, tokens);
      coin.holders[wallet] = prev - sellTokens;
      tokens = sellTokens;
    } else {
      const isOwner = wallet === coin.creatorWallet || wallet === coin.owner;
      if (isOwner) {
        const after = prev + tokens;
        const maxAllowed = Math.floor((coin.totalSupply * OWNER_MAX_PERCENT) / 100);
        if (after > maxAllowed) {
          return res.json({
            ok: false,
            error: `Owner cap: max ${OWNER_MAX_PERCENT}% supply (${maxAllowed.toLocaleString()} tokens)`,
          });
        }
      }
      coin.holders[wallet] = prev + tokens;
    }

    coin.volumeSol = safeNum(coin.volumeSol, 0) + sol;
    const bump = Math.max(1, Math.round(sol * 250));
    coin.mc = safeNum(coin.mc, 6500) + (side === "SELL" ? -bump : bump);
    coin.mc = Math.max(1, coin.mc);
    coin.ath = Math.max(safeNum(coin.ath, coin.mc), coin.mc);
    coin.chart = Array.isArray(coin.chart) ? coin.chart : [];
    coin.chart.push(coin.mc);
    coin.chart = coin.chart.slice(-40);

    const fee = sol * 0.01;
    const creatorCut = fee * 0.4;
    coin.creatorRewardsSol = safeNum(coin.creatorRewardsSol, 0) + creatorCut;

    const p = ensureProfile(store.profiles?.[wallet], wallet);
    const h = Array.isArray(p.holdings) ? p.holdings : [];
    const row = h.find((x) => x.coinId === coin.id);
    if (row) {
      row.amount = safeNum(coin.holders[wallet], 0);
      row.lastAt = nowMs();
    } else {
      h.unshift({ coinId: coin.id, symbol: coin.symbol, amount: safeNum(coin.holders[wallet], 0), lastAt: nowMs() });
    }
    p.holdings = h.filter((x) => safeNum(x.amount, 0) > 0);

    p.txs.unshift({ id: uid(), t: nowMs(), coinId: coin.id, side, sol, tokens });

    const cw = String(coin.creatorWallet || "").trim();
    if (cw) {
      const cp = ensureProfile(store.profiles?.[cw], cw);
      cp.rewards = cp.rewards || { totalSol: 0, byCoin: {} };
      cp.rewards.totalSol = safeNum(cp.rewards.totalSol, 0) + creatorCut;
      cp.rewards.byCoin = cp.rewards.byCoin || {};
      cp.rewards.byCoin[coin.id] = safeNum(cp.rewards.byCoin[coin.id], 0) + creatorCut;
      store.profiles[cw] = cp;
    }

    const ref = store.referrals?.[wallet];
    if (ref) {
      const refCut = fee * 0.1;
      const rp = ensureProfile(store.profiles?.[ref], ref);
      rp.referralRewards = rp.referralRewards || { totalSol: 0, byWallet: {} };
      rp.referralRewards.totalSol = safeNum(rp.referralRewards.totalSol, 0) + refCut;
      rp.referralRewards.byWallet = rp.referralRewards.byWallet || {};
      rp.referralRewards.byWallet[wallet] = safeNum(rp.referralRewards.byWallet[wallet], 0) + refCut;
      store.profiles[ref] = rp;
    }

    store.profiles[wallet] = p;

    logPush(store, { type: "trade", coinId: coin.id, wallet, side, sol, tokens });
    await writeDB(store);

    res.json({ ok: true, coin: ensureCoin(coin) });
  } catch (e) {
    console.error("trade error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- WITHDRAW (DEMO) --------------------
app.post("/api/withdraw", async (req, res) => {
  try {
    const wallet = String(req.body?.wallet || "").trim();
    const kind = String(req.body?.kind || "").trim().toUpperCase();
    if (!wallet) return res.json({ ok: false, error: "wallet required" });

    const store = await readDB();
    const p = ensureProfile(store.profiles?.[wallet], wallet);

    if (kind === "CREATOR") {
      const amt = safeNum(p.rewards?.totalSol, 0);
      p.rewards = { totalSol: 0, byCoin: {} };
      store.profiles[wallet] = p;
      logPush(store, { type: "withdraw_creator", wallet, amt });
      await writeDB(store);
      return res.json({ ok: true, sent: amt });
    }

    if (kind === "REF") {
      const amt = safeNum(p.referralRewards?.totalSol, 0);
      p.referralRewards = { totalSol: 0, byWallet: {} };
      store.profiles[wallet] = p;
      logPush(store, { type: "withdraw_ref", wallet, amt });
      await writeDB(store);
      return res.json({ ok: true, sent: amt });
    }

    logPush(store, { type: "withdraw_manual_request", wallet, to: req.body?.to || "" });
    await writeDB(store);
    return res.json({ ok: true });
  } catch (e) {
    console.error("withdraw error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- BOOST FEATURE --------------------
app.post("/api/boost", async (req, res) => {
  try {
    const wallet = String(req.body?.wallet || "").trim();
    const coinId = String(req.body?.coinId || "").trim();
    const minutes = Math.max(5, Math.min(180, safeNum(req.body?.minutes, BOOST_DURATION_MINUTES)));

    if (!wallet || !coinId) return res.json({ ok: false, error: "wallet/coinId required" });

    const store = await readDB();
    const coin = findCoin(store, coinId);
    if (!coin) return res.json({ ok: false, error: "coin not found" });

    const owner = String(coin.creatorWallet || coin.owner || "").trim();
    if (wallet !== owner) return res.json({ ok: false, error: "only creator can boost" });

    let bal = 0;
    try {
      bal = await getSolBalance(wallet);
    } catch {
      bal = 0;
    }
    if (bal < BOOST_COST_SOL) {
      return res.json({ ok: false, error: `Not enough SOL for boost. Need ${BOOST_COST_SOL} SOL` });
    }

    const until = nowMs() + minutes * 60 * 1000;
    coin.boostedUntil = Math.max(safeNum(coin.boostedUntil, 0), until);
    coin.boostCount = safeNum(coin.boostCount, 0) + 1;
    coin.lastBoostAt = nowMs();

    logPush(store, { type: "boost", wallet, coinId: coin.id, until: coin.boostedUntil, costSol: BOOST_COST_SOL });

    await writeDB(store);
    res.json({ ok: true, coin: ensureCoin(coin), costSol: BOOST_COST_SOL });
  } catch (e) {
    console.error("boost error:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/boost/list", async (req, res) => {
  try {
    const store = await readDB();
    const now = nowMs();
    const boosted = (store.coins || [])
      .map(ensureCoin)
      .filter((c) => safeNum(c.boostedUntil, 0) > now)
      .sort((a, b) => safeNum(b.boostedUntil, 0) - safeNum(a.boostedUntil, 0));
    res.json({ ok: true, boosted });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- START --------------------
app.listen(PORT, () => {
  console.log(`✅ Backend running on port: ${PORT}`);
  console.log(`✅ Solana RPC: ${SOLANA_RPC}`);
  console.log(`✅ DB MODE: ${DB_MODE}`);
  console.log(`✅ CORS_ORIGINS: ${CORS_ORIGINS.join(", ")}`);
});
