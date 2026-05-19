import {
  getOrCreateAssociatedTokenAccount,
  transfer
} from "@solana/spl-token";

import {
  PublicKey
} from "@solana/web3.js";

import connection from "./connection.js";
import treasury from "./treasury.js";

const TOKEN_MINT =
  new PublicKey(
    "9LmNbCEDkyprEuTfj38K72gY954RuU7aEWptCJL6wpEF"
  );

const RECEIVER =
  new PublicKey(
    "5NzdjCRbyNge92k6Zubqi3UZqsDBkmRQj7uYZmbo6cnT"
  );

const fromTokenAccount =
  await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    TOKEN_MINT,
    treasury.publicKey
  );

const toTokenAccount =
  await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    TOKEN_MINT,
    RECEIVER
  );

await transfer(
  connection,
  treasury,
  fromTokenAccount.address,
  toTokenAccount.address,
  treasury,
  1000 * 10 ** 9
);

console.log("TOKENS SENT");