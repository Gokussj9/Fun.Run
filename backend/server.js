import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import postgres from "postgres";
import { Connection, PublicKey } from "@solana/web3.js";

const app = express();

// -------------------- ENV --------------------
const PORT = process.env.PORT || 5000;
const TRUST_PROXY = String(process.env.TRUST_PROXY || "") === "1";

const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

const SOLANA_RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const JSON_LIMIT = process.env.JSON_LIMIT || "15mb";

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const FEE_PCT = clampNum(Number(process.env.FEE_PCT || 1), 0, 10);
const OWNER_PCT_OF_FEE = clampNum(Number(process.env.OWNER_PCT_OF_FEE || 40), 0, 100);
const CREATOR_PCT_OF_FEE = clampNum(Number(process.env.CREATOR_PCT_OF_FEE || 40), 0, 100);
const REFERRAL_PCT_OF_FEE = clampNum(Number(process.env.REFERRAL_PCT_OF_FEE || 20), 0, 100);

const APP_OWNER_WALLET = String(process.env.APP_OWNER_WALLET || "").trim();

const SOL_USD = clampNum(Number(process.env.SOL_USD || 80), 1, 100000);

const VIRTUAL_SOL = clampNum(Number(process.env.VIRTUAL_SOL || 30), 0, 1000000);
const VIRTUAL_TOKEN_PCT = clampNum(Number(process.env.VIRTUAL_TOKEN_PCT || 30), 0.1, 95);
const SALE_SUPPLY_PCT = clampNum(Number(process.env.SALE_SUPPLY_PCT || 80), 1, 100);

const TOTAL_SUPPLY = Math.max(1, Number(process.env.TOTAL_SUPPLY || 1_000_000_000));
const MAX_CHART_POINTS = 140;
const PROFILE_TX_LIMIT = 120;
const PROFILE_HOLDING_TX_SCAN = 500;

// -------------------- APP SETUP --------------------
if (TRUST_PROXY) app.set("trust proxy", 1);


app.use((req, res, next) => {
  console.log("🌍 incoming:", req.method, req.url);
  next();
});


app.use(cors({
  origin: "*"
}));

app.use((req, res, next) => {
  console.log("🌍 incoming:", req.method, req.url);
  next();
});

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(morgan("tiny"));

// -------------------- CLIENTS --------------------
const sql = DATABASE_URL
  ? postgres(DATABASE_URL, {
      ssl: "require",
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
    
    })
  : null;

const connection = new Connection(SOLANA_RPC, "confirmed");

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
  const curveSupply = Math.max(
    1,
    safeNum(row.curve_supply, saleSupplyFromTotal(totalSupply))
  );
  const tokenReserve = clampNum(
    safeNum(row.reserve_token, curveSupply),
    1,
    curveSupply
  );
  const curveSold = clampNum(
    safeNum(row.curve_sold, curveSupply - tokenReserve),
    0,
    curveSupply
  );
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
    holders: asObj(row.holders, {}),

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

    creatorRewardsSol: Math.max(0, safeNum(row.creator_rewards, 0)),
  };
}

function coinToDbUpdate(coin = {}) {
  return {
    name: coin.name || "",
    symbol: coin.symbol || "",
    story: coin.story || "",
    logo: coin.logo || "",
    metadata_uri: coin.metadataUri || "",
    creator_wallet: coin.creatorWallet || coin.owner || "",
    created_at: new Date(coin.createdAt || Date.now()).toISOString(),
    total_supply: coin.totalSupply || TOTAL_SUPPLY,
    curve_supply: coin.curveSupply || saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY),
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
      coin.tokenReserve ||
      coin.curveSupply ||
      saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY),
    market_cap: coin.mc || 0,
    last_price: coin.priceSol || 0,
    ath_market_cap: coin.ath || 0,
    volume_sol: coin.volumeSol || 0,
    last_trade_at: coin.lastTradeAt || 0,
    creator_rewards: coin.creatorRewardsSol || 0,
    chart: Array.isArray(coin.chart) ? coin.chart.slice(-MAX_CHART_POINTS) : [],
    holders: asObj(coin.holders, {}),
  };
}

function ensureProfileShape(row = {}, wallet = "") {
  const w = String(wallet || row.wallet || "").trim();
  return {
    wallet: w,
    referrer: String(row.referrer || "").trim(),
    referral_rewards: Math.max(0, safeNum(row.referral_rewards, 0)),
    creator_rewards: Math.max(0, safeNum(row.creator_rewards, 0)),
    owner_rewards: Math.max(0, safeNum(row.owner_rewards, 0)),
    referral_code: String(row.referral_code || w.slice(0, 6)),
    referral_count: Math.max(0, safeNum(row.referral_count, 0)),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
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
    url: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`,
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
    url: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`,
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
      chart jsonb default '[]'::jsonb,
      holders jsonb default '{}'::jsonb
    )`;

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
      updated_at timestamptz default now()
    )`;

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
}

function profileToDbRow(profile = {}) {
  return {
    wallet: String(profile.wallet || "").trim(),
    referrer: String(profile.referrer || "").trim(),
    referral_rewards: Math.max(0, safeNum(profile.referral_rewards, 0)),
    creator_rewards: Math.max(0, safeNum(profile.creator_rewards, 0)),
    owner_rewards: Math.max(0, safeNum(profile.owner_rewards, 0)),
    referral_code: String(profile.referral_code || ""),
    referral_count: Math.max(0, safeNum(profile.referral_count, 0)),
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString(),
  };
}

async function getProfile(wallet, createIfMissing = true) {
  const w = String(wallet || "").trim();
  if (!w) return null;

  await requireDb();

  const rows = await sql`select * from profiles where wallet = ${w} limit 1`;
  if (rows[0]) return ensureProfileShape(rows[0], w);
  if (!createIfMissing) return null;

  const payload = profileToDbRow(ensureProfileShape({ wallet: w }, w));
  const inserted = await sql`
    insert into profiles (wallet, referrer, referral_rewards, creator_rewards, owner_rewards, referral_code, referral_count, created_at, updated_at)
    values (${payload.wallet}, ${payload.referrer}, ${payload.referral_rewards}, ${payload.creator_rewards}, ${payload.owner_rewards}, ${payload.referral_code}, ${payload.referral_count}, ${payload.created_at}, ${payload.updated_at})
    on conflict (wallet) do update set updated_at = excluded.updated_at
    returning *`;

  return ensureProfileShape(inserted[0], w);
}

async function patchProfile(wallet, patch = {}) {
  const w = String(wallet || "").trim();
  if (!w) throw new Error("wallet required");

  const current = await getProfile(w, true);
  const next = profileToDbRow(ensureProfileShape({
    ...current,
    ...patch,
    wallet: w,
    updated_at: new Date().toISOString(),
  }, w));

  const rows = await sql`
    insert into profiles (wallet, referrer, referral_rewards, creator_rewards, owner_rewards, referral_code, referral_count, created_at, updated_at)
    values (${next.wallet}, ${next.referrer}, ${next.referral_rewards}, ${next.creator_rewards}, ${next.owner_rewards}, ${next.referral_code}, ${next.referral_count}, ${next.created_at}, ${next.updated_at})
    on conflict (wallet) do update set
      referrer = excluded.referrer,
      referral_rewards = excluded.referral_rewards,
      creator_rewards = excluded.creator_rewards,
      owner_rewards = excluded.owner_rewards,
      referral_code = excluded.referral_code,
      referral_count = excluded.referral_count,
      updated_at = excluded.updated_at
    returning *`;

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

  await sql`
    insert into transactions (id, wallet, coin_id, type, sol, tokens, fee, created_at)
    values (${row.id}, ${row.wallet}, ${row.coin_id}, ${row.type}, ${row.sol}, ${row.tokens}, ${row.fee}, ${row.created_at})`;
  return row;
}

async function upsertHolding(wallet, coinId, tokensDeltaMode = "set", tokensValue = 0) {
  const w = String(wallet || "").trim();
  const c = String(coinId || "").trim();
  if (!w || !c) return null;

  const current = await sql`
    select wallet, coin_id, tokens
    from holdings
    where wallet = ${w} and coin_id = ${c}
    limit 1
  `;

  const prev = current?.[0] ? Number(current[0].tokens || 0) : 0;

  let nextTokens = 0;
  if (tokensDeltaMode === "inc") {
    nextTokens = Math.max(0, prev + Number(tokensValue || 0));
  } else if (tokensDeltaMode === "dec") {
    nextTokens = Math.max(0, prev - Number(tokensValue || 0));
  } else {
    nextTokens = Math.max(0, Number(tokensValue || 0));
  }

  await sql`
    insert into holdings (wallet, coin_id, tokens, updated_at)
    values (${w}, ${c}, ${nextTokens}, now())
    on conflict (wallet, coin_id)
    do update set
      tokens = excluded.tokens,
      updated_at = now()
  `;

  return nextTokens;
}

async function getCoinRowById(coinId) {
  const id = String(coinId || "").trim();
  if (!id) return null;
  await requireDb();
  const rows = await sql`select * from coins where id = ${id} limit 1`;
  return rows[0] || null;
}

async function getRecentCoinActivity(coinId, limit = 50) {
  const id = String(coinId || "").trim();
  if (!id) return [];
  await requireDb();
  const safeLimit = Math.max(1, Math.min(120, safeNum(limit, 50)));
  const rows = await sql`select id, coin_id, type, sol, tokens, fee, created_at, wallet from transactions where coin_id = ${id} order by created_at desc limit ${safeLimit}`;
  return Array.isArray(rows)
    ? rows.map((t) => ({
        id: t.id,
        coinId: t.coinId || t.coin_id,
        side: String(t.type || "TX").toUpperCase(),
        type: String(t.type || "TX").toUpperCase(),
        sol: safeNum(t.sol, 0),
        tokens: safeNum(t.tokens, 0),
        fee: safeNum(t.fee, 0),
        ts: t.createdAt ? new Date(t.createdAt).getTime() : t.created_at ? new Date(t.created_at).getTime() : nowMS(),
        wallet: t.wallet,
      }))
    : [];
}

async function saveCoin(coin) {
  await requireDb();
  const payload = {
    id: String(coin.id || uid()),
    ...coinToDbUpdate(coin),
  };

  const rows = await sql`
    insert into coins (id, name, symbol, story, logo, metadata_uri, creator_wallet, created_at, total_supply, curve_supply, curve_sold, v_sol, v_tokens, reserve_sol, reserve_token, market_cap, last_price, ath_market_cap, volume_sol, last_trade_at, creator_rewards, chart, holders)
    values (
      ${payload.id}, ${payload.name}, ${payload.symbol}, ${payload.story}, ${payload.logo}, ${payload.metadata_uri}, ${payload.creator_wallet}, ${payload.created_at},
      ${payload.total_supply}, ${payload.curve_supply}, ${payload.curve_sold}, ${payload.v_sol}, ${payload.v_tokens}, ${payload.reserve_sol}, ${payload.reserve_token},
      ${payload.market_cap}, ${payload.last_price}, ${payload.ath_market_cap}, ${payload.volume_sol}, ${payload.last_trade_at}, ${payload.creator_rewards}, ${sql.json(payload.chart || [])}, ${sql.json(payload.holders || {})}
    )
    on conflict (id) do update set
      name = excluded.name,
      symbol = excluded.symbol,
      story = excluded.story,
      logo = excluded.logo,
      metadata_uri = excluded.metadata_uri,
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

  return mapDbCoinToApi(rows[0]);
}

function buildChartTrail(prevChart, nextPoint, sideHint = "") {
  const history = Array.isArray(prevChart)
    ? prevChart.map((x) => Math.max(0, safeNum(x, 0))).filter((x) => Number.isFinite(x) && x >= 0)
    : [];

  const point = Math.max(0, safeNum(nextPoint, 0));
  if (!history.length) return [point, point, point, point, point];

  const last = Math.max(0, safeNum(history[history.length - 1], point));
  if (last <= 0 || point <= 0) {
    return history.slice(-(MAX_CHART_POINTS - 1)).concat([point]);
  }

  const direction = String(sideHint || "").toLowerCase() === "sell" ? -1 : point < last ? -1 : 1;
  const rawDeltaPct = Math.abs(((point - last) / Math.max(last, 1e-9)) * 100);
  const visibleDeltaPct = Math.max(direction > 0 ? 0.95 : 0.8, Math.min(9, rawDeltaPct * 1.9));

  const visualTarget = direction > 0
    ? last * (1 + visibleDeltaPct / 100)
    : Math.max(1e-9, last * (1 - visibleDeltaPct / 100));

  const settle = direction > 0
    ? Math.max(point, last + (visualTarget - last) * 0.76)
    : Math.min(point, last - (last - visualTarget) * 0.76);

  const overshoot = direction > 0
    ? Math.max(settle, last + (visualTarget - last) * 1.03)
    : Math.min(settle, last - (last - visualTarget) * 1.03);

  return history.slice(-(MAX_CHART_POINTS - 4)).concat([last, settle, overshoot, point]);
}

function recalcCoin(coin, opts = {}) {
  const fixed = {
    ...coin,
    totalSupply: Math.max(1, safeNum(coin.totalSupply, TOTAL_SUPPLY)),
    curveSupply: Math.max(
      1,
      safeNum(coin.curveSupply, saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY))
    ),
    tokenReserve: Math.max(
      1,
      safeNum(
        coin.tokenReserve,
        saleSupplyFromTotal(coin.totalSupply || TOTAL_SUPPLY)
      )
    ),
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
  return true;
}

function applyFee(solAmount) {
  const gross = Math.max(0, safeNum(solAmount, 0));
  const fee = gross * (FEE_PCT / 100);
  const net = Math.max(0, gross - fee);
  return { fee, net };
}

// ================= TRUE BONDING CURVE VERSION =================
// sirf core changes kiye gaye hain (UI untouched, APIs same)

// ================= SELL (TRUE CURVE) =================

function distributeFee(store, coin, traderWallet, feeSol) {
  if (feeSol <= 0) return;

  const creatorWallet = String(coin.creatorWallet || coin.owner || "").trim();

  const ownerPart = feeSol * 0.4;
  const creatorPart = feeSol * 0.4;
  const referralPart = feeSol * 0.2;

  if (APP_OWNER_WALLET && ownerPart > 0) {
    const ownerProfile = ensureProfile(store, APP_OWNER_WALLET);
    ownerProfile.ownerRewardsSol = Math.max(
      0,
      safeNum(ownerProfile.ownerRewardsSol, 0) + ownerPart
    );
    ownerProfile.updatedAt = nowMS();
  }

  if (creatorWallet && creatorPart > 0) {
    const creatorProfile = ensureProfile(store, creatorWallet);

    creatorProfile.creatorRewardsSol = Math.max(
      0,
      safeNum(creatorProfile.creatorRewardsSol, 0) + creatorPart
    );
    creatorProfile.updatedAt = nowMS();

    coin.creatorRewardsSol = Math.max(
      0,
      safeNum(coin.creatorRewardsSol, 0) + creatorPart
    );

    // ✅ referral creator ke upline ko
    const creatorUpline = String(creatorProfile?.referrer || "").trim();
    if (creatorUpline && creatorUpline !== creatorWallet && referralPart > 0) {
      const upProfile = ensureProfile(store, creatorUpline);
      upProfile.referralRewardsSol = Math.max(
        0,
        safeNum(upProfile.referralRewardsSol, 0) + referralPart
      );
      upProfile.updatedAt = nowMS();
    }
  }
}

async function distributeFeeDirect(coin, traderWallet, feeSol) {
  const fee = Math.max(0, safeNum(feeSol, 0));
  if (fee <= 0) return;

  const creatorWallet = String(coin?.creatorWallet || coin?.owner || "").trim();

  const ownerPart = fee * (OWNER_PCT_OF_FEE / 100);
  const creatorPart = fee * (CREATOR_PCT_OF_FEE / 100);
  const referralPart = fee * (REFERRAL_PCT_OF_FEE / 100);

  if (APP_OWNER_WALLET && ownerPart > 0) {
    const ownerProfile = await getProfile(APP_OWNER_WALLET, true);
    await patchProfile(APP_OWNER_WALLET, {
      owner_rewards: Math.max(0, safeNum(ownerProfile?.owner_rewards, 0) + ownerPart),
    });
  }

  if (creatorWallet && creatorPart > 0) {
    const creatorProfile = await getProfile(creatorWallet, true);

    await patchProfile(creatorWallet, {
      creator_rewards: Math.max(0, safeNum(creatorProfile?.creator_rewards, 0) + creatorPart),
    });

    coin.creatorRewardsSol = Math.max(
      0,
      safeNum(coin.creatorRewardsSol, 0) + creatorPart
    );

    const creatorUpline = String(creatorProfile?.referrer || "").trim();
    if (creatorUpline && creatorUpline !== creatorWallet && referralPart > 0) {
      const upProfile = await getProfile(creatorUpline, true);
      await patchProfile(creatorUpline, {
        referral_rewards: Math.max(
          0,
          safeNum(upProfile?.referral_rewards, 0) + referralPart
        ),
      });
    }
  }
}

// ================= TRUE BONDING CURVE VERSION =================
// sirf core changes kiye gaye hain (UI untouched, APIs same)

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

  coin.holders[wallet] = Math.max(
    0,
    safeNum(coin.holders[wallet], 0) + tokensOut
  );

  coin.volumeSol += solInGross;
  coin.lastTradeAt = nowMS();

  return {
    ok: true,
    tokensOut,
    feeSol: fee,
    netSol: net,
  };
}

// ================= SELL (TRUE CURVE) =================

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

app.get("/api/balance/:wallet", async (req, res) => {
  try {
    const wallet = String(req.params.wallet || "").trim();
    if (!wallet) return res.json({ ok: false, error: "wallet required" });

    const pub = new PublicKey(wallet);
    const lamports = await connection.getBalance(pub);
    return res.json({ ok: true, sol: lamports / 1_000_000_000 });
  } catch {
    return res.json({ ok: true, sol: 0 });
  }
});

app.get("/api/coin/list", async (req, res) => {
  try {
    console.log("🔥 /api/coin/list hit");
console.log("👉 query params:", req.query);
    await requireDb();

    const page = Math.max(0, Number(req.query.page || 0));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50)));
    const offset = page * limit;

    const rows = await sql`
      select *
      from coins
      order by created_at desc
      limit ${limit} offset ${offset}
    `;

    const coins = Array.isArray(rows)
      ? rows.map(mapDbCoinToApi).filter(Boolean)
      : [];

    return res.json({
      ok: true,
      coins,
      page,
      limit,
      hasMore: coins.length >= limit,
      hot15m: [],
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "coin list failed",
    });
  }
});

app.get("/api/coin/:id/activity", async (req, res) => {
  try {
    await requireDb();
    const limit = Math.min(120, Math.max(20, Number(req.query.limit || 60)));
    const activity = await getRecentCoinActivity(req.params.id, limit);
    return res.json({ ok: true, activity });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "activity failed" });
  }
});

app.post("/api/coin/create", async (req, res) => {
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

    await getProfile(creatorWallet, true);

    const totalSupply = TOTAL_SUPPLY;
    const curveSupply = saleSupplyFromTotal(totalSupply);

    let coin = {
      id: uid(),
      name,
      symbol,
      story,
      logo: finalLogo,
      metadataUri,
      creatorWallet,
      owner: creatorWallet,
      createdAt: nowMS(),
      status: "LIVE",
      totalSupply,
      curveSupply,
      curveSold: 0,
      vTokens: calcVirtualTokens(totalSupply, curveSupply),
      vSol: VIRTUAL_SOL,
      solReserve: 0,
      tokenReserve: curveSupply,
      holders: {},
      volumeSol: 0,
      lastTradeAt: 0,
      priceSol: 0,
      priceUsd: 0,
      price: 0,
      lastPriceUsd: 0,
      mc: 0,
      ath: 0,
      creatorRewardsSol: 0,
      chart: [],
    };

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
        });

        return { ok: true, coin: latestCoin };
      });

      if (!result.ok) {
        return res.json(result);
      }

      coin = result.coin;
    }

    return res.json({ ok: true, coin, imageUri, metadataUri });
  } catch (e) {
    console.log("coin/create error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/referral/set", async (req, res) => {
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

      await distributeFeeDirect(coin, wallet, Math.max(0, safeNum(tradeResult.feeSol, 0)));

      coin = recalcCoin(coin, { appendChart: true, sideHint: sideLower });
      coin = await saveCoin(coin);

      await insertTransaction({
        id: uid(),
        type: sideLower.toUpperCase(),
        side: sideLower.toUpperCase(),
        coinId: coin.id,
        wallet,
        sol:
          sideLower === "buy"
            ? Math.max(0, sol)
            : Math.max(0, safeNum(tradeResult.solOutNet, 0)),
        tokens:
          sideLower === "buy"
            ? Math.max(0, safeNum(tradeResult.tokensOut, 0))
            : Math.max(0, safeNum(tradeResult.tokensIn, 0)),
        fee: Math.max(0, safeNum(tradeResult.feeSol, 0)),
      });

            await upsertHolding(
        wallet,
        coin.id,
        "set",
        Math.max(0, safeNum(coin?.holders?.[wallet], 0))
      );

            await upsertCandlesForTrade(
        coin.id,
        Math.max(0, safeNum(coin?.priceUsd || coin?.price || 0, 0)),
        sideLower === "buy"
          ? Math.max(0, safeNum(sol, 0))
          : Math.max(0, safeNum(tradeResult?.solOutGross || tradeResult?.solOutNet || 0, 0))
      );

      return {
        ok: true,
        coin,
        tokens:
          sideLower === "buy"
            ? Math.max(0, safeNum(tradeResult.tokensOut, 0))
            : Math.max(0, safeNum(tradeResult.tokensIn, 0)),
        fee: Math.max(0, safeNum(tradeResult.feeSol, 0)),
        netSol:
          sideLower === "buy"
            ? Math.max(0, safeNum(tradeResult.netSol, 0))
            : Math.max(0, safeNum(tradeResult.solOutNet, 0)),
        grossSol:
          sideLower === "buy"
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

app.post("/api/coin/buy", (req, res) => doTrade(req, res, "buy"));
app.post("/api/coin/sell", (req, res) => doTrade(req, res, "sell"));

app.post("/api/claim", async (req, res) => {
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

    return res.json({
      ok: true,
      amount,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function handleWithdraw(req, res, forcedKind = "") {
  try {
    await requireDb();

    const wallet = String(req.body?.wallet || "").trim();
    const to = String(req.body?.to || "").trim();
    const amount = Math.max(0, safeNum(req.body?.amount, 0));
    const kindRaw = String(forcedKind || req.body?.kind || "")
      .trim()
      .toUpperCase();

    if (!wallet) {
      return res.json({ ok: false, error: "wallet required" });
    }

    if (to && amount > 0 && !kindRaw) {
      return res.json({
        ok: true,
        kind: "MANUAL",
        amountSol: amount,
        to,
        note: "Demo/manual withdraw request accepted by backend",
      });
    }

    const kind =
      kindRaw === "REFERRAL"
        ? "REF"
        : kindRaw === "REF"
        ? "REF"
        : kindRaw === "CREATOR"
        ? "CREATOR"
        : kindRaw === "OWNER"
        ? "OWNER"
        : kindRaw === "MANUAL"
        ? "MANUAL"
        : "";

    if (kind === "MANUAL") {
      return res.json({
        ok: true,
        kind: "MANUAL",
        amountSol: amount,
        to: to || wallet,
        note: "Demo/manual withdraw request accepted by backend",
      });
    }

    if (!["REF", "CREATOR", "OWNER"].includes(kind)) {
      return res.json({ ok: false, error: "Unsupported kind" });
    }

    const p = await getProfile(wallet, true);

    if (kind === "REF") {
      const amt = Math.max(0, safeNum(p.referral_rewards, 0));
      if (amt <= 0) {
        return res.json({ ok: false, error: "No referral rewards" });
      }

      await patchProfile(wallet, { referral_rewards: 0 });
      return res.json({ ok: true, kind: "REF", amountSol: amt, to: wallet });
    }

    if (kind === "CREATOR") {
      const amt = Math.max(0, safeNum(p.creator_rewards, 0));
      if (amt <= 0) {
        return res.json({ ok: false, error: "No creator rewards" });
      }

      await patchProfile(wallet, { creator_rewards: 0 });
      return res.json({ ok: true, kind: "CREATOR", amountSol: amt, to: wallet });
    }

    if (kind === "OWNER") {
      const amt = Math.max(0, safeNum(p.owner_rewards, 0));
      if (amt <= 0) {
        return res.json({ ok: false, error: "No wallet balance" });
      }

      await patchProfile(wallet, { owner_rewards: 0 });
      return res.json({ ok: true, kind: "OWNER", amountSol: amt, to: wallet });
    }

    return res.json({ ok: false, error: "Unsupported kind" });
  } catch (e) {
    console.log("withdraw error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

app.post("/api/withdraw", (req, res) => handleWithdraw(req, res));
app.post("/api/withdraw/creator", (req, res) => handleWithdraw(req, res, "CREATOR"));
app.post("/api/withdraw/referral", (req, res) => handleWithdraw(req, res, "REF"));

app.get("/api/profile/:wallet", async (req, res) => {
  try {
    await requireDb();

    const wallet = String(req.params.wallet || "").trim();
    if (!wallet) return res.json({ ok: false, error: "wallet required" });

    const p = await getProfile(wallet, true);
    const referralCount = await countReferrals(wallet);

    if (safeNum(p.referral_count, 0) !== referralCount) {
      await patchProfile(wallet, { referral_count: referralCount });
    }

    const creationRows = await sql`select * from coins where creator_wallet = ${wallet} order by created_at desc limit 1000`;
    const myCreations = Array.isArray(creationRows) ? creationRows.map(mapDbCoinToApi).filter(Boolean) : [];

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
      ts: t.createdAt ? new Date(t.createdAt).getTime() : t.created_at ? new Date(t.created_at).getTime() : nowMS(),
      t: t.createdAt ? new Date(t.createdAt).getTime() : t.created_at ? new Date(t.created_at).getTime() : nowMS(),
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
      holdingRows = await sql`
        select * from coins
        where id = any(${holdingCoinIds})
      `;
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
          pct:
            Math.max(1, safeNum(c.totalSupply, TOTAL_SUPPLY)) > 0
              ? (amount / Math.max(1, safeNum(c.totalSupply, TOTAL_SUPPLY))) * 100
              : 0,
          lastAt: h?.updated_at
            ? new Date(h.updated_at).getTime()
            : safeNum(c.lastTradeAt, 0),
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

    return res.json({
      ok: true,
      profile: {
        wallet,
        referrer: p?.referrer || "",
        referralCode: p?.referral_code || wallet.slice(0, 6),
        referralCount,
        referralRewardsSol: Math.max(0, safeNum(p?.referral_rewards, 0)),
        creatorRewardsSol: Math.max(0, safeNum(p?.creator_rewards, 0)),
        ownerRewardsSol: Math.max(0, safeNum(p?.owner_rewards, 0)),
        referralRewards: { totalSol: Math.max(0, safeNum(p?.referral_rewards, 0)) },
        ownerRewards: { totalSol: Math.max(0, safeNum(p?.owner_rewards, 0)) },
        rewards: { totalSol: Math.max(0, safeNum(p?.creator_rewards, 0)), byCoin: rewardsByCoin },
        holdings,
        txs: lastTx,
        creations: myCreations,
      },
      myCreations,
      lastTx,
      feePct: FEE_PCT,
    });
  } catch (e) {
    console.log("profile error:", e?.message || e);
    console.error("❌ coin list error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- START --------------------
try {
  await ensureSchema();

  try {
  } catch (migrateErr) {
    console.log("⚠️ Supabase migration skipped:", migrateErr?.message || migrateErr);
  }

  app.listen(PORT, () => {
    console.log("✅ Backend running on port:", PORT);
    console.log("✅ Solana RPC:", SOLANA_RPC);
    console.log("✅ DB MODE: neon-postgres");
    console.log("✅ CORS_ORIGINS:", CORS_ORIGINS.join(", "));
    console.log("✅ JSON_LIMIT:", JSON_LIMIT);
    console.log("✅ Fee:", FEE_PCT + "%");
    console.log(
      "✅ Rewards: creator",
      CREATOR_PCT_OF_FEE + "% of fee, owner",
      OWNER_PCT_OF_FEE + "% of fee, referral",
      REFERRAL_PCT_OF_FEE + "% of fee"
    );
    console.log("✅ AMM virtual:", "vSOL", VIRTUAL_SOL, "vTOK%", VIRTUAL_TOKEN_PCT);
    console.log("✅ SOL_USD:", SOL_USD);
  });
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

