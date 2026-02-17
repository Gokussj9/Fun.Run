import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

import { PrivyProvider } from "@privy-io/react-auth";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmld3um1x01w8i50ct60xaywb"
      config={{
        loginMethods: ["google"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          solana: { createOnLogin: "users-without-wallets" },
        },
        appearance: {
          theme: "dark",
          walletChainType: "solana-only",
          showWalletLoginFirst: false,
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);
