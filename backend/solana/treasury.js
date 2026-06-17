import { Keypair } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

// Inline base58 decoder (Solana/Bitcoin alphabet) — koi extra package nahi chahiye
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decodeBase58(str) {
  const bytes = [0];
  for (const ch of str) {
    const val = B58.indexOf(ch);
    if (val === -1) throw new Error(`Invalid base58 character: "${ch}"`);
    let carry = val;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let k = 0; k < str.length && str[k] === "1"; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

function loadTreasuryKey() {
  // whitespace aur galti se lage quotes hata do
  const raw = (process.env.TREASURY_PRIVATE_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!raw) throw new Error("TREASURY_PRIVATE_KEY env variable set nahi hai");

  let secret;
  if (raw.startsWith("[")) {
    // Array format: [12,34,...]
    secret = Uint8Array.from(JSON.parse(raw));
  } else if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(raw)) {
    // Base58 (Phantom export waghaira)
    secret = decodeBase58(raw);
  } else {
    // Base64 fallback
    secret = Uint8Array.from(Buffer.from(raw, "base64"));
  }

  if (secret.length !== 64) {
    throw new Error(
      `Treasury key ki length ghalat hai: ${secret.length} bytes (64 honi chahiye). TREASURY_PRIVATE_KEY ka format check karo.`
    );
  }
  return Keypair.fromSecretKey(secret);
}

const treasury = loadTreasuryKey();

export default treasury;