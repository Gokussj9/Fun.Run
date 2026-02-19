// backend/server.js  (FULL FILE)

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

// -------------------- TRUST PROXY (Railway/Render) --------------------
if (String(process.env.TRUST_PROXY || "") === "1") {
  app.set("trust proxy", 1);
}

// -------------------- MIDDLEWARE (basic hardening) --------------------
app.use(morgan("tiny"));
app.use(helmet());
app.use(compression());

// IMPORTANT: 413 fix (increase body limit)
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

// -------------------- CORS (FIX) --------------------
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
      // your Vercel production domain (update if changes)
      "https://fun-run-lovat.vercel.app",
    ].join(",")
);

// Optional: allow any *.vercel.app previews if you want
const ALLOW_VERCEL_PREVIEWS = String(process.env.ALLOW_VERCEL_PREVIEWS || "1") === "1";

function isAllowedOrigin(origin) {
  if (!origin) return true; // server-to-server / curl
  if (CORS_ORIGINS.includes("*")) return true;
  if (CORS_ORIGINS.includes(origin)) return true;

  // allow vercel preview domains safely (optional)
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
      return cb(null, false); // block silently (safer than throwing)
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

// make sure preflight works
app.options("*", cors());

// -------------------- CONFIG --------------------
const PORT = Number(process.env.PORT || 5000);

// ✅ accept local/file/supabase cleanly
const DB_MODE_RAW = String(process.env.DB_MODE || "file").toLowerCase();
const DB_MODE = DB_MODE_RAW === "local" ? "file" : DB_MODE_RAW;

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
const OWNER_MAX_PERCENT = Number(process.env.OWNER_MAX_PERCENT || 20);

// -------------------- FILE DB --------------------
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
  return { coins: [], profiles: {}, referrals: {}, logs: [] };
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
      return init;
    }

    const store = data?.data || defaultStore();
    store.coins = Array.isArray(store.coins) ? store.coins.map(ensureCoin) : [];
    store.profiles = store.profiles && typeof store.profiles === "object" ? store.profiles : {};
    store.referrals = store.referrals && typeof store.referrals === "object" ? store.referrals : {};
    store.logs = Array.isArray(store.logs) ? store.logs : [];
    return store;
  }

  // file mode
  if (!fs.existsSync(FILE_DB_PATH)) {
    fs.writeFileSync(FILE_DB_PATH, JSON.stringify(defaultStore(), null, 2));
  }
  const raw = fs.readFileSync(FILE_DB_PATH, "utf-8");
  const store = JSON.parse(raw || "{}");
  const merged = { ...defaultStore(), ...store };
  merged.coins = Array.isArray(merged.coins) ? merged.coins.map(ensureCoin) : [];
  merged.profiles = merged.profiles && typeof merged.profiles === "object" ? merged.profiles : {};
  merged.referrals = merged.referrals && typeof merged.referrals === "object" ? merged.referrals : {};
  merged.logs = Array.isArray(merged.logs) ? merged.logs : [];
  return merged;
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
  fs.writeFileSync(FILE_DB_PATH, JSON.stringify(store, null, 2));
}

function findCoin(store, coinId) {
  const id = String(coinId || "").trim();
  return store.coins.find((x) => x.id === id) || null;
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

// -------------------- START --------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running on port: ${PORT}`);
  console.log(`✅ Solana RPC: ${SOLANA_RPC}`);
  console.log(`✅ DB MODE: ${DB_MODE}`);
  console.log(`✅ CORS_ORIGINS: ${CORS_ORIGINS.join(", ")}`);
  console.log(`✅ JSON_LIMIT: ${JSON_LIMIT}`);
});
