import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

const treasury = Keypair.fromSecretKey(
  bs58.decode(process.env.TREASURY_PRIVATE_KEY)
);

export default treasury;