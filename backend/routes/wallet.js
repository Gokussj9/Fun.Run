import express from "express";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "crypto";
import dotenv from "dotenv";

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
    const wallet = Keypair.generate();

    const privateKey = bs58.encode(
      wallet.secretKey
    );

    const encryptedKey =
      encrypt(privateKey);

    res.json({
      success: true,
      address:
        wallet.publicKey.toBase58(),
      encryptedPrivateKey:
        encryptedKey,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
    });
  }
});

export default router;