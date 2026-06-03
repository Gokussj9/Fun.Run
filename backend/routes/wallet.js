import express from "express";
import { Keypair } from "@solana/web3.js";
import crypto from "crypto";
import dotenv from "dotenv";
import bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";

dotenv.config();

const router = express.Router();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function encrypt(text) {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 32 characters long in .env"
    );
  }

  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

// POST /wallet/create
// Generates a new custodial Solana wallet
router.post("/create", async (req, res) => {
  try {
    const mnemonic = bip39.generateMnemonic();

    const seed = await bip39.mnemonicToSeed(mnemonic);

    const path = "m/44'/501'/0'/0'";

    const derivedSeed = derivePath(path, seed.toString("hex")).key;

    const keypair = Keypair.fromSeed(derivedSeed);

    const encryptedMnemonic = encrypt(mnemonic);

    const address = keypair.publicKey.toBase58();

    console.log("✅ NEW CUSTODIAL WALLET CREATED:", address);

    return res.json({
      success: true,
      ok: true,
      address,
      encryptedMnemonic,
    });
  } catch (error) {
    console.log("❌ /wallet/create error:", error?.message || error);

    return res.status(500).json({
      success: false,
      ok: false,
      error: error?.message || "wallet create failed",
    });
  }
});

export default router;
