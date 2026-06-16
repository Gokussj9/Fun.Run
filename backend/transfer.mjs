import treasury from './solana/treasury.js';
import { Connection, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

const tx = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: treasury.publicKey,
    toPubkey: new PublicKey('GB8xKjN3j1m41jCiBEwFzz6s1DNHP7wuPfpfYy2L5wZF'),
    lamports: 50000000
  })
);

const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
console.log('Done:', sig);