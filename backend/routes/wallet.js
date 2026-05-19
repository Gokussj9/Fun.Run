import express from "express";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "crypto";
import dotenv from "dotenv";
import bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import nacl from "tweetnacl";

dotenv.config();

const router = express.Router();

const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY;

function encrypt(text) {
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(ENCRYPTION_KEY),
    iv
  );

  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([
    encrypted,
    cipher.final()
  ]);

  return (
    iv.toString("hex") +
    ":" +
    encrypted.toString("hex")
  );
}

router.get("/create", async (req, res) => {
  try {
    const mnemonic =
      bip39.generateMnemonic();

    const seed =
      await bip39.mnemonicToSeed(
        mnemonic
      );

    const path =
      "m/44'/501'/0'/0'";

    const derivedSeed =
      derivePath(
        path,
        seed.toString("hex")
      ).key;

    const keypair =
      Keypair.fromSeed(
        derivedSeed
      );

    const encryptedMnemonic =
      encrypt(mnemonic);

    res.json({
      success: true,

      address:
        keypair.publicKey.toBase58(),

      encryptedMnemonic,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
    });
  }
});

export default router;