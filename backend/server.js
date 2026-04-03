import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";
import { Connection, PublicKey } from "@solana/web3.js";

const app = express();

// -------------------- ENV --------------------
const PORT = Number(process.env.PORT || 5000);
const TRUST_PROXY = String(process.env.TRUST_PROXY || "") === "1";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(express.json({ limit: JSON_LIMIT }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (CORS_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: " + origin));
    },
    credentials: true,
  })
);
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
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
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

  return {
    id: String(row.id || ""),
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

async function requireSupabase() {
  if (!supabase) {
    console.log("⚠️ Supabase not configured, skipping...");
    return;
  }
} {
  if (!supabase) throw new Error("supabase not configured");
}

async function getProfile(wallet, createIfMissing = true) {
  const w = String(wallet || "").trim();
  if (!w) return null;

  await requireSupabase();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("wallet", w)
    .maybeSingle();

  if (error) throw error;
  if (data) return ensureProfileShape(data, w);
  if (!createIfMissing) return null;

  const payload = ensureProfileShape({ wallet: w }, w);
  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "wallet" })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return ensureProfileShape(inserted, w);
}

async function patchProfile(wallet, patch = {}) {
  const w = String(wallet || "").trim();
  if (!w) throw new Error("wallet required");

  const current = await getProfile(w, true);
  const next = ensureProfileShape(
    {
      ...current,
      ...patch,
      wallet: w,
      updated_at: new Date().toISOString(),
    },
    w
  );

  const { data, error } = await supabase
    .from("profiles")
    .upsert(next, { onConflict: "wallet" })
    .select("*")
    .single();

  if (error) throw error;
  return ensureProfileShape(data, w);
}

async function countReferrals(wallet) {
  const w = String(wallet || "").trim();
  if (!w) return 0;

  const { count, error } = await supabase
    .from("profiles")
    .select("wallet", { count: "exact", head: true })
    .eq("referrer", w);

  if (error) throw error;
  return count || 0;
}

async function syncReferralCount(wallet) {
  const count = await countReferrals(wallet);
  await patchProfile(wallet, { referral_count: count });
  return count;
}

async function insertTransaction(tx = {}) {
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

  const { error } = await supabase.from("transactions").insert(row);
  if (error) throw error;
  return row;
}

async function getCoinRowById(coinId) {
  const id = String(coinId || "").trim();
  if (!id) return null;

  const { data, error } = await supabase
    .from("coins")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function getRecentCoinActivity(coinId, limit = 50) {
  const id = String(coinId || "").trim();
  if (!id) return [];

  const safeLimit = Math.max(1, Math.min(100, safeNum(limit, 50)));

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("coin_id", id)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;

  return Array.isArray(data)
    ? data.map((t) => ({
        id: t.id,
        coinId: t.coin_id,
        side: String(t.type || "TX").toUpperCase(),
        type: String(t.type || "TX").toUpperCase(),
        sol: safeNum(t.sol, 0),
        tokens: safeNum(t.tokens, 0),
        fee: safeNum(t.fee, 0),
        ts: t.created_at ? new Date(t.created_at).getTime() : nowMS(),
        wallet: t.wallet,
      }))
    : [];
}

async function saveCoin(coin) {
  const payload = {
    id: String(coin.id || uid()),
    ...coinToDbUpdate(coin),
  };

  const { data, error } = await supabase
    .from("coins")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return mapDbCoinToApi(data);
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
    ? prev.length
      ? prev.slice(-(MAX_CHART_POINTS - 1)).concat([point])
      : [point, point, point, point, point]
    : prev.length
    ? prev.slice(-MAX_CHART_POINTS)
    : [point, point, point, point, point];

  fixed.lastTradeAt = nowMS();
  fixed.ath = Math.max(safeNum(fixed.ath, 0), pricing.mcUsd);

  return fixed;
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
    dbMode: "supabase-direct",
    ts: nowMS(),
  });
});

app.get("/health", async (req, res) => {
  try {
    await requireSupabase();
    const { count, error } = await supabase
      .from("coins")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    return res.json({
      ok: true,
      dbMode: "supabase-direct",
      coins: count || 0,
      ts: nowMS(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
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
    await requireSupabase();

    const page = Math.max(0, Number(req.query?.page || 0));
    const pageSize = 100;
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("coins")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const coins = Array.isArray(data) ? data.map(mapDbCoinToApi) : [];

    const hotCutoff = nowMS() - 15 * 60 * 1000;
    const { data: hotRows, error: hotError } = await supabase
      .from("coins")
      .select("*")
      .gte("last_trade_at", hotCutoff)
      .order("volume_sol", { ascending: false })
      .limit(10);

    if (hotError) throw hotError;

    return res.json({
      ok: true,
      coins,
      count: count || 0,
      page,
      pageSize,
      hot15m: Array.isArray(hotRows) ? hotRows.map(mapDbCoinToApi) : [],
    });
  } catch (e) {
    console.log("coin/list error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/api/coin/:coinId/activity", async (req, res) => {
  try {
    await requireSupabase();

    const coinId = String(req.params.coinId || "").trim();
    const limit = Math.max(1, Math.min(100, safeNum(req.query?.limit, 50)));

    if (!coinId) {
      return res.json({ ok: false, error: "coinId required" });
    }

    const activity = await getRecentCoinActivity(coinId, limit);
    return res.json({ ok: true, activity });
  } catch (e) {
    console.log("coin/activity error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.post("/api/coin/create", async (req, res) => {
  try {
    await requireSupabase();

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
        latestCoin = recalcCoin(latestCoin);
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
    await requireSupabase();

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
    await requireSupabase();

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

      coin = recalcCoin(coin, { appendChart: true });
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
    await requireSupabase();

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
    await requireSupabase();

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



app.get("/api/coin/:coinId/activity", async (req, res) => {
  try {
    await requireSupabase();

    const coinId = String(req.params.coinId || "").trim();
    if (!coinId) {
      return res.json({ ok: false, error: "coinId required" });
    }

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("coin_id", coinId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const items = Array.isArray(data)
      ? data.map((t) => ({
          id: t.id,
          coinId: t.coin_id,
          wallet: t.wallet,
          type: String(t.type || "TX").toUpperCase(),
          side: String(t.type || "TX").toUpperCase(),
          sol: safeNum(t.sol, 0),
          tokens: safeNum(t.tokens, 0),
          fee: safeNum(t.fee, 0),
          ts: t.created_at ? new Date(t.created_at).getTime() : nowMS(),
          t: t.created_at ? new Date(t.created_at).getTime() : nowMS(),
        }))
      : [];

    return res.json({ ok: true, items });
  } catch (e) {
    console.log("coin/activity error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});



app.get("/api/profile/:wallet", async (req, res) => {
  try {
    await requireSupabase();

    const wallet = String(req.params.wallet || "").trim();
    if (!wallet) return res.json({ ok: false, error: "wallet required" });

    const p = await getProfile(wallet, true);
    const referralCount = await countReferrals(wallet);

    if (safeNum(p.referral_count, 0) !== referralCount) {
      await patchProfile(wallet, { referral_count: referralCount });
    }

    const { data: creationRows, error: creationError } = await supabase
      .from("coins")
      .select("*")
      .eq("creator_wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (creationError) throw creationError;

    const myCreations = Array.isArray(creationRows) ? creationRows.map(mapDbCoinToApi) : [];

    const { data: txRows, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(PROFILE_HOLDING_TX_SCAN);

    if (txError) throw txError;

    const walletTxRows = Array.isArray(txRows) ? txRows : [];
    const lastTx = walletTxRows.slice(0, PROFILE_TX_LIMIT).map((t) => ({
      id: t.id,
      coinId: t.coin_id,
      side: String(t.type || "TX").toUpperCase(),
      type: String(t.type || "TX").toUpperCase(),
      sol: safeNum(t.sol, 0),
      tokens: safeNum(t.tokens, 0),
      fee: safeNum(t.fee, 0),
      ts: t.created_at ? new Date(t.created_at).getTime() : nowMS(),
      t: t.created_at ? new Date(t.created_at).getTime() : nowMS(),
      wallet: t.wallet,
    }));

    const touchedCoinIds = Array.from(
      new Set(
        walletTxRows
          .map((t) => String(t.coin_id || "").trim())
          .filter(Boolean)
      )
    ).slice(0, 200);

    let holdingRows = [];
    if (touchedCoinIds.length) {
      const { data: heldCoins, error: heldError } = await supabase
        .from("coins")
        .select("*")
        .in("id", touchedCoinIds);

      if (heldError) throw heldError;
      holdingRows = Array.isArray(heldCoins) ? heldCoins : [];
    }

    const holdings = holdingRows
      .map(mapDbCoinToApi)
      .map((c) => {
        const amount = Math.max(0, safeNum(c.holders?.[wallet], 0));
        if (amount <= 0) return null;

        const txTimes = lastTx
          .filter((t) => String(t.coinId || "") === String(c.id))
          .map((t) => safeNum(t.t, 0));

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
          lastAt: Math.max(safeNum(c.lastTradeAt, 0), ...(txTimes.length ? txTimes : [0])),
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
        referrer: p?.referrer || "",
        referralCode: p?.referral_code || wallet.slice(0, 6),
        referralCount,
        referralRewardsSol: Math.max(0, safeNum(p?.referral_rewards, 0)),
        creatorRewardsSol: Math.max(0, safeNum(p?.creator_rewards, 0)),
        ownerRewardsSol: Math.max(0, safeNum(p?.owner_rewards, 0)),
        referralRewards: {
          totalSol: Math.max(0, safeNum(p?.referral_rewards, 0)),
        },
        ownerRewards: {
          totalSol: Math.max(0, safeNum(p?.owner_rewards, 0)),
        },
        rewards: {
          totalSol: Math.max(0, safeNum(p?.creator_rewards, 0)),
          byCoin: rewardsByCoin,
        },
        holdings,
        txs: lastTx,
      },
      myCreations,
      lastTx,
      feePct: FEE_PCT,
    });
  } catch (e) {
    console.log("profile error:", e?.message || e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// -------------------- START --------------------
try {
  await requireSupabase();
} catch (e) {
  console.log("⚠️ Supabase not ready, but server starting...");
} {
  try {
    await requireSupabase();

    app.listen(PORT, () => {
      console.log("✅ Backend running on port:", PORT);
      console.log("✅ Solana RPC:", SOLANA_RPC);
      console.log("✅ DB MODE: supabase-direct");
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
}

process.on("SIGINT", async () => {
  process.exit(0);
});

process.on("SIGTERM", async () => {
  process.exit(0);
});

start();
