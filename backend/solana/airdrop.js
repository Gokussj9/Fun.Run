import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import connection from "./connection.js";
import treasury from "./treasury.js";

const signature = await connection.requestAirdrop(
  treasury.publicKey,
  2 * LAMPORTS_PER_SOL
);

console.log("AIRDROP SUCCESS:");
console.log(signature);