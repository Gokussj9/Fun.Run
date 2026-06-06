console.log("FUNRUN SERVER UPDATED");

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import postgres from "postgres";
import { WebSocketServer } from "ws";
import NodeCache from "node-cache";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from "@solana/web3.js";
import walletRoutes from "./routes/wallet.js";
import treasury from "./solana/treasury.js";
import { createMint } from "@solana/spl-token";
import morgan from "morgan";

console.log("SERVER UPDATED");

const app = express();

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

const coinCache = new NodeCache({
  stdTTL: 3,
  checkperiod: 5,
  useClones: false,
});

const profileCache = new NodeCache({
  stdTTL: 10,
  checkperiod: 20,
  useClones: false,
});

app.use(express.json({ limit: "15mb" }));

// -------------------- ENV --------------------
const PORT = process.env.PORT || 5000;
const TRUST_PROXY = String(process.env.TRUST_PROXY || "") === "1";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

const SOLANA_RPC = process.env.SOLANA_RPC || "https://rpc.ankr.com/solana";
const JSON_LIMIT = process.env.JSON_LIMIT || "15mb";

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
  console.log("CORS_ORIGINS:", CORS_ORIGINS);

const FEE_PCT = clampNum(Number(process.env.FEE_PCT || 1), 0, 10);
const OWNER_PCT_OF_FEE = clampNum(Number(process.env.OWNER_PCT_OF_FEE || 40), 0, 100);
const CREATOR_PCT_OF_FEE = clampNum(Number(process.env.CREATOR_PCT_OF_FEE || 40), 0, 100);
const REFERRAL_PCT_OF_FEE = clampNum(Number(process.env.REFERRAL_PCT_OF_FEE || 20), 0, 100);

const APP_OWNER_WALLET = String(process.env.APP_OWNER_WALLET || "HEBqdStfnZgygQVMxpq5CXjsfPPagytdZoAyY2WcC1ji").trim();
const SOL_USD = clampNum(Number(process.env.SOL_USD || 80), 1, 100000);

const VIRTUAL_SOL = clampNum(Number(process.env.VIRTUAL_SOL || 15), 0, 1000000);
const VIRTUAL_TOKEN_PCT = clampNum(Number(process.env.VIRTUAL_TOKEN_PCT || 30), 0.1, 95);
const SALE_SUPPLY_PCT = clampNum(Number(process.env.SALE_SUPPLY_PCT || 80), 1, 100);

const TOTAL_SUPPLY = Math.max(1, Number(process.env.TOTAL_SUPPLY || 1_000_000_000));
const MAX_CHART_POINTS = 140;
const PROFILE_TX_LIMIT = 120;
const PROFILE_HOLDING_TX_SCAN = 500;
const DEX_LAUNCH_MC_USD = 2_000_000;
function getSupplyFromInitialSol(sol) {
  const s = Number(sol || 0);

  if (s >= 0.001 && s <= 0.005) return 100_000_000_000; // 100B
  if (s > 0.005 && s <= 0.01) return 50_000_000_000;    // 50B
  if (s > 0.01 && s <= 0.1) return 10_000_000_000;      // 10B
  if (s > 0.1 && s <= 0.2) return 800_000_000;          // 800M
  if (s > 0.2 && s <= 0.5) return 700_000_000;          // 700M
  if (s > 0.5 && s <= 1) return 500_000_000;            // 500M
  if (s > 1 && s <= 10) return 400_000_000;             // 400M
  if (s > 10 && s <= 50) return 300_000_000;            // 300M
  if (s > 50 && s <= 100) return 200_000_000;           // 200M

  return 100_000_000; // >100 SOL
}


const DEX_OPTIONS = ["Raydium", "Orca", "Meteora"];

// -------------------- APP SETUP --------------------
if (TRUST_PROXY) app.set("trust proxy", 1);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.endsWith(".vercel.app") || origin.includes("localhost")) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.options("*", cors());
app.use(compression());

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("tiny"));
}

// IMPORTANT: walletRoutes sirf /wallet pe mount karo
// /api/profile pe NAHI - kyunke us pe wallet.js ka GET /:wallet
// hamare proper /profile/:wallet route ko override kar deta tha
app.use("/wallet", walletRoutes);

// -------------------- CLIENTS --------------------
const sql = DATABASE_URL
  ? postgres(DATABASE_URL, {
      ssl: "require",
      max: Math.max(5, Math.min(30, Number(process.env.PG_MAX_CONNECTIONS || 12))),
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
    })
  : null;

const connection = new Connection(
  SOLANA_RPC,
  {
    commitment: "confirmed",
    disableRetryOnRateLimit: false,
    confirmTransactionInitialTimeout: 60000,
  }
);

// -------------------- HELPERS --------------------
function nowMS() {
  return Date.now();
}

function clampNum(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function broadcast(event, payload) {
  const msg = JSON.stringify({
    event,
    payload,
  });

  if (typeof wsClients !== "undefined") {
    wsClients.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.send(msg);
      }
    });
  }
}

// -------------------- CUSTODIAL WALLET CREATION HELPER --------------------
// Direct function call - no HTTP fetch needed
async function createCustodialWallet() {
  try {
    const bip39 = (await import("bip39")).default;
    const { derivePath } = await import("ed25519-hd-key");
    const crypto = (await import("crypto")).default;

    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    console.log(
  "ENCRYPTION_KEY length:",
  process.env.ENCRYPTION_KEY?.length
);
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
      throw new Error("ENCRYPTION_KEY must be exactly 32 characters in .env");
    }

    const mnemonic = bip39.generateMnemonic();
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const path = "m/44'/501'/0'/0'";
    const derivedSeed = derivePath(path, seed.toString("hex")).key;
    const keypair = Keypair.fromSeed(derivedSeed);

    // Encrypt mnemonic
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    let encrypted = cipher.update(mnemonic);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const encryptedMnemonic =
      iv.toString("hex") + ":" + encrypted.toString("hex");

    const address = keypair.publicKey.toBase58();
    console.log("✅ CUSTODIAL WALLET GENERATED:", address);

    return { address, encryptedMnemonic };
  } catch (err) {
    console.log("❌ createCustodialWallet failed:", err?.message || err);
    throw err;
  }
}

async function scanWalletDeposits(wallet) {
  try {
    const w = String(wallet || "").trim();
    if (!w) return;

    const pub = new PublicKey(w);

    const lastSignature = await getLastDepositSignature(w);

    const signatures = await connection.getSignaturesForAddress(pub, { limit: 2 });

    if (!signatures?.length) return;

    for (const sig of signatures) {
      const signature = String(sig?.signature || "").trim();
      if (!signature) continue;

      if (lastSignature && signature === lastSignature) {
        break;
      }

      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      const accountKeys = tx?.transaction?.message?.accountKeys || [];

      const walletIndex = accountKeys.findIndex(
        (k) => String(k?.pubkey?.toString?.() || "") === w
      );

      if (walletIndex === -1) continue;

      const pre = safeNum(tx?.meta?.preBalances?.[walletIndex], 0) / 1_000_000_000;
      const post = safeNum(tx?.meta?.postBalances?.[walletIndex], 0) / 1_000_000_000;

      const instructions = tx?.transaction?.message?.instructions || [];

      let diff = 0;

      for (const ix of instructions) {
        const parsed = ix?.parsed;

        if (parsed?.type === "transfer" && parsed?.info?.destination === w) {
          diff = safeNum(parsed?.info?.lamports, 0) / 1_000_000_000;
          break;
        }
      }

      if (diff <= 0) continue;

      await creditDeposit({
        wallet: w,
        txHash: signature,
        amount: diff,
      });
    }

    if (signatures?.[0]?.signature) {
      await setLastDepositSignature(w, signatures[0].signature);
    }
  } catch (e) {
    console.log("scanWalletDeposits error:", e?.message || e);
  }
}

async function getBalance(wallet) {
  const w = String(wallet || "").trim();
  if (!w) return 0;

  const rows = await sql`
    select * from balances
    where wallet = ${w}
    limit 1
  `;

  return Math.max(0, safeNum(rows?.[0]?.sol, 0));
}

async function setBalance(wallet, amount) {
  const w = String(wallet || "").trim();

  await sql`
    insert into balances (wallet, sol, updated_at)
    values (${w}, ${Math.max(0, safeNum(amount, 0))}, now())
    on conflict (wallet)
    do update set
      sol = excluded.sol,
      updated_at = now()
  `;
}

async function decreaseBalance(wallet, amount) {
  const w = String(wallet || "").trim();
  const current = await getBalance(w);
  const next = current - Math.max(0, safeNum(amount, 0));

  if (next < 0) {
    throw new Error("Insufficient balance");
  }

  await setBalance(w, next);
  return next;
}

async function hasDeposit(txHash) {
  const hash = String(txHash || "").trim();
  if (!hash) return true;

  const rows = await sql`
    select id from deposits where tx_hash = ${hash} limit 1
  `;

  return !!rows?.[0];
}

async function saveDeposit({ wallet, txHash, amount, token = "SOL" }) {
  await sql`
    insert into deposits (id, wallet, tx_hash, amount, token, status, created_at)
    values (
      ${crypto.randomUUID()},
      ${wallet},
      ${txHash},
      ${Math.max(0, safeNum(amount, 0))},
      ${token},
      'confirmed',
      now()
    )
  `;
}

async function saveWithdrawal({ wallet, destination, amount, txHash, status = "confirmed" }) {
  await sql`
    insert into withdrawals (id, wallet, destination, amount, tx_hash, status)
    values (
      ${crypto.randomUUID()},
      ${wallet},
      ${destination},
      ${amount},
      ${txHash},
      ${status}
    )
  `;
}

async function creditDeposit({ wallet, txHash, amount }) {
  const w = String(wallet || "").trim();
  if (!w) return false;

  if (await hasDeposit(txHash)) {
    return false;
  }

  const currentBalance = await getBalance(w);
  const nextBalance = currentBalance + Math.max(0, safeNum(amount, 0));

  await saveDeposit({ wallet: w, txHash, amount, token: "SOL" });
  await setBalance(w, nextBalance);

  return true;
}

async function getLastDepositSignature(wallet) {
  const w = String(wallet || "").trim();

  const rows = await sql`
    select last_signature from deposit_scans where wallet = ${w} limit 1
  `;

  return String(rows?.[0]?.last_signature || "").trim();
}

async function setLastDepositSignature(wallet, signature) {
  const w = String(wallet || "").trim();

  await sql`
    insert into deposit_scans (wallet, last_signature, updated_at)
    values (${w}, ${signature}, now())
    on conflict (wallet)
    do update set
      last_signature = excluded.last_signature,
      updated_at = now()
  `;
}

function uid() {
  return Math.random().toString(36).slice(2) + nowMS().toString(36);
}

function asObj(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

function saleSupplyFromTotal(totalSupply) {
  const total = Math.max(1, safeNum(totalSupply, TOTAL_SUPPLY));
  return Math.max(1, Math.floor(total * (SALE_SUPPLY_PCT / 100)));
}

function calcVirtualTokens(totalSupply, curveSupply, explicitVTokens) {
  const total = Math.max(1, safeNum(totalSupply, TOTAL_SUPPLY));
  const curve = Math.max(1, safeNum(curveSupply, saleSupplyFromTotal(total)));
  return Math.max(1, safeNum(explicitVTokens, (curve * VIRTUAL_TOKEN_PCT) / 100));
}

function calcPricing(input) {
  const totalSupply = Math.max(1, safeNum(input?.totalSupply, TOTAL_SUPPLY));
  const curveSupply = Math.max(
    1,
    safeNum(input?.curveSupply, saleSupplyFromTotal(totalSupply))
  );
  const solReserve = Math.max(0, safeNum(input?.solReserve, 0));
  const tokenReserve = Math.max(1, safeNum(input?.tokenReserve, curveSupply));
  const vSol = Math.max(1e-9, safeNum(input?.vSol, VIRTUAL_SOL));
  const vTokens = calcVirtualTokens(totalSupply, curveSupply, input?.vTokens);

  const priceSol = (solReserve + vSol) / (tokenReserve + vTokens);
  const priceUsd = priceSol * SOL_USD;
  const circulating = Math.max(0, totalSupply - tokenReserve);
  const mcUsd = priceUsd * circulating;

  return {
    priceSol,
    priceUsd,
    mcUsd,
    circulating,
  };
}

function mapDbCoinToApi(row = {}) {
  const totalSupply = Math.max(1, safeNum(row.total_supply, TOTAL_SUPPLY));
  const curveSupply = Math.max(1, safeNum(row.curve_supply, saleSupplyFromTotal(totalSupply)));
  const tokenReserve = clampNum(safeNum(row.reserve_token, curveSupply), 1, curveSupply);
  const curveSold = clampNum(safeNum(row.curve_sold, curveSupply - tokenReserve), 0, curveSupply);
  const vSol = Math.max(1e-9, safeNum(row.v_sol, VIRTUAL_SOL));
  const vTokens = calcVirtualTokens(totalSupply, curveSupply, row.v_tokens);

  const pricing = calcPricing({
    totalSupply,
    curveSupply,
    solReserve: safeNum(row.reserve_sol, 0),
    tokenReserve,
    vSol,
    vTokens,
  });

  const chartInput = Array.isArray(row.chart)
    ? row.chart.filter((n) => Number.isFinite(Number(n))).map(Number)
    : [];

  const seedPrice = Math.max(0, safeNum(pricing.priceUsd, 0));

  const chart =
    chartInput.length > 0
      ? chartInput.slice(-MAX_CHART_POINTS)
      : [seedPrice, seedPrice, seedPrice, seedPrice, seedPrice];

  const safeId = String(row.id || row.coin_id || "").trim();
  if (!safeId) return null;

  return {
    id: safeId,
    name: String(row.name || "").trim(),
    symbol: String(row.symbol || "").trim().toUpperCase(),
    story: String(row.story || "").trim(),
    logo: String(row.logo || ""),
    metadataUri: String(row.metadata_uri || ""),
    creatorWallet: String(row.creator_wallet || "").trim(),
    owner: String(row.creator_wallet || "").trim(),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : nowMS(),
    status: "LIVE",
    totalSupply,
    curveSupply,
    curveSold,
    vTokens,
    vSol,
    solReserve: Math.max(0, safeNum(row.reserve_sol, 0)),
    tokenReserve,
    volumeSol: Math.max(0, safeNum(row.volume_sol, 0)),
    lastTradeAt: safeNum(row.last_trade_at, 0),
    priceSol: pricing.priceSol,
    priceUsd: pricing.priceUsd,
    price: pricing.priceUsd,
    lastPriceUsd: pricing.priceUsd,
    mc: Math.max(0, safeNum(row.market_cap, pricing.mcUsd)),
    ath: Math.max(
      Math.max(0, safeNum(row.ath_market_cap, 0)),
      Math.max(0, safeNum(row.market_cap, pricing.mcUsd)),
      pricing.mcUsd
    ),
    chart,
    holders: asObj(row.holders, {}),
    creatorRewardsSol: Math.max(0, safeNum(row.creator_rewards, 0)),
  };
}

function coinToDbUpdate(coin = {}) {
  const rawMarketCap = Math.max(0, safeNum(coin.mc, 0));

  const boostedMarketCap =
    rawMarketCap > 0
      ? Math.max(rawMarketCap, 5000 + Math.random() * 3000)
      : 5000 + Math.random() * 3000;

  return {
    name: coin.name || "",
    symbol: coin.symbol || "",
    story: coin.story || "",
    logo: coin.logo || "",
    metadata_uri: coin.metadataUri || "",
    mint_address: coin.mintAddress || "",
mint_signature: coin.mintSignature || "",
    creator_wallet: coin.creatorWallet || coin.owner || "",
    created_at: new Date(coin.createdAt || Date.now()).toISOString(),
    total_supply: coin.totalSupply || TOTAL_SUPPLY,
    curve_supply:
      coin.curveSupply || saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY),
    curve_sold: coin.curveSold || 0,
    v_sol: coin.vSol || VIRTUAL_SOL,
    v_tokens:
      coin.vTokens ||
      calcVirtualTokens(
        coin.totalSupply || TOTAL_SUPPLY,
        coin.curveSupply || saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY),
        coin.vTokens
      ),
    reserve_sol: coin.solReserve || 0,
    reserve_token:
      coin.tokenReserve || coin.curveSupply || saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY),
    market_cap: boostedMarketCap,
    last_price: coin.priceSol || 0,
    ath_market_cap: Math.max(boostedMarketCap, safeNum(coin.ath, 0)),
    volume_sol: coin.volumeSol || 0,
    last_trade_at: coin.lastTradeAt || 0,
    creator_rewards: coin.creatorRewardsSol || 0,
    holders: asObj(coin.holders, {}),
    chart: Array.isArray(coin.chart) ? coin.chart.slice(-MAX_CHART_POINTS) : [],
  };
}

function ensureProfileShape(row = {}, wallet = "") {
  const primaryWallet = String(
    row.wallet ||
    wallet ||
    ""
  ).trim();

  const custodialWallet = String(
    row.wallet_address ||
    row.connectedWallet ||
    ""
  ).trim();

  return {
    wallet: primaryWallet,

    // IMPORTANT
    wallet_address: custodialWallet,

    // frontend compatibility
    connectedWallet: custodialWallet,

    encrypted_mnemonic: String(
      row.encrypted_mnemonic || ""
    ).trim(),

    referrer: String(row.referrer || "").trim(),

    referral_rewards: Math.max(
      0,
      safeNum(row.referral_rewards, 0)
    ),

    run_balance: Math.max(
  0,
  safeNum(row.run_balance, 700000)
),

    creator_rewards: Math.max(
      0,
      safeNum(row.creator_rewards, 0)
    ),

    owner_rewards: Math.max(
      0,
      safeNum(row.owner_rewards, 0)
    ),

    referral_code: String(
      row.referral_code || primaryWallet.slice(0, 6)
    ),

    referral_count: Math.max(
      0,
      safeNum(row.referral_count, 0)
    ),

    created_at:
      row.created_at || new Date().toISOString(),

    updated_at:
      row.updated_at || new Date().toISOString(),
  };
}

async function uploadLogoToIPFS(dataUrl, fileName = "coin-logo.webp") {
  const m = String(dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
  if (!m) throw new Error("Invalid logo data");

  const mimeType = m[1];
  const base64Data = m[2];
  const buffer = Buffer.from(base64Data, "base64");

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType }), fileName);
  form.append("pinataMetadata", JSON.stringify({ name: fileName }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.IpfsHash) {
    throw new Error(json?.error?.reason || json?.message || "Logo IPFS upload failed");
  }

  return {
    cid: json.IpfsHash,
    url: `https://ipfs.io/ipfs/${json.IpfsHash}`,
    ipfs: `ipfs://${json.IpfsHash}`,
  };
}

async function uploadMetadataToIPFS(metadata) {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pinataContent: metadata }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.IpfsHash) {
    throw new Error(json?.error?.reason || json?.message || "Metadata IPFS upload failed");
  }

  return {
    cid: json.IpfsHash,
    url: `https://ipfs.io/ipfs/${json.IpfsHash}`,
    ipfs: `ipfs://${json.IpfsHash}`,
  };
}

async function requireDb() {
  if (!sql) throw new Error("DATABASE_URL not configured");
}

async function ensureSchema() {
  await requireDb();

  await sql`
    create table if not exists coins (
      id text primary key,
      name text,
      symbol text,
      story text,
      logo text,
      metadata_uri text,
      creator_wallet text,
      created_at timestamptz default now(),
      total_supply numeric,
      curve_supply numeric,
      curve_sold numeric,
      v_sol numeric,
      v_tokens numeric,
      reserve_sol numeric,
      reserve_token numeric,
      market_cap numeric,
      last_price numeric,
      ath_market_cap numeric,
      volume_sol numeric default 0,
      last_trade_at bigint default 0,
      creator_rewards numeric default 0,
      holders jsonb default '{}'::jsonb
    )`;

    await sql`
  alter table coins
  add column if not exists mint_address text
`;

await sql`
  alter table coins
  add column if not exists mint_signature text
`;

  await sql`
    create table if not exists profiles (
      wallet text primary key,
      referrer text,
      referral_rewards numeric default 0,
      creator_rewards numeric default 0,
      owner_rewards numeric default 0,
      referral_code text,
      referral_count integer default 0,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      wallet_address text,
run_balance numeric default 700000,
encrypted_mnemonic text
    )`;

  await sql`alter table profiles add column if not exists wallet_address text`;
  await sql`alter table profiles add column if not exists encrypted_mnemonic text`;
  await sql`alter table profiles add column if not exists run_balance numeric default 700000`;

  await sql`
    create table if not exists transactions (
      id text primary key,
      wallet text,
      coin_id text,
      type text,
      sol numeric default 0,
      tokens numeric default 0,
      fee numeric default 0,
      created_at timestamptz default now()
    )`;

  await sql`
    create table if not exists holdings (
      wallet text not null,
      coin_id text not null,
      tokens numeric default 0,
      updated_at timestamptz default now(),
      primary key (wallet, coin_id)
    )`;

  await sql`
    create table if not exists deposits (
      id text primary key,
      wallet text not null,
      tx_hash text unique not null,
      amount numeric not null default 0,
      token text not null default 'SOL',
      status text not null default 'confirmed',
      created_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists withdrawals (
      id text primary key,
      wallet text not null,
      destination text not null,
      amount numeric not null default 0,
      tx_hash text,
      status text not null default 'pending',
      created_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists balances (
      wallet text primary key,
      sol numeric not null default 0,
      updated_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists deposit_scans (
      wallet text primary key,
      last_signature text,
      updated_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists candles (
      coin_id text not null,
      timeframe text not null,
      bucket_time bigint not null,
      open numeric default 0,
      high numeric default 0,
      low numeric default 0,
      close numeric default 0,
      volume_sol numeric default 0,
      trades_count integer default 0,
      updated_at timestamptz default now(),
      primary key (coin_id, timeframe, bucket_time)
    )`;

  await sql`create index if not exists coins_created_at_idx on coins (created_at desc)`;
  await sql`create index if not exists coins_creator_wallet_idx on coins (creator_wallet)`;
  await sql`create index if not exists tx_coin_id_created_at_idx on transactions (coin_id, created_at desc)`;
  await sql`create index if not exists tx_wallet_created_at_idx on transactions (wallet, created_at desc)`;
  await sql`create index if not exists profiles_referrer_idx on profiles (referrer)`;
  await sql`create index if not exists holdings_wallet_idx on holdings (wallet)`;
  await sql`create index if not exists holdings_coin_id_idx on holdings (coin_id)`;
  await sql`create index if not exists candles_coin_tf_bucket_idx on candles (coin_id, timeframe, bucket_time desc)`;
  await sql`create index if not exists profiles_wallet_address_idx on profiles (wallet_address)`;
}

function profileToDbRow(profile = {}) {
  return {
    wallet: String(profile.wallet || "").trim(),
    referrer: String(profile.referrer || "").trim(),
    referral_rewards: Math.max(0, safeNum(profile.referral_rewards, 0)),
    run_balance: Math.max(0, safeNum(profile.run_balance, 700000)),
    creator_rewards: Math.max(0, safeNum(profile.creator_rewards, 0)),
    owner_rewards: Math.max(0, safeNum(profile.owner_rewards, 0)),
    referral_code: String(profile.referral_code || ""),
    referral_count: Math.max(0, safeNum(profile.referral_count, 0)),
    wallet_address: String(profile.wallet_address || "").trim(),
    encrypted_mnemonic: String(profile.encrypted_mnemonic || "").trim(),
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString(),
  };
}

async function getProfile(wallet, createIfMissing = true) {
  const w = String(wallet || "").trim();
  if (!w) return null;

  await requireDb();

  const rows = await sql`select * from profiles where wallet = ${w} limit 1`;

  // Existing profile mil gayi
  if (rows[0]) {
    const profile = rows[0];

    // Agar custodial wallet nahi he, abhi banao
    if (!profile.wallet_address) {
      console.log("⚠️ Profile exists but no custodial wallet. Generating now for:", w);

      try {
        const walletData = await createCustodialWallet();

        await sql`
          update profiles
          set
            wallet_address = ${walletData.address},
            encrypted_mnemonic = ${walletData.encryptedMnemonic},
            updated_at = now()
          where wallet = ${w}
        `;

        profile.wallet_address = walletData.address;
        profile.encrypted_mnemonic = walletData.encryptedMnemonic;

        console.log("✅ Custodial wallet attached to profile:", w, "→", walletData.address);
      } catch (err) {
        console.log("❌ Failed to generate custodial wallet:", err?.message || err);
      }
    }

    return ensureProfileShape(profile, w);
  }

  // Profile nahi mili
  if (!createIfMissing) return null;

  // Nayi profile + custodial wallet ek saath banao
  let walletData = { address: "", encryptedMnemonic: "" };

  try {
    walletData = await createCustodialWallet();
  } catch (err) {
    console.log("❌ Custodial wallet creation failed during new profile:", err?.message || err);
  }

  const payload = profileToDbRow(
    ensureProfileShape(
      {
        wallet: w,
        wallet_address: walletData.address,
        encrypted_mnemonic: walletData.encryptedMnemonic,
      },
      w
    )
  );

  const inserted = await sql`
    insert into profiles (
      wallet, referrer, referral_rewards, run_balance, creator_rewards, owner_rewards,
      referral_code, referral_count, wallet_address, encrypted_mnemonic,
      created_at, updated_at
    )
    values (
      ${payload.wallet},
      ${payload.referrer},
      ${payload.referral_rewards},
      ${payload.run_balance},
      ${payload.creator_rewards},
      ${payload.owner_rewards},
      ${payload.referral_code},
      ${payload.referral_count},
      ${payload.wallet_address},
      ${payload.encrypted_mnemonic},
      ${payload.created_at},
      ${payload.updated_at}
    )
    on conflict (wallet)
    do update set
      updated_at = excluded.updated_at
    returning *`;

  console.log("✅ New profile created for:", w, "| Custodial wallet:", walletData.address);

  return ensureProfileShape(inserted[0], w);
}

async function patchProfile(wallet, patch = {}) {
  const w = String(wallet || "").trim();
  if (!w) throw new Error("wallet required");

  const current = await getProfile(w, true);
  const next = profileToDbRow(
    ensureProfileShape(
      {
        ...current,
        ...patch,
        wallet: w,
        updated_at: new Date().toISOString(),
      },
      w
    )
  );

  const rows = await sql`
    insert into profiles (
      wallet, referrer, referral_rewards, run_balance, creator_rewards, owner_rewards,
      referral_code, referral_count, wallet_address, encrypted_mnemonic,
      created_at, updated_at
    )
    values (
      ${next.wallet}, ${next.referrer}, ${next.referral_rewards},
      ${next.run_balance},
      ${next.creator_rewards}, ${next.owner_rewards}, ${next.referral_code},
      ${next.referral_count}, ${next.wallet_address}, ${next.encrypted_mnemonic},
      ${next.created_at}, ${next.updated_at}
    )
    on conflict (wallet) do update set
      referrer = excluded.referrer,
      referral_rewards = excluded.referral_rewards,
      run_balance = excluded.run_balance,
      creator_rewards = excluded.creator_rewards,
      owner_rewards = excluded.owner_rewards,
      referral_code = excluded.referral_code,
      referral_count = excluded.referral_count,
      wallet_address = coalesce(nullif(excluded.wallet_address, ''), profiles.wallet_address),
      encrypted_mnemonic = coalesce(nullif(excluded.encrypted_mnemonic, ''), profiles.encrypted_mnemonic),
      updated_at = excluded.updated_at
    returning *`;

  return ensureProfileShape(rows[0], w);
}

async function addProfileReward(wallet, column, amount) {
  const w = String(wallet || "").trim();
  const col = String(column || "").trim();
  const delta = Math.max(0, safeNum(amount, 0));

  if (!w || delta <= 0) return null;

  const allowed = new Set(["referral_rewards", "creator_rewards", "owner_rewards"]);
  if (!allowed.has(col)) throw new Error("invalid rewards column");

  // Ensure profile exists with custodial wallet
  await getProfile(w, true);

  const rows = await sql`
    update profiles
    set
      ${sql(col)} = profiles.${sql(col)} + ${delta},
      updated_at = now()
    where wallet = ${w}
    returning *
  `;

  return ensureProfileShape(rows[0], w);
}

async function countReferrals(wallet) {
  const w = String(wallet || "").trim();
  if (!w) return 0;
  await requireDb();
  const rows = await sql`select count(*)::int as count from profiles where referrer = ${w}`;
  return safeNum(rows?.[0]?.count, 0);
}

async function syncReferralCount(wallet) {
  const count = await countReferrals(wallet);
  await patchProfile(wallet, { referral_count: count });
  return count;
}

async function insertTransaction(tx = {}) {
  await requireDb();
  const row = {
    id: String(tx.id || uid()),
    wallet: String(tx.wallet || ""),
    coin_id: String(tx.coinId || tx.coin_id || ""),
    type: String(tx.type || tx.side || "TX").toUpperCase(),
    sol: Math.max(0, safeNum(tx.sol, 0)),
    tokens: Math.max(0, safeNum(tx.tokens, 0)),
    fee: Math.max(0, safeNum(tx.fee, 0)),
    created_at: new Date().toISOString(),
  };

  const cachedCoin = coinCache.get(row.coin_id);
  if (cachedCoin) {
    cachedCoin.last_trade_at = Date.now();
  }

  await sql`
    insert into transactions (id, wallet, coin_id, type, sol, tokens, fee, created_at)
    values (${row.id}, ${row.wallet}, ${row.coin_id}, ${row.type}, ${row.sol}, ${row.tokens}, ${row.fee}, ${row.created_at})`;

  broadcast("trade:new", {
    coinId: row.coin_id,
    type: row.type,
    sol: row.sol,
    tokens: row.tokens,
    price: row.price,
    ts: Date.now(),
  });

  return row;
}

async function upsertHolding(wallet, coinId, mode = "set", amount = 0) {
  const w = String(wallet || "").trim();
  const c = String(coinId || "").trim();

  if (!w || !c) return 0;

  const delta = Number(amount || 0);

  const rows = await sql.begin(async (tx) => {
    const current = await tx`
      SELECT tokens FROM holdings
      WHERE wallet = ${w} AND coin_id = ${c}
      FOR UPDATE
    `;

    const prev = Number(current?.[0]?.tokens || 0);

    let next = prev;

    if (mode === "inc") {
      next = prev + delta;
    } else if (mode === "dec") {
      next = Math.max(0, prev - delta);
    } else {
      next = Math.max(0, delta);
    }

    await tx`
      INSERT INTO holdings (wallet, coin_id, tokens, updated_at)
      VALUES (${w}, ${c}, ${next}, NOW())
      ON CONFLICT (wallet, coin_id)
      DO UPDATE SET
        tokens = EXCLUDED.tokens,
        updated_at = NOW()
    `;

    return next;
  });

  return rows;
}

async function getCoinRowById(coinId) {
  const id = String(coinId || "").trim();
  if (!id) return null;

  const cached = coinCache.get(id);
  if (cached) return cached;

  await requireDb();

  const rows = await sql`select * from coins where id = ${id} limit 1`;
  const row = rows[0] || null;

  if (row) {
    coinCache.set(id, row);
  }

  return row;
}

async function getRecentCoinActivity(coinId, limit = 50) {
  const id = String(coinId || "").trim();
  const cacheKey = `activity_${id}_${limit}`;
  const cached = coinCache.get(cacheKey);
  if (cached) return cached;

  if (!id) return [];
  await requireDb();
  const safeLimit = Math.max(1, Math.min(120, safeNum(limit, 50)));
  const rows = await sql`
    select id, coin_id, type, sol, tokens, fee, created_at, wallet
    from transactions where coin_id = ${id} order by created_at desc limit ${safeLimit}
  `;

  const activity = Array.isArray(rows)
    ? rows.map((t) => ({
        id: t.id,
        coinId: t.coinId || t.coin_id,
        side: String(t.type || "TX").toUpperCase(),
        type: String(t.type || "TX").toUpperCase(),
        sol: safeNum(t.sol, 0),
        tokens: safeNum(t.tokens, 0),
        fee: safeNum(t.fee, 0),
        ts: t.createdAt
          ? new Date(t.createdAt).getTime()
          : t.created_at
          ? new Date(t.created_at).getTime()
          : nowMS(),
        wallet: t.wallet,
      }))
    : [];

  coinCache.set(cacheKey, activity);
  return activity;
}

async function saveCoin(coin) {
  await requireDb();
  const payload = {
    id: String(coin.id || uid()),
    ...coinToDbUpdate(coin),
  };

  const rows = await sql`
    insert into coins (
      id, name, symbol, story, logo, metadata_uri, mint_address, mint_signature, creator_wallet, created_at,
      total_supply, curve_supply, curve_sold, v_sol, v_tokens,
      reserve_sol, reserve_token, market_cap, last_price, ath_market_cap,
      volume_sol, last_trade_at, creator_rewards, chart, holders
    )
    values (
      ${payload.id}, ${payload.name}, ${payload.symbol}, ${payload.story},
      ${payload.logo}, ${payload.metadata_uri},
${payload.mint_address}, ${payload.mint_signature},
${payload.creator_wallet}, ${payload.created_at},
      ${payload.total_supply}, ${payload.curve_supply}, ${payload.curve_sold},
      ${payload.v_sol}, ${payload.v_tokens},
      ${payload.reserve_sol}, ${payload.reserve_token},
      ${payload.market_cap}, ${payload.last_price}, ${payload.ath_market_cap},
      ${payload.volume_sol}, ${payload.last_trade_at},
      ${payload.creator_rewards}, ${payload.chart || []}, ${payload.holders || {}}
    )
    on conflict (id) do update set
      name = excluded.name,
      symbol = excluded.symbol,
      story = excluded.story,
      logo = excluded.logo,
      metadata_uri = excluded.metadata_uri,
      mint_address = excluded.mint_address,
mint_signature = excluded.mint_signature,
      creator_wallet = excluded.creator_wallet,
      created_at = excluded.created_at,
      total_supply = excluded.total_supply,
      curve_supply = excluded.curve_supply,
      curve_sold = excluded.curve_sold,
      v_sol = excluded.v_sol,
      v_tokens = excluded.v_tokens,
      reserve_sol = excluded.reserve_sol,
      reserve_token = excluded.reserve_token,
      market_cap = excluded.market_cap,
      last_price = excluded.last_price,
      ath_market_cap = excluded.ath_market_cap,
      volume_sol = excluded.volume_sol,
      last_trade_at = excluded.last_trade_at,
      creator_rewards = excluded.creator_rewards,
      chart = excluded.chart,
      holders = excluded.holders
    returning *`;

  coinCache.set(payload.id, rows[0]);
  broadcast("coin:update", mapDbCoinToApi(rows[0]));

  return mapDbCoinToApi(rows[0]);
}

function buildChartTrail(prevChart, nextPoint, sideHint = "") {
  const history = Array.isArray(prevChart)
    ? prevChart.map((x) => Math.max(0, safeNum(x, 0))).filter((x) => Number.isFinite(x) && x > 0)
    : [];

  const point = Math.max(0, safeNum(nextPoint, 0));

  if (!point) {
    return history.length ? history.slice(-MAX_CHART_POINTS) : [0];
  }

  if (!history.length) {
    return [point * 0.78, point * 0.92, point * 1.06, point * 1.22, point * 1.12, point];
  }

  const last = Math.max(1e-9, safeNum(history[history.length - 1], point));
  const isSell = String(sideHint || "").toLowerCase() === "sell";

  let finalPoint = point;

  if (!isSell && finalPoint <= last) {
    finalPoint = last * (1 + Math.random() * 0.04);
  }

  if (isSell && finalPoint >= last) {
    finalPoint = last * (1 - Math.random() * 0.03);
  }

  const volatility = finalPoint * (0.01 + Math.random() * 0.025);
  const noisyPoint = finalPoint + (Math.random() > 0.5 ? volatility : -volatility);

  return history.slice(-(MAX_CHART_POINTS - 1)).concat([Math.max(0.00000001, noisyPoint)]);
}

function recalcCoin(coin, opts = {}) {
  const fixed = {
    ...coin,
    totalSupply: Math.max(1, safeNum(coin.totalSupply, TOTAL_SUPPLY)),
    curveSupply: Math.max(1, safeNum(coin.curveSupply, saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY))),
    tokenReserve: Math.max(1, safeNum(coin.tokenReserve, saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY))),
    solReserve: Math.max(0, safeNum(coin.solReserve, 0)),
    vSol: Math.max(1e-9, safeNum(coin.vSol, VIRTUAL_SOL)),
    vTokens: calcVirtualTokens(
      coin.totalSupply || TOTAL_SUPPLY,
      coin.curveSupply || saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY),
      coin.vTokens
    ),
    holders: asObj(coin.holders, {}),
  };

  fixed.curveSold = clampNum(
    safeNum(fixed.curveSold, fixed.curveSupply - fixed.tokenReserve),
    0,
    fixed.curveSupply
  );

  const pricing = calcPricing({
    totalSupply: fixed.totalSupply,
    curveSupply: fixed.curveSupply,
    solReserve: fixed.solReserve,
    tokenReserve: fixed.tokenReserve,
    vSol: fixed.vSol,
    vTokens: fixed.vTokens,
  });

  fixed.priceSol = pricing.priceSol;
  fixed.priceUsd = pricing.priceUsd;
  fixed.price = pricing.priceUsd;
  fixed.lastPriceUsd = pricing.priceUsd;
  fixed.mc = pricing.mcUsd;

  const point = Math.max(0, safeNum(pricing.priceUsd, 0));
  const prev = Array.isArray(fixed.chart) ? fixed.chart : [];
  const shouldAppend = opts.appendChart !== false;

  fixed.chart = shouldAppend
    ? buildChartTrail(prev, point, opts.sideHint)
    : prev.length
    ? prev.slice(-MAX_CHART_POINTS)
    : [point, point, point, point, point];

  fixed.lastTradeAt = nowMS();
  fixed.ath = Math.max(safeNum(fixed.ath, 0), pricing.mcUsd);

  return fixed;
}

async function upsertCandlesForTrade(coinId, price, volumeSol) {
  await requireDb();

  const id = String(coinId || "").trim();
  if (!id) return;

  const now = Date.now();
  const p = Math.max(0.00000001, safeNum(price, 0.00000001));
  const vol = Math.max(0, safeNum(volumeSol, 0));

  const timeframes = [
    ["5m", 300_000],
    ["15m", 900_000],
    ["1h", 3_600_000],
    ["4h", 14_400_000],
    ["1d", 86_400_000],
    ["1w", 604_800_000],
    ["1m", 2_592_000_000],
  ];

  for (const [tf, ms] of timeframes) {
    const bucket = Math.floor(now / ms) * ms;

    const existing = await sql`
      select open, high, low, close
      from candles
      where coin_id = ${id} and timeframe = ${tf} and bucket_time = ${bucket}
      limit 1
    `;

    if (existing.length === 0) {
      const prev = await sql`
        select close from candles
        where coin_id = ${id} and timeframe = ${tf} and bucket_time < ${bucket}
        order by bucket_time desc limit 1
      `;

      const openPrice = Math.max(0.00000001, safeNum(prev?.[0]?.close, p));
      const highPrice = Math.max(openPrice, p);
      const lowPrice = Math.min(openPrice, p);

      await sql`
        insert into candles (
          coin_id, timeframe, bucket_time,
          open, high, low, close,
          volume_sol, trades_count, updated_at
        )
        values (
          ${id}, ${tf}, ${bucket},
          ${openPrice}, ${highPrice}, ${lowPrice}, ${p},
          ${vol}, 1, now()
        )
        on conflict (coin_id, timeframe, bucket_time)
        do update set
          high = greatest(candles.high, excluded.high),
          low = least(candles.low, excluded.low),
          close = excluded.close,
          volume_sol = candles.volume_sol + excluded.volume_sol,
          trades_count = candles.trades_count + 1,
          updated_at = now()
      `;
    } else {
      await sql`
        update candles
        set
          high = greatest(high, ${p}),
          low = least(low, ${p}),
          close = ${p},
          volume_sol = volume_sol + ${vol},
          trades_count = trades_count + 1,
          updated_at = now()
        where coin_id = ${id} and timeframe = ${tf} and bucket_time = ${bucket}
      `;
    }
  }
}

function applyFee(solAmount) {
  const gross = Math.max(0, safeNum(solAmount, 0));
  const fee = gross * (FEE_PCT / 100);
  const net = Math.max(0, gross - fee);
  return { fee, net };
}

async function distributeFeeDirect(coin, traderWallet, feeSol) {
  const fee = Math.max(0, safeNum(feeSol, 0));
  if (fee <= 0) return;

  const creatorWallet = String(coin?.creatorWallet || coin?.owner || "").trim();

  const ownerPart = fee * (OWNER_PCT_OF_FEE / 100);
  const creatorPart = fee * (CREATOR_PCT_OF_FEE / 100);
  const referralPart = fee * (REFERRAL_PCT_OF_FEE / 100);

  const jobs = [];

  if (APP_OWNER_WALLET && ownerPart > 0) {
    jobs.push(addProfileReward(APP_OWNER_WALLET, "owner_rewards", ownerPart));
  }

  if (creatorWallet && creatorPart > 0) {
    jobs.push(addProfileReward(creatorWallet, "creator_rewards", creatorPart));
    coin.creatorRewardsSol = Math.max(0, safeNum(coin.creatorRewardsSol, 0) + creatorPart);
  }

  const creatorProfileRows =
    creatorWallet && referralPart > 0
      ? await sql`select referrer from profiles where wallet = ${creatorWallet} limit 1`
      : [];

  const creatorUpline = String(creatorProfileRows?.[0]?.referrer || "").trim();
  if (creatorUpline && creatorUpline !== creatorWallet && referralPart > 0) {
    jobs.push(addProfileReward(creatorUpline, "referral_rewards", referralPart));
  }

  if (jobs.length) await Promise.all(jobs);
}

function ammBuy(coin, wallet, solInGross) {
  const { fee, net } = applyFee(solInGross);
  if (net <= 0) return { ok: false, error: "Invalid amount" };

  const totalSupply = Math.max(1, safeNum(coin.totalSupply, TOTAL_SUPPLY));
  const curveSupply = Math.max(1, safeNum(coin.curveSupply, saleSupplyFromTotal(totalSupply)));

  coin.holders = asObj(coin.holders, {});
  coin.solReserve = Math.max(0, safeNum(coin.solReserve, 0));
  coin.tokenReserve = Math.max(1, safeNum(coin.tokenReserve, curveSupply));

  const vSol = Math.max(1e-9, safeNum(coin.vSol, VIRTUAL_SOL));
  const vTokens = calcVirtualTokens(totalSupply, curveSupply, coin.vTokens);

  const x = coin.solReserve + vSol;
  const y = coin.tokenReserve + vTokens;
  const k = x * y;

  const newX = x + net;
  const newY = k / newX;

  const tokensOut = Math.max(0, y - newY);

  if (tokensOut <= 0.0000001) {
    return { ok: false, error: "Buy too small" };
  }

  coin.solReserve += net;
  coin.tokenReserve -= tokensOut;

  coin.holders[wallet] = Math.max(0, safeNum(coin.holders[wallet], 0) + tokensOut);

  coin.volumeSol += solInGross;
  coin.lastTradeAt = nowMS();

  return { ok: true, tokensOut, feeSol: fee, netSol: net };
}

function ammSellByTokensIn(coin, wallet, tokensInRequested) {
  const tokensInRequestedNum = Math.max(0, safeNum(tokensInRequested, 0));
  if (tokensInRequestedNum <= 0) return { ok: false, error: "Invalid token amount" };

  const totalSupply = Math.max(1, safeNum(coin.totalSupply, TOTAL_SUPPLY));
  const curveSupply = Math.max(1, safeNum(coin.curveSupply, saleSupplyFromTotal(totalSupply)));

  coin.holders = asObj(coin.holders, {});
  coin.solReserve = Math.max(0, safeNum(coin.solReserve, 0));
  coin.tokenReserve = Math.max(1, safeNum(coin.tokenReserve, curveSupply));

  const holderBal = Math.max(0, safeNum(coin.holders[wallet], 0));
  if (holderBal <= 0) return { ok: false, error: "Not enough tokens" };

  const tokensIn = Math.min(tokensInRequestedNum, holderBal);

  const vSol = Math.max(1e-9, safeNum(coin.vSol, VIRTUAL_SOL));
  const vTokens = calcVirtualTokens(totalSupply, curveSupply, coin.vTokens);

  const x = coin.solReserve + vSol;
  const y = coin.tokenReserve + vTokens;
  const k = x * y;

  const newY = y + tokensIn;
  const newX = k / newY;

  const grossSolOut = Math.max(0, x - newX);

  if (grossSolOut <= 0.0000001) {
    return { ok: false, error: "Sell too small" };
  }

  if (grossSolOut > coin.solReserve) {
    return { ok: false, error: "Pool empty" };
  }

  const fee = grossSolOut * (FEE_PCT / 100);
  const netSol = Math.max(0, grossSolOut - fee);

  coin.solReserve -= grossSolOut;
  coin.tokenReserve += tokensIn;

  coin.holders[wallet] = Math.max(0, holderBal - tokensIn);
  if (coin.holders[wallet] <= 0.0000001) delete coin.holders[wallet];

  coin.volumeSol += grossSolOut;
  coin.lastTradeAt = nowMS();

  return {
    ok: true,
    tokensIn,
    solOut: grossSolOut,
    solOutGross: grossSolOut,
    solOutNet: netSol,
    feeSol: fee,
  };
}

// -------------------- TRADE LOCK --------------------
const COIN_TRADE_LOCKS = new Map();

async function runCoinLocked(coinId, fn) {
  const key = String(coinId || "");
  const prev = COIN_TRADE_LOCKS.get(key) || Promise.resolve();

  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });

  COIN_TRADE_LOCKS.set(key, prev.then(() => next));

  try {
    await prev;
    return await fn();
  } finally {
    release();
    if (COIN_TRADE_LOCKS.get(key) === next) {
      COIN_TRADE_LOCKS.delete(key);
    }
  }
}

// -------------------- ROUTES --------------------
app.get("/", async (req, res) => {
  return res.json({
    ok: true,
    name: "pumpmini-backend",
    dbMode: "neon-postgres",
    ts: nowMS(),
  });
});

app.get("/health", async (req, res) => {
  try {
    let coins = 0;
    if (sql) {
      const rows = await sql`select count(*)::int as count from coins`;
      coins = safeNum(rows?.[0]?.count, 0);
    }

    return res.json({
      ok: true,
      dbMode: "neon-postgres",
      coins,
      ts: Date.now(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "health failed" });
  }
});

app.get("/balance/:wallet", async (req, res) => {
  try {
    const wallet = String(req.params.wallet || "").trim();

    if (!wallet) {
      return res.json({ ok: false, error: "wallet required" });
    }

    // Try custodial wallet first
    const profile = await getProfile(wallet, false);
    const lookupWallet = profile?.wallet_address || wallet;

    const sol = await getBalance(lookupWallet);

    return res.json({ ok: true, sol });
  } catch (e) {
    return res.json({ ok: true, sol: 0 });
  }
});

app.post("/debug/deposit", async (req, res) => {
  if (process.env.ALLOW_DEBUG !== "1") {
    return res.status(403).json({ ok: false, error: "disabled" });
  }
  try {
    const wallet = String(req.body?.wallet || "").trim();


    const amount = Math.max(0, safeNum(req.body?.amount, 0));
    const txHash = String(req.body?.txHash || crypto.randomUUID()).trim();

    if (!wallet) {
      return res.status(400).json({ ok: false, error: "wallet required" });
    }

    await creditDeposit({ wallet, txHash, amount });
    const balance = await getBalance(wallet);

    return res.json({ ok: true, wallet, balance });
 } catch (e) {
  console.error("WITHDRAW ERROR:", e);

  return res.status(500).json({
    ok: false,
    error: e?.message || String(e),
  });
}
});

app.post("/withdraw", async (req, res) => {

  try {




    const wallet = String(req.body?.wallet || "").trim();
    const destination = String(req.body?.destination || "").trim();
    const amount = Math.max(0, safeNum(req.body?.amount, 0));
    const kind = String(req.body?.kind || "").trim().toUpperCase();

    if (!wallet) {
      return res.status(400).json({ ok: false, error: "wallet required" });
    }

    // Reward-based withdrawal (no on-chain transfer)
    if (kind === "REF" || kind === "REFERRAL" || kind === "CREATOR" || kind === "OWNER") {
      return handleRewardWithdraw(req, res, kind);
    }

    if (!destination) {
      return res.status(400).json({ ok: false, error: "destination required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ ok: false, error: "invalid amount" });
    }

    

    

    


    
 



// Pehle balance reserve karo (kam ho to yahin ruk jayega, SOL nahi jayega)
    const nextBalance = await decreaseBalance(wallet, amount);

    let signature;
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: treasury.publicKey,
          toPubkey: new PublicKey(destination),
          lamports: Math.floor(amount * 1_000_000_000),
        })
      );
      signature = await sendAndConfirmTransaction(connection, tx, [treasury]);
    } catch (sendErr) {
      await setBalance(wallet, (await getBalance(wallet)) + amount);
      throw sendErr;
    }

    await saveWithdrawal({
      wallet,
      destination,
      amount,
      txHash: signature,
      status: "confirmed",
    });

    return res.json({ ok: true, balance: nextBalance, txHash: signature });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

async function handleRewardWithdraw(req, res, forcedKind = "") {
  try {
    await requireDb();

    const wallet = String(req.body?.wallet || "").trim();
    const kindRaw = String(forcedKind || req.body?.kind || "").trim().toUpperCase();

    const kind =
      kindRaw === "REFERRAL" ? "REF" :
      kindRaw === "REF" ? "REF" :
      kindRaw === "CREATOR" ? "CREATOR" :
      kindRaw === "OWNER" ? "OWNER" : "";

    if (!["REF", "CREATOR", "OWNER"].includes(kind)) {
      return res.json({ ok: false, error: "Unsupported kind" });
    }

    const p = await getProfile(wallet, true);

    if (kind === "REF") {
      const amt = Math.max(0, safeNum(p.referral_rewards, 0));
      if (amt <= 0) return res.json({ ok: false, error: "No referral rewards" });
      await patchProfile(wallet, { referral_rewards: 0 });
      return res.json({ ok: true, kind: "REF", amountSol: amt, to: wallet });
    }

    if (kind === "CREATOR") {
      const amt = Math.max(0, safeNum(p.creator_rewards, 0));
      if (amt <= 0) return res.json({ ok: false, error: "No creator rewards" });
      await patchProfile(wallet, { creator_rewards: 0 });
      return res.json({ ok: true, kind: "CREATOR", amountSol: amt, to: wallet });
    }

    if (kind === "OWNER") {
      const amt = Math.max(0, safeNum(p.owner_rewards, 0));
      if (amt <= 0) return res.json({ ok: false, error: "No wallet balance" });
      await patchProfile(wallet, { owner_rewards: 0 });
      return res.json({ ok: true, kind: "OWNER", amountSol: amt, to: wallet });
    }

    return res.json({ ok: false, error: "Unsupported kind" });
  } catch (e) {
    console.log("reward withdraw error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

app.post("/withdraw/creator", (req, res) => handleRewardWithdraw(req, res, "CREATOR"));
app.post("/withdraw/referral", (req, res) => handleRewardWithdraw(req, res, "REF"));

app.get("/coin/list*", async (req, res) => {
  try {
    console.log("🔥 /coin/list hit");
    console.log("👉 query params:", req.query);
    await requireDb();

    const page = Math.max(0, Number(req.query.page || 0));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    const offset = page * limit;

    const rows = await sql`
      select * from coins
      order by created_at desc
      limit ${limit} offset ${offset}
    `;

    const coins = Array.isArray(rows) ? rows.map(mapDbCoinToApi).filter(Boolean) : [];

    return res.json({
      ok: true,
      coins,
      page,
      limit,
      hasMore: coins.length >= limit,
      hot15m: [],
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "coin list failed" });
  }
});

app.get("/coin/:id/dex-preview", async (req, res) => {
  try {
    await requireDb();
    const wallet = String(req.query.wallet || "").trim();
    const row = await getCoinRowById(req.params.id);
    const coin = row ? mapDbCoinToApi(row) : null;
    if (!coin) return res.status(404).json({ ok: false, error: "Coin not found" });

    const creatorWallet = String(coin.creatorWallet || coin.owner || "").trim();
    const isCreator = Boolean(wallet && creatorWallet && wallet === creatorWallet);
    const mc = Math.max(0, safeNum(coin.mc, 0));

    return res.json({
      ok: true,
      coinId: coin.id,
      eligible: isCreator && mc >= DEX_LAUNCH_MC_USD,
      isCreator,
      currentMc: mc,
      requiredMc: DEX_LAUNCH_MC_USD,
      options: DEX_OPTIONS,
      status: mc >= DEX_LAUNCH_MC_USD ? "READY_PHASE_2" : "LOCKED_UNTIL_2M_MC",
      message: "DEX launch is a safe placeholder. Real pool creation will be enabled after Phase 2 audit.",
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "DEX preview failed" });
  }
});

app.get("/coin/:id", async (req, res) => {
  try {
    await requireDb();
    const coin = mapDbCoinToApi(await getCoinRowById(req.params.id));
    if (!coin) return res.status(404).json({ ok: false, error: "Coin not found" });
    return res.json({ ok: true, coin });
  } catch (e) {
    console.log("coin/detail error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/coin/:id/activity", async (req, res) => {
  try {
    await requireDb();
    const limit = Math.min(120, Math.max(20, Number(req.query.limit || 60)));
    const activity = await getRecentCoinActivity(req.params.id, limit);
    return res.json({ ok: true, activity });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "activity failed" });
  }
});

app.get("/coin/:id/candles", async (req, res) => {
  try {
    await requireDb();

    const coinId = String(req.params.id || "").trim();
    const tfRaw = String(req.query.tf || "5m").trim().toLowerCase();
    const limit = Math.max(10, Math.min(300, safeNum(req.query.limit, 120)));

    const TF_MS = {
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "1w": 7 * 24 * 60 * 60 * 1000,
      "1m": 30 * 24 * 60 * 60 * 1000,
    };

    const tfMap = {
      "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h",
      "1d": "1d", "1w": "1w", "1m": "1m",
      "5M": "5m", "15M": "15m", "1H": "1h", "4H": "4h",
      "1D": "1d", "1W": "1w", "1M": "1m",
    };

    const tf = tfMap[tfRaw] || "5m";
    const bucketMs = TF_MS[tf] || TF_MS["5m"];

    const coinRows = await sql`select * from coins where id = ${coinId} limit 1`;
    const coin = Array.isArray(coinRows) && coinRows[0] ? coinRows[0] : null;
    if (!coin) {
      return res.status(404).json({ ok: false, error: "Coin not found" });
    }

    const coinApi = mapDbCoinToApi(coin) || {};
    const createdAtMs = coin?.created_at ? new Date(coin.created_at).getTime() : Date.now();
    const now = Date.now();

    let rows = await sql`
      select coin_id, timeframe, bucket_time, open, high, low, close, volume_sol, trades_count
      from candles
      where coin_id = ${coinId} and timeframe = ${tf}
      order by bucket_time desc limit ${limit}
    `;

    let candles = Array.isArray(rows)
      ? rows.slice().reverse().map((r) => ({
          time: safeNum(r.bucket_time, 0),
          open: safeNum(r.open, 0),
          high: safeNum(r.high, 0),
          low: safeNum(r.low, 0),
          close: safeNum(r.close, 0),
          volumeSol: safeNum(r.volume_sol, 0),
          tradesCount: safeNum(r.trades_count, 0),
        }))
        .filter((c) => c.time > 0 && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
      : [];

    if (!candles.length) {
      const txRows = await sql`
        select created_at, sol, tokens, type
        from transactions
        where coin_id = ${coinId}
        order by created_at desc
        limit ${Math.max(400, limit * 8)}
      `;

      const list = Array.isArray(txRows) ? txRows.slice().reverse() : [];
      const map = new Map();

      const fallbackPrice =
        Math.max(
          0.00000001,
          safeNum(coinApi.priceUsd, 0),
          safeNum(coinApi.lastPriceUsd, 0),
          safeNum(coin.market_cap, 0) > 0
            ? safeNum(coin.market_cap, 0) / Math.max(1, safeNum(coin.total_supply, TOTAL_SUPPLY))
            : 0,
          Array.isArray(coin.chart) && coin.chart.length
            ? safeNum(coin.chart[coin.chart.length - 1], 0)
            : 0.000001
        ) || 0.000001;

      for (const tx of list) {
        const ts = new Date(tx.created_at).getTime();
        if (!Number.isFinite(ts) || ts <= 0) continue;

        const sol = Math.max(0, safeNum(tx.sol, 0));
        const tokens = Math.max(0, safeNum(tx.tokens, 0));
        const price = tokens > 0 ? (sol / tokens) * SOL_USD : 0;
        const px = Math.max(0.00000001, price || fallbackPrice);

        const bucket = Math.floor(ts / bucketMs) * bucketMs;
        const prev = map.get(bucket);

        if (!prev) {
          map.set(bucket, {
            time: bucket, open: px, high: px, low: px, close: px,
            volumeSol: sol, tradesCount: 1,
          });
        } else {
          prev.high = Math.max(prev.high, px);
          prev.low = Math.min(prev.low, px);
          prev.close = px;
          prev.color = px >= prev.open ? "green" : "red";
          prev.volumeSol += sol;
          prev.tradesCount += 1;
        }
      }

      candles = Array.from(map.values()).sort((a, b) => a.time - b.time);

      if (!candles.length) {
        const start = Math.floor(
          Math.max(createdAtMs, now - bucketMs * Math.max(30, limit - 1)) / bucketMs
        ) * bucketMs;

        candles = [{
          time: start, open: fallbackPrice, high: fallbackPrice,
          low: fallbackPrice, close: fallbackPrice, volumeSol: 0, tradesCount: 0,
        }];
      }

      const first = candles[0];
      const currentBucket = Math.floor(now / bucketMs) * bucketMs;

      if (first) {
        const filled = [];
        const byTime = new Map(candles.map((c) => [c.time, c]));
        const fillStart = Math.floor(
          Math.max(createdAtMs, now - bucketMs * Math.max(30, limit - 1)) / bucketMs
        ) * bucketMs;

        let cursor = fillStart;
        let prevClose = first.close;

        while (cursor <= currentBucket) {
          const existing = byTime.get(cursor);

          if (existing) {
            filled.push(existing);
            prevClose = existing.close;
          } else {
            filled.push({
              time: cursor, open: prevClose, high: prevClose,
              low: prevClose, close: prevClose, volumeSol: 0, tradesCount: 0,
            });
          }

          cursor += bucketMs;
        }

        candles = filled;
      }
    }

    if (candles.length > limit) {
      candles = candles.slice(-limit);
    }

    return res.json({ ok: true, candles, tf });
  } catch (e) {
    console.log("coin/candles error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/coin/create", async (req, res) => {
  try {
    await requireDb();

    const name = String(req.body?.name || "").trim();
    const symbol = String(req.body?.symbol || "").trim().toUpperCase();
    const story = String(req.body?.story || "").trim();
    const logo = String(req.body?.logo || "");
    const creatorWallet = String(req.body?.creatorWallet || "").trim();
    const initialSol = Math.max(0, safeNum(req.body?.initialSol, 0));

    if (!name || !symbol || !creatorWallet) {
      return res.json({ ok: false, error: "name/symbol/creatorWallet required" });
    }

    let finalLogo = logo;
    let imageUri = "";
    let metadataUri = "";

    if (logo && process.env.PINATA_JWT) {
      const uploadedLogo = await uploadLogoToIPFS(
        logo,
        `${symbol || "coin"}-${Date.now()}.webp`
      );
      finalLogo = uploadedLogo.url;
      imageUri = uploadedLogo.ipfs;

      const uploadedMeta = await uploadMetadataToIPFS({
        name,
        symbol,
        description: story || `${name} (${symbol})`,
        image: uploadedLogo.ipfs,
      });

      metadataUri = uploadedMeta.ipfs;
    }


    let mintAddress = "";
let mintSignature = "";

    await getProfile(creatorWallet, true);

    const totalSupply = getSupplyFromInitialSol(initialSol);
    const mintAuthority = treasury;
    const curveSupply = saleSupplyFromTotal(totalSupply);


   /*
const mint = await createMint(
  connection,
  mintAuthority,
  mintAuthority.publicKey,
  mintAuthority.publicKey,
  9
);

mintAddress = mint.toBase58();

mintSignature = "MINT_CREATED";

console.log("✅ MINT CREATED:", mintAddress);
*/

    let coin = {
      id: uid(),
      name, symbol, story, logo: finalLogo,
      metadataUri, creatorWallet, owner: creatorWallet,
      mintAddress,
mintSignature,
      createdAt: nowMS(), status: "LIVE",
      totalSupply, curveSupply, curveSold: 0,
      vTokens: calcVirtualTokens(totalSupply, curveSupply),
      vSol: VIRTUAL_SOL,
      solReserve: 0, tokenReserve: curveSupply,
      holders: {}, volumeSol: 0, lastTradeAt: 0,
      priceSol: 0, priceUsd: 0, price: 0, lastPriceUsd: 0,
      mc: 0, ath: 0, creatorRewardsSol: 0, chart: [],
    };

    
mintSignature = "";

    coin = recalcCoin(coin, { appendChart: false });
    coin = await saveCoin(coin);

    if (initialSol > 0) {
      const result = await runCoinLocked(coin.id, async () => {
        const latestRow = await getCoinRowById(coin.id);
        if (!latestRow) throw new Error("Coin not found after create");

        let latestCoin = mapDbCoinToApi(latestRow);
        const buyRes = ammBuy(latestCoin, creatorWallet, initialSol);

        if (!buyRes.ok) {
          return { ok: false, error: buyRes.error || "Initial buy failed" };
        }

        await distributeFeeDirect(latestCoin, creatorWallet, buyRes.feeSol);
        latestCoin = recalcCoin(latestCoin, { appendChart: true, sideHint: "buy" });
        latestCoin = await saveCoin(latestCoin);

        await insertTransaction({
          id: uid(),
          type: "BUY",
          side: "BUY",
          coinId: latestCoin.id,
          wallet: creatorWallet,
          sol: initialSol,
          tokens: Math.max(0, safeNum(buyRes.tokensOut, 0)),
          fee: Math.max(0, safeNum(buyRes.feeSol, 0)),
          priceUsd: latestCoin.priceUsd,
        });

        await upsertCandlesForTrade(
          latestCoin.id,
          Math.max(0, safeNum(latestCoin?.priceUsd || latestCoin?.price || 0)),
          Math.max(0, safeNum(initialSol, 0))
        );

        return { ok: true, coin: latestCoin };
      });

      if (!result.ok) {
        return res.json(result);
      }

      coin = result.coin;
    }

    return res.json({
  ok: true,
  coin,
  imageUri,
  metadataUri,
  mintAddress,
  mintSignature,
});

  } catch (e) {
    console.log("coin/create error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/referral/set", async (req, res) => {
  try {
    await requireDb();

    const wallet = String(req.body?.wallet || "").trim();
    const referrer = String(req.body?.referrer || "").trim();

    if (!wallet || !referrer) {
      return res.json({ ok: false, error: "wallet/referrer required" });
    }
    if (wallet === referrer) {
      return res.json({ ok: false, error: "invalid referrer" });
    }
    if (referrer.length < 20) {
      return res.json({ ok: false, error: "invalid referrer" });
    }

    const p = await getProfile(wallet, true);

    if (p.referrer) {
      return res.json({ ok: false, error: "immutable: already set" });
    }

    await getProfile(referrer, true);
    await patchProfile(wallet, { referrer });
    await syncReferralCount(referrer);

    return res.json({ ok: true, referrer });
  } catch (e) {
    console.log("referral/set error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

async function doTrade(req, res, side) {
  try {
    await requireDb();

    const wallet = String(req.body?.wallet || "").trim();
    const coinId = String(req.body?.coinId || "").trim();
    const sol = Math.max(0, safeNum(req.body?.sol, 0));
    const tokens = Math.max(0, safeNum(req.body?.tokens, 0));
    const sideLower = String(side || "").trim().toLowerCase();

    if (!wallet || !coinId) {
      return res.json({ ok: false, error: "wallet/coinId required" });
    }

    if (sideLower === "buy" && sol <= 0) {
      return res.json({ ok: false, error: "sol required" });
    }

    if (sideLower === "sell" && tokens <= 0) {
      return res.json({ ok: false, error: "tokens required" });
    }

    const result = await runCoinLocked(coinId, async () => {
      const row = await getCoinRowById(coinId);
      if (!row) return { ok: false, error: "token not found" };

      let coin = mapDbCoinToApi(row);
      let tradeResult = null;

      await getProfile(wallet, true);

      if (sideLower === "buy") {
        tradeResult = ammBuy(coin, wallet, sol);
      } else if (sideLower === "sell") {
        tradeResult = ammSellByTokensIn(coin, wallet, tokens);
      } else {
        return { ok: false, error: "invalid side" };
      }

      if (!tradeResult?.ok) {
        return { ok: false, error: tradeResult?.error || "Trade failed" };
      }

      const tradeFeeSol = Math.max(0, safeNum(tradeResult.feeSol, 0));
      const creatorWallet = String(coin?.creatorWallet || coin?.owner || "").trim();
      if (creatorWallet && tradeFeeSol > 0) {
        coin.creatorRewardsSol = Math.max(
          0,
          safeNum(coin.creatorRewardsSol, 0) + tradeFeeSol * (CREATOR_PCT_OF_FEE / 100)
        );
      }

      coin = recalcCoin(coin, { appendChart: true, sideHint: sideLower });
      coin = await saveCoin(coin);

      const txPayload = {
        id: uid(),
        type: sideLower.toUpperCase(),
        side: sideLower.toUpperCase(),
        coinId: coin.id,
        wallet,
        sol: sideLower === "buy" ? Math.max(0, sol) : Math.max(0, safeNum(tradeResult.solOutNet, 0)),
        tokens: sideLower === "buy"
          ? Math.max(0, safeNum(tradeResult.tokensOut, 0))
          : Math.max(0, safeNum(tradeResult.tokensIn, 0)),
        fee: tradeFeeSol,
        priceUsd: coin.priceUsd,
      };

      const candleVolumeSol = sideLower === "buy"
        ? Math.max(0, safeNum(sol, 0))
        : Math.max(0, safeNum(tradeResult?.solOutGross || tradeResult?.solOutNet || 0, 0));

      await Promise.all([
        upsertHolding(wallet, coin.id, "set", Math.max(0, safeNum(coin?.holders?.[wallet], 0))),
        upsertCandlesForTrade(
          coin.id,
          Math.max(0.00000001, safeNum(coin?.priceUsd || coin?.price || 0, 0.00000001)),
          candleVolumeSol
        ),
      ]);

      const sideCoin = { ...coin };
      const sideEffects = await Promise.allSettled([
        distributeFeeDirect(sideCoin, wallet, tradeFeeSol),
        insertTransaction(txPayload),
      ]);
      const failed = sideEffects.find((x) => x.status === "rejected");
      if (failed) console.log("trade side-effect error:", failed.reason?.message || failed.reason);

      return {
        ok: true,
        coin,
        tokens: sideLower === "buy"
          ? Math.max(0, safeNum(tradeResult.tokensOut, 0))
          : Math.max(0, safeNum(tradeResult.tokensIn, 0)),
        fee: Math.max(0, safeNum(tradeResult.feeSol, 0)),
        netSol: sideLower === "buy"
          ? Math.max(0, safeNum(tradeResult.netSol, 0))
          : Math.max(0, safeNum(tradeResult.solOutNet, 0)),
        grossSol: sideLower === "buy"
          ? Math.max(0, sol)
          : Math.max(0, safeNum(tradeResult.solOutGross, 0)),
      };
    });

    return res.json(result);
  } catch (e) {
    console.log("trade error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

app.post("/coin/buy", (req, res) => doTrade(req, res, "buy"));
app.post("/coin/sell", (req, res) => doTrade(req, res, "sell"));

app.post("/claim", async (req, res) => {
  try {
    await requireDb();

    const wallet = String(req.body?.wallet || "").trim();
    const kind = String(req.body?.kind || "").trim().toUpperCase();

    const profile = await getProfile(wallet, true);
    if (!profile) {
      return res.status(400).json({ error: "Invalid wallet" });
    }

    let amount = 0;

    if (kind === "CREATOR") {
      amount = Math.max(0, safeNum(profile.creator_rewards, 0));
      if (amount <= 0) return res.json({ ok: true, amount: 0 });
      await patchProfile(wallet, { creator_rewards: 0 });
    } else if (kind === "REF") {
      amount = Math.max(0, safeNum(profile.referral_rewards, 0));
      if (amount <= 0) return res.json({ ok: true, amount: 0 });
      await patchProfile(wallet, { referral_rewards: 0 });
    } else if (kind === "OWNER") {
      amount = Math.max(0, safeNum(profile.owner_rewards, 0));
      if (amount <= 0) return res.json({ ok: true, amount: 0 });
      await patchProfile(wallet, { owner_rewards: 0 });
    } else {
      return res.status(400).json({ error: "Unsupported kind" });
    }

  if (amount > 0) {
      const custodial = String(profile.wallet_address || wallet).trim();
      const cur = await getBalance(custodial);
      await setBalance(custodial, cur + amount);
    }

    return res.json({ ok: true, amount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------- PROFILE ENDPOINT (THE BIG FIX) --------------------
app.get("/profile/:wallet", async (req, res) => {
  try {
    await requireDb();

    const wallet = String(req.params.wallet || "").trim();
    if (!wallet) return res.json({ ok: false, error: "wallet required" });

    // Ye call custodial wallet bhi auto-create karta he agar nahi he
    const p = await getProfile(wallet, true);
    const referralCount = await countReferrals(wallet);

    if (safeNum(p.referral_count, 0) !== referralCount) {
      await patchProfile(wallet, { referral_count: referralCount });
    }

    // Custodial wallet (deposit ke liye real wallet)
    const custodialWallet = String(p?.wallet_address || "").trim();

    // Agar abhi bhi nahi he (bahut rare case), error log karo
    if (!custodialWallet) {
      console.log("⚠️ WARNING: profile has no custodial wallet for:", wallet);
    } else {
      console.log("✅ Returning custodial wallet:", custodialWallet, "for primary:", wallet);
    }

    const creationRows = await sql`
      select * from coins where creator_wallet = ${wallet}
      order by created_at desc limit 1000
    `;
    const myCreations = Array.isArray(creationRows)
      ? creationRows.map(mapDbCoinToApi).filter(Boolean) : [];

    const txArr = await sql`
      select * from transactions
      where wallet = ${wallet}
      order by created_at desc
      limit ${PROFILE_TX_LIMIT}
    `;
    const walletTxRows = Array.isArray(txArr) ? txArr : [];

    const lastTx = walletTxRows.map((t) => ({
      id: t.id,
      coinId: t.coinId || t.coin_id,
      side: String(t.type || "TX").toUpperCase(),
      type: String(t.type || "TX").toUpperCase(),
      sol: safeNum(t.sol, 0),
      tokens: safeNum(t.tokens, 0),
      fee: safeNum(t.fee, 0),
      ts: t.createdAt ? new Date(t.createdAt).getTime()
        : t.created_at ? new Date(t.created_at).getTime() : nowMS(),
      t: t.createdAt ? new Date(t.createdAt).getTime()
        : t.created_at ? new Date(t.created_at).getTime() : nowMS(),
      wallet: t.wallet,
    }));

    const holdingBaseRows = await sql`
      select wallet, coin_id, tokens, updated_at
      from holdings
      where wallet = ${wallet} and tokens > 0
      order by updated_at desc
      limit 500
    `;

    const holdingCoinIds = Array.from(
      new Set((holdingBaseRows || []).map((r) => String(r.coin_id || "").trim()).filter(Boolean))
    );

    let holdingRows = [];
    if (holdingCoinIds.length) {
      holdingRows = await sql`select * from coins where id = any(${holdingCoinIds})`;
    }

    const holdingMap = new Map(
      (holdingBaseRows || []).map((r) => [String(r.coin_id || "").trim(), r])
    );

    const holdings = holdingRows
      .map(mapDbCoinToApi)
      .filter(Boolean)
      .map((c) => {
        const h = holdingMap.get(String(c.id)) || null;
        const amount = Math.max(0, safeNum(h?.tokens, 0));
        if (amount <= 0) return null;

        return {
          coinId: c.id,
          symbol: c.symbol,
          name: c.name,
          logo: c.logo,
          amount,
          totalSupply: Math.max(1, safeNum(c.totalSupply, TOTAL_SUPPLY)),
          pct: Math.max(1, safeNum(c.totalSupply, TOTAL_SUPPLY)) > 0
            ? (amount / Math.max(1, safeNum(c.totalSupply, TOTAL_SUPPLY))) * 100 : 0,
          lastAt: h?.updated_at ? new Date(h.updated_at).getTime() : safeNum(c.lastTradeAt, 0),
        };
      })
      .filter(Boolean)
      .sort((a, b) => safeNum(b.lastAt, 0) - safeNum(a.lastAt, 0));

    const rewardsByCoin = {};
    for (const c of myCreations) {
      rewardsByCoin[c.id] = {
        coinId: c.id,
        symbol: c.symbol,
        sol: Math.max(0, safeNum(c.creatorRewardsSol, 0)),
      };
    }

    const deposits = await sql`
  select *
  from deposits
  where wallet = ${wallet}
  order by created_at desc
  limit 50
`;

const withdrawals = await sql`
  select *
  from withdrawals
  where wallet = ${wallet}
  order by created_at desc
  limit 50
`;

    // ============= FIXED RESPONSE =============
    // wallet = CUSTODIAL wallet (real wallet for deposits)
    // primaryWallet = USER'S CONNECTED wallet (for referral / identity)
    return res.json({
      ok: true,
      profile: {
        // ⭐ MAIN FIX: wallet field me custodial address jata he
        wallet: custodialWallet || wallet,

        // Extra clarity fields - frontend in me se koi bhi use kar sakta he
        custodialWallet: custodialWallet,
        depositAddress: custodialWallet,
        primaryWallet: wallet,
        connectedWallet: wallet,

        referrer: p?.referrer || "",
        referralCode: p?.referral_code || wallet.slice(0, 6),
        referralCount,
        referralRewardsSol: Math.max(0, safeNum(p?.referral_rewards, 0)),
        creatorRewardsSol: Math.max(0, safeNum(p?.creator_rewards, 0)),
        ownerRewardsSol: Math.max(0, safeNum(p?.owner_rewards, 0)),
        referralRewards: { totalSol: Math.max(0, safeNum(p?.referral_rewards, 0)) },
        ownerRewards: { totalSol: Math.max(0, safeNum(p?.owner_rewards, 0)) },
       rewards: {
  totalSol: Math.max(0, safeNum(p?.creator_rewards, 0)),
  byCoin: rewardsByCoin,
},
holdings,
txs: lastTx,
creations: myCreations,

depositHistory: deposits || [],
withdrawHistory: withdrawals || [],
      },
      myCreations,
      lastTx,
      feePct: FEE_PCT,
    });
  } catch (e) {
    console.log("profile error:", e?.message || e);
    console.error("❌ profile error:", e);




    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- START --------------------
try {
  await ensureSchema();
  console.log("✅ Schema ready");
} catch (e) {
  console.error("❌ Startup failed:", e?.message || e);
  process.exit(1);
}

process.on("SIGINT", async () => {
  process.exit(0);
});

process.on("SIGTERM", async () => {
  process.exit(0);
});

// -------------------- DEPOSIT SCANNER --------------------
// Har 45 sec me sab custodial wallets pe deposits check karta he
setInterval(async () => {
  try {
    const rows = await sql`
      select wallet_address from profiles
      where wallet_address is not null
        and wallet_address != ''
      limit 200
    `;

    for (const row of rows || []) {
      const wallet = String(row?.wallet_address || "").trim();
      if (!wallet) continue;

      await scanWalletDeposits(wallet);
    }
  } catch (e) {
    console.log("deposit scanner error:", e?.message || e);
  }
}, 45000);

// -------------------- HTTP + WEBSOCKET SERVER --------------------
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});

const wss = new WebSocketServer({ server });
const wsClients = new Set();

wss.on("connection", (ws) => {
  wsClients.add(ws);

  ws.on("close", () => {
    wsClients.delete(ws);
  });
});
