import { Program, AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(readFileSync(join(__dirname, "idl.json"), "utf8"));

const PROGRAM_ID = new PublicKey("gUQYa6GwJeZhSHiBuW66VtNhR7mBs73qmH8nJxgaVWD");

// Devnet — mainnet connection.js se alag, Anchor program devnet pe hai
const DEVNET_RPC = "https://api.devnet.solana.com";

function getPlatformWallet() {
  const addr = process.env.PLATFORM_WALLET;
  if (!addr) throw new Error("PLATFORM_WALLET env var not set");
  return new PublicKey(addr);
}

export function getProgram(wallet) {
  const connection = new Connection(DEVNET_RPC, "confirmed");
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(idl, provider);
}

export function getCoinStatePDA(coinId) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("coin"), Buffer.from(coinId)],
    PROGRAM_ID
  );
  return pda;
}

export async function create_coin(wallet, coinId) {
  const program = getProgram(wallet);
  return program.methods
    .createCoin(coinId)
    .accounts({ creator: wallet.publicKey })
    .rpc();
}

// buy ke liye pehle coin_state fetch karna padta hai creator_wallet ke liye
export async function buy(wallet, coinId, solAmount) {
  const program = getProgram(wallet);
  const coinStatePDA = getCoinStatePDA(coinId);
  const coinData = await program.account.coinState.fetch(coinStatePDA);
  return program.methods
    .buy(coinId, new BN(solAmount.toString()))
    .accounts({
      buyer: wallet.publicKey,
      platformWallet: getPlatformWallet(),
      creatorWallet: coinData.creator,
    })
    .rpc();
}

export async function sell(wallet, coinId, tokenAmount) {
  const program = getProgram(wallet);
  return program.methods
    .sell(coinId, new BN(tokenAmount.toString()))
    .accounts({
      seller: wallet.publicKey,
      platformWallet: getPlatformWallet(),
    })
    .rpc();
}

export { Wallet };
