import {
  createMint
} from "@solana/spl-token";

import connection from "./connection.js";
import treasury from "./treasury.js";

const mint = await createMint(
  connection,
  treasury,
  treasury.publicKey,
  treasury.publicKey,
  9
);

console.log("TOKEN CREATED:");
console.log(mint.toBase58());