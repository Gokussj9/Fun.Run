import { Keypair } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

const keyString = process.env.TREASURY_PRIVATE_KEY || "";

let treasury;

if (keyString.startsWith("[")) {
  // Array format
  treasury = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(keyString))
  );
} else {
  // Base64 format
  treasury = Keypair.fromSecretKey(
    Buffer.from(keyString, "base64")
  );
}

export default treasury;