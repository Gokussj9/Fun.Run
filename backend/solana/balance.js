import connection from "./connection.js";
import treasury from "./treasury.js";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const balance = await connection.getBalance(
  treasury.publicKey
);

console.log(
  "BALANCE:",
  balance / LAMPORTS_PER_SOL,
  "SOL"
);