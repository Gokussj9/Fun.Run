import {
  Metaplex,
  keypairIdentity
} from "@metaplex-foundation/js";

import {
  PublicKey
} from "@solana/web3.js";

import connection from "./connection.js";
import treasury from "./treasury.js";

const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(treasury));

const mintAddress = new PublicKey(
  "9LmNbCEDkyprEuTfj38K72gY954RuU7aEWptCJL6wpEF"
);

const { uri } =
  await metaplex.nfts().update({
    nftOrSft: {
      address: mintAddress
    },
    uri: "https://green-dear-opossum-265.mypinata.cloud/ipfs/bafkreihfkaq66srsuhc7irnoi3zhxy3zv5fac3kddjhrgreiquawx2wm3u",
    name: "Kashif",
    symbol: "GOKU"
  });

console.log("METADATA UPDATED");
console.log(uri);