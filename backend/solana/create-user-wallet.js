import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

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

  return iv.toString("hex") + ":" +
    encrypted.toString("hex");
}

const wallet = Keypair.generate();

const privateKey = bs58.encode(
  wallet.secretKey
);

const encryptedKey = encrypt(privateKey);

console.log("USER WALLET");
console.log("Address:", wallet.publicKey.toBase58());

console.log("\nENCRYPTED PRIVATE KEY:");
console.log(encryptedKey);