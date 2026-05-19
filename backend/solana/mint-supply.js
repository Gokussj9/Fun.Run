import {
  getOrCreateAssociatedTokenAccount,
  mintTo
} from "@solana/spl-token";

import connection from "./connection.js";
import treasury from "./treasury.js";

const MINT_ADDRESS =
  "9LmNbCEDkyprEuTfj38K72gY954RuU7aEWptCJL6wpEF";

import { PublicKey } from "@solana/web3.js";

const mint = new PublicKey(MINT_ADDRESS);

const tokenAccount =
  await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    mint,
    treasury.publicKey
  );

await mintTo(
  connection,
  treasury,
  mint,
  tokenAccount.address,
  treasury,
  1000000000 * 10 ** 9
);

console.log("SUPPLY MINTED");
console.log(
  tokenAccount.address.toBase58()
);