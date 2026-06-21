import { createMint } from "@solana/spl-token";
import { Connection } from "@solana/web3.js";

const DEVNET_RPC = "https://api.devnet.solana.com";

export async function createSPLToken(payerKeypair) {
  const connection = new Connection(DEVNET_RPC, "confirmed");
  const mint = await createMint(
    connection,
    payerKeypair,
    payerKeypair.publicKey,
    payerKeypair.publicKey,
    9
  );
  return { mintAddress: mint.toBase58() };
}
