import IntroSplash from "./IntroSplash";
import "./App.css";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useExportWallet } from "@privy-io/react-auth/solana";
import { createChart, ColorType } from "lightweight-charts";

const INTRO_MS = 5000;
const APP_LOGO_URL = "/logo.png";
const API_BASE = "https://zooming-solace-production-c360.up.railway.app";

const WS_BASE = API_BASE
  .replace("https://", "wss://")
  .replace("http://", "ws://");

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const STARTING_MC_USD = 6500;
const LS_THEME = "theme";
const LS_PROFILE_AVATAR = "profile_avatar_v1";

const APP_OWNER_WALLET = "HEBqdStfnZgygQVMxpq5CXjsfPPagytdZoAyY2WcC1ji";
const DEX_LAUNCH_MC_USD = 2_000_000;
const DEX_OPTIONS = [
  { id: "raydium", name: "Raydium", sub: "Most popular Solana liquidity pool option." },
  { id: "orca", name: "Orca", sub: "Clean Solana DEX with concentrated liquidity." },
  { id: "meteora", name: "Meteora", sub: "Advanced pools and dynamic liquidity tools." },
];
const FUNRUN_NATIVE_ADS = [
  "Fun.Run — Start your crypto journey today",
  "Fun.Run — Create. Launch. Grow.",
  "Fun.Run — Turn your meme into a movement",
  "Fun.Run — Discover the next viral coin",
  "Fun.Run — Launch your coin in seconds",
  "Fun.Run — Trade fast. Earn rewards.",
  "Fun.Run — Built for creators, powered by community",
  "Fun.Run — Your meme. Your coin. Your run.",
  "Fun.Run — Invite friends and earn 50% rewards",
  "Fun.Run — Where new coins begin",
];

const REFERRAL_AD_TEXT = "Fun.Run — Invite friends and earn 50% rewards";
const FUNRUN_AD_SEQUENCE = [
  REFERRAL_AD_TEXT,
  FUNRUN_NATIVE_ADS[0],
  REFERRAL_AD_TEXT,
  FUNRUN_NATIVE_ADS[1],
  REFERRAL_AD_TEXT,
  FUNRUN_NATIVE_ADS[2],
  REFERRAL_AD_TEXT,
  FUNRUN_NATIVE_ADS[3],
  REFERRAL_AD_TEXT,
  FUNRUN_NATIVE_ADS[4],
  FUNRUN_NATIVE_ADS[5],
  FUNRUN_NATIVE_ADS[6],
  FUNRUN_NATIVE_ADS[7],
  FUNRUN_NATIVE_ADS[9],
];

const PROFILE_PRESET_LOGOS = [
  "/logo.png",
  "https://api.dicebear.com/7.x/shapes/svg?seed=funrun",
  "https://api.dicebear.com/7.x/bottts/svg?seed=solana",
  "https://api.dicebear.com/7.x/icons/svg?seed=meme",
  "https://api.dicebear.com/7.x/thumbs/svg?seed=creator",
  "https://api.dicebear.com/7.x/glass/svg?seed=run",
];

function ThemeStyles() {
  return (
    <style>{`
    :root{
  --bg:#07111F;
  --bgSoft:rgba(7,17,31,.66);

  --card:rgba(18,29,45,.42);
  --card2:rgba(12,22,35,.30);
  --card3:rgba(255,255,255,.05);

  --border:rgba(255,255,255,.10);
  --borderSoft:rgba(255,255,255,.06);

  --text:#F7FBFF;
  --muted:rgba(231,241,255,.78);
  --muted2:rgba(208,223,243,.54);

  --primary:#63F5C8;
  --primary2:#7CCBFF;
  --secondary:#7CCBFF;
  --accent:#A78BFA;
  --accent2:#A78BFA;
  --accent3:#FF8FB1;

  --danger:#FF8DA1;
  --warn:#FFD47A;
  --good:#63F5C8;

  --heroGlow:rgba(99,245,200,.18);
  --btnBg:linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  --btnText:#04110D;
  --inputBg:rgba(255,255,255,.045);

  --shadow1:0 14px 40px rgba(0,0,0,.24);
  --shadow2:0 24px 80px rgba(0,0,0,.30);
  --shine:inset 0 1px 0 rgba(255,255,255,.08);
}

      *{ box-sizing:border-box; }
      html,body,#root{ min-height:100%; }

      body{
        margin:0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
        color:var(--text);
        background:
          radial-gradient(1100px 700px at 50% -10%, rgba(25,230,162,.12), transparent 55%),
          radial-gradient(900px 600px at 100% 0%, rgba(98,215,255,.10), transparent 42%),
          radial-gradient(800px 520px at 0% 100%, rgba(155,140,255,.08), transparent 40%),
          linear-gradient(180deg, #030507 0%, #05070A 100%);
        -webkit-font-smoothing:antialiased;
        text-rendering:optimizeLegibility;
      }

      body::before{
        content:"";
        position:fixed;
        inset:0;
        pointer-events:none;
        background:
          linear-gradient(to bottom, rgba(255,255,255,.02), transparent 16%),
          radial-gradient(700px 300px at 50% 0%, rgba(255,255,255,.025), transparent 70%);
        z-index:0;
      }

      a{ color:inherit; text-decoration:none; }

      .topbar{
        position:sticky;
        top:0;
        z-index:80;
        padding:10px 12px 0;
        background:transparent;
      }

      .topbarInner{
        width:min(100%, 560px);
        margin:0 auto;
        min-height:68px;
        padding:11px 12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        border:1px solid var(--border);
        border-radius:24px;
        background:
          linear-gradient(180deg, rgba(16,22,28,.78), rgba(10,14,18,.70));
        box-shadow: var(--shadow1), var(--shine);
        backdrop-filter: blur(6px) saturate(140%);
        -webkit-backdrop-filter: blur(6px) saturate(140%);
      }

      .brand{
        display:flex;
        align-items:center;
        gap:11px;
        min-width:0;
        flex:1;
      }

      .brandLogo{
        width:44px;
        height:44px;
        border-radius:15px;
        overflow:hidden;
        flex:0 0 auto;
        border:1px solid rgba(255,255,255,.12);
        background:
          linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025));
        box-shadow:
          0 10px 24px rgba(0,0,0,.24),
          inset 0 1px 0 rgba(255,255,255,.06);
      }

      .brandLogo img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }

      .brandText{
        min-width:0;
        display:flex;
        flex-direction:column;
        gap:2px;
      }

      .brandTitle{
        font-size:15px;
        font-weight:1000;
        line-height:1;
        letter-spacing:.18px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .brandSub{
        font-size:11px;
        color:var(--muted2);
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .topActions{
        display:flex;
        align-items:center;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      .appShell{
        position:relative;
        z-index:1;
        width:100%;
        margin:0 auto;
        padding:16px 12px 126px;
      }

      .grid,
      .leftCol,
      .midCol,
      .rightCol{
        display:grid;
        grid-template-columns:1fr;
        gap:16px;
      }

     .card{
  position:relative;
  border:none;
  border-radius:16px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card) 88%, white 12%), var(--card)),
    linear-gradient(180deg, color-mix(in srgb, var(--bg) 72%, black 28%), color-mix(in srgb, var(--bg) 82%, black 18%));
  box-shadow:
    var(--shadow2),
    0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent),
    0 18px 50px color-mix(in srgb, var(--glow) 18%, transparent),
    var(--shine);
  overflow:hidden;
  backdrop-filter: blur(6px) saturate(135%);
  -webkit-backdrop-filter: blur(6px) saturate(135%);
  padding: 16px;
}

      .card::before{
        content:"";
        position:absolute;
        inset:0;
        pointer-events:none;
        background:linear-gradient(180deg, rgba(255,255,255,.02), transparent 28%);
      }

      .cardBody{
        position:relative;
        z-index:1;
        padding:8px;
      }

      .sectionHeader{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:12px;
      }

      .sectionTitle{
        font-size:13px;
        font-weight:1000;
        letter-spacing:.18px;
      }

      .sectionSub{
        font-size:11px;
        color:var(--muted2);
      }

      .pillRow{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }

      .pill{
        display:inline-flex;
        align-items:center;
        gap:7px;
        padding:8px 12px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.08);
        background:
          linear-gradient(180deg, rgba(255,255,255,.055), rgba(255,255,255,.025));
        font-size:12px;
        color:var(--muted);
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      }

      .coinList{
        display:grid;
        gap:10px;
      }

      .coinBtn{
  width:100%;
  text-align:left;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--card) 82%, white 18%), color-mix(in srgb, var(--card) 94%, black 6%));
  border:1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
  border-radius:20px;
  padding:13px;
  color:var(--text);
  cursor:pointer;
  transition:transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.035),
    0 10px 24px color-mix(in srgb, var(--glow) 10%, transparent);
}

      .coinBtn:hover{
        transform:translateY(-1px);
        border-color:rgba(25,230,162,.24);
        background:
          linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.024));
      }

      .coinRow{
        display:flex;
        align-items:center;
        gap:12px;
        min-width:0;
      }

      .coinText{
        min-width:0;
        flex:1;
      }

      .coinName{
        font-weight:950;
        font-size:14px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .coinMeta{
        margin-top:4px;
        font-size:12px;
        color:var(--muted2);
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .rightNum{
        text-align:right;
        flex:0 0 auto;
      }

      .rightNumMain{
        font-weight:1000;
        font-size:13px;
      }

      .rightNumSub{
        margin-top:3px;
        font-size:11px;
        color:var(--muted2);
      }

      .hero{
        position:relative;
        overflow:hidden;
      }

      .heroGlow{
        position:absolute;
        right:-80px;
        bottom:-80px;
        width:260px;
        height:260px;
        background:radial-gradient(circle at center, rgba(25,230,162,.18), transparent 62%);
        pointer-events:none;
        filter:blur(6px);
      }

      .heroTitle{
        font-size:25px;
        line-height:1.02;
        font-weight:1000;
        letter-spacing:.14px;
        max-width:280px;
      }

      .heroText{
        margin-top:12px;
        color:var(--muted);
        font-size:14px;
        line-height:1.64;
        max-width:360px;
      }

      .heroActions{
        display:flex;
        gap:10px;
        margin-top:16px;
        flex-wrap:wrap;
      }

      .tabs{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

   .tabBtn{
  border:none;
  cursor:pointer;
  padding:9px 13px;
  border-radius:15px;
  font-size:12px;
  font-weight:900;
  color:var(--text);
  background:color-mix(in srgb, var(--card) 88%, white 12%);
  border:1px solid color-mix(in srgb, var(--primary) 14%, var(--border));
  transition:all .16s ease;
}

.tabBtn.active{
  background:linear-gradient(135deg, var(--primary), var(--secondary));
  color:var(--btnText);
  border-color:color-mix(in srgb, var(--primary) 40%, white 10%);
  box-shadow:0 10px 24px color-mix(in srgb, var(--glow) 24%, transparent);
}

      .searchBox{
        display:flex;
        gap:10px;
        align-items:center;
        padding:12px 14px;
        border-radius:18px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(255,255,255,.07);
      }

      .searchBox input{
        width:100%;
        background:transparent;
        border:none;
        outline:none;
        color:var(--text);
        font-size:14px;
      }

      .miniMuted{
        font-size:11px;
        color:var(--muted2);
      }

      .hr{
        height:1px;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent);
        margin:12px 0;
      }

      .scrollY{
        max-height:480px;
        overflow:auto;
        padding-right:4px;
        scrollbar-width:none;
        -ms-overflow-style:none;
      }
      .scrollY::-webkit-scrollbar{ display:none; }

      .hScroll{
        display:flex;
        gap:10px;
        overflow:auto;
        padding-bottom:2px;
        scrollbar-width:none;
        -ms-overflow-style:none;
      }
      .hScroll::-webkit-scrollbar{ display:none; }

      .tinyCard{
        min-width:230px;
        border-radius:20px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.03);
        padding:13px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
      }

      .statsGrid{
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 14px;
}

      .stat{
  padding: 14px;
  border-radius: 18px;

  background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035));

  border: 1px solid rgba(255,255,255,0.12);

  text-align: center;

  box-shadow:
    0 10px 30px rgba(0,0,0,0.25),
    inset 0 1px 0 rgba(255,255,255,0.10);

  backdrop-filter: blur(12px);
}

      .statLabel{
        font-size:11px;
        color:var(--muted2);
      }

      .statValue{
        margin-top:8px;
        font-size:17px;
        font-weight:1000;
        letter-spacing:.1px;
      }

      .footerNav{
        position:fixed;
        left:50%;
        transform:translateX(-50%);
        bottom:12px;
        z-index:90;
        width:min(calc(100% - 24px), 520px);
        display:grid;
        grid-template-columns: repeat(5, 1fr);
        gap:8px;
        padding:10px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(8,12,15,.88);
        backdrop-filter: blur(6px) saturate(140%);
        -webkit-backdrop-filter: blur(6px) saturate(140%);
        border-radius:24px;
        box-shadow:
          0 20px 60px rgba(0,0,0,.34),
          inset 0 1px 0 rgba(255,255,255,.04);
      }

      .footerBtn{
        border:none;
        cursor:pointer;
        border-radius:16px;
        padding:10px 6px;
        color:var(--muted);
        background:transparent;
        font-size:11px;
        font-weight:900;
        transition:all .16s ease;
        min-height:56px;
      }

      .footerBtn.active{
  color:var(--btnText);
  background:linear-gradient(135deg, var(--primary), var(--secondary));
  border:1px solid color-mix(in srgb, var(--primary) 40%, white 10%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.18),
    0 10px 24px color-mix(in srgb, var(--glow) 24%, transparent);
}

/* GLOBAL SCROLLBAR HIDE */
::-webkit-scrollbar {
  width: 0px;
  height: 0px;
}

body {
  scrollbar-width: none;
  overflow-x: hidden;
}

      .modalBack{
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.58);
        backdrop-filter: blur(10px);
        display:grid;
        place-items:center;
        z-index:120;
        padding:16px;
      }

      .modalCard{
        width:min(100%, 520px);
        max-height:min(86vh, 900px);
        overflow:auto;
        border-radius:28px;
        border:1px solid rgba(255,255,255,.10);
        background:linear-gradient(180deg, rgba(10,15,18,.98), rgba(8,12,15,.96));
        box-shadow:0 30px 80px rgba(0,0,0,.45);
      }

      .modalHead{
        position:sticky;
        top:0;
        z-index:2;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        padding:14px 16px;
        border-bottom:1px solid rgba(255,255,255,.08);
        background:rgba(10,15,18,.92);
        backdrop-filter:blur(6px)
      }

      .modalTitle{
        font-size:14px;
        font-weight:1000;
      }

      .modalBody{
        padding:16px;
      }

      .themeGrid{
        display:grid;
        gap:10px;
      }

      .themeOption{
        width:100%;
        text-align:left;
        padding:12px 13px;
        border-radius:16px;
        border:1px solid rgba(255,255,255,.08);
        background:rgba(255,255,255,.03);
        color:var(--text);
        cursor:pointer;
        transition:all .16s ease;
      }

      .themeOption.active{
        border-color:rgba(25,230,162,.28);
        background:linear-gradient(135deg, rgba(25,230,162,.12), rgba(143,255,208,.08));
      }

      .row{
        display:flex;
        align-items:center;
        gap:10px;
      }

      .space{
        flex:1;
        min-width:0;
      }



      .nativeAd{
        position:relative;
        isolation:isolate;
        overflow:hidden;
        min-height:58px;
        border-radius:30px;
        border:1px solid color-mix(in srgb, var(--primary) 48%, rgba(255,255,255,.16));
        background:
          radial-gradient(520px 220px at 0% 0%, rgba(99,245,200,.44), transparent 58%),
          radial-gradient(440px 220px at 100% 0%, rgba(124,203,255,.35), transparent 62%),
          radial-gradient(420px 230px at 42% 110%, rgba(167,139,250,.32), transparent 64%),
          linear-gradient(135deg, rgba(8,22,34,.98) 0%, rgba(11,38,54,.94) 34%, rgba(35,23,70,.92) 72%, rgba(7,18,32,.98) 100%);
        box-shadow:
          0 22px 60px rgba(0,0,0,.38),
          0 0 0 1px rgba(255,255,255,.045),
          0 0 38px color-mix(in srgb, var(--primary) 22%, transparent),
          0 0 70px rgba(167,139,250,.16),
          inset 0 1px 0 rgba(255,255,255,.26),
          inset 0 -1px 0 rgba(255,255,255,.08);
        padding:10px 12px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        backdrop-filter:blur(8px) saturate(175%);
        -webkit-backdrop-filter:blur(8px) saturate(175%);
        transform:translateZ(0);
      }

      .nativeAd::before{
        content:"";
        position:absolute;
        inset:-95% -35%;
        background:
          linear-gradient(112deg, transparent 34%, rgba(255,255,255,.28) 45%, rgba(255,255,255,.08) 53%, transparent 66%);
        transform:translateX(-55%) rotate(2deg);
        animation:funAdShine 6.2s ease-in-out infinite;
        pointer-events:none;
        z-index:0;
      }

      .nativeAd::after{
        content:"";
        position:absolute;
        inset:1px;
        border-radius:inherit;
        background:
          radial-gradient(16px 16px at 18% 26%, rgba(255,255,255,.36), transparent 58%),
          radial-gradient(11px 11px at 80% 22%, rgba(99,245,200,.36), transparent 60%),
          radial-gradient(13px 13px at 91% 72%, rgba(167,139,250,.36), transparent 60%),
          linear-gradient(180deg, rgba(255,255,255,.12), transparent 34%, rgba(255,255,255,.055));
        opacity:.82;
        pointer-events:none;
        z-index:0;
      }

      .nativeAdOrb{
        position:absolute;
        right:58px;
        top:50%;
        width:92px;
        height:92px;
        transform:translateY(-50%);
        border-radius:28px;
        background:
          radial-gradient(circle at 35% 30%, rgba(255,255,255,.88), rgba(99,245,200,.52) 18%, rgba(124,203,255,.26) 42%, rgba(167,139,250,.12) 65%, transparent 72%),
          linear-gradient(135deg, rgba(99,245,200,.22), rgba(167,139,250,.18));
        box-shadow:
          0 0 34px rgba(99,245,200,.24),
          0 0 54px rgba(167,139,250,.16),
          inset 0 1px 0 rgba(255,255,255,.32);
        opacity:.76;
        z-index:0;
      }

      .nativeAdCrystal{
        position:absolute;
        right:114px;
        top:13px;
        width:18px;
        height:18px;
        transform:rotate(45deg);
        border-radius:5px;
        background:linear-gradient(135deg, rgba(255,255,255,.92), rgba(99,245,200,.48), rgba(167,139,250,.45));
        box-shadow:0 0 22px rgba(99,245,200,.35);
        opacity:.75;
        z-index:0;
      }

      .nativeAdContent{
        position:relative;
        z-index:2;
        min-width:0;
        display:flex;
        flex-direction:column;
        gap:6px;
      }

      .nativeAdKicker{
        display:flex;
        align-items:center;
        gap:7px;
        color:rgba(231,241,255,.70);
        font-size:10px;
        font-weight:1000;
        letter-spacing:.72px;
        text-transform:uppercase;
      }

      .nativeAdText{
        position:relative;
        z-index:2;
        font-size:14px;
        font-weight:1000;
        letter-spacing:.05px;
        line-height:1.22;
        color:#F9FCFF;
        text-shadow:0 2px 20px rgba(0,0,0,.38), 0 0 20px rgba(99,245,200,.14);
      }

      .nativeAdText strong{
        color:#FFE889;
        font-size:1.16em;
        letter-spacing:.2px;
        text-shadow:0 0 24px rgba(255,220,100,.28);
      }

      .nativeAdSub{
        font-size:11px;
        line-height:1.35;
        color:rgba(231,241,255,.72);
      }

      .nativeAdTag{
        position:relative;
        z-index:2;
        flex:0 0 auto;
        font-size:11px;
        font-weight:1000;
        color:#03110D;
        padding:10px 12px;
        border-radius:999px;
        background:linear-gradient(135deg, #63F5C8 0%, #7CCBFF 55%, #F0E7FF 100%);
        border:1px solid rgba(255,255,255,.35);
        box-shadow:
          0 14px 34px rgba(99,245,200,.28),
          0 0 32px rgba(124,203,255,.20),
          inset 0 1px 0 rgba(255,255,255,.55);
        white-space:nowrap;
      }

      .nativeAdDots{
        display:flex;
        gap:4px;
        margin-top:2px;
      }

      .nativeAdDot{
        width:5px;
        height:5px;
        border-radius:999px;
        background:rgba(255,255,255,.24);
        box-shadow:0 0 10px rgba(99,245,200,.16);
      }

      .nativeAdDot.active{
        width:16px;
        background:linear-gradient(90deg, var(--primary), var(--primary2));
      }

      @keyframes funAdShine{
        0%, 48%{ transform:translateX(-58%) rotate(2deg); opacity:0; }
        58%{ opacity:.95; }
        78%{ transform:translateX(58%) rotate(2deg); opacity:.20; }
        100%{ transform:translateX(58%) rotate(2deg); opacity:0; }
      }

      .ghostBtn{
        border:none;
        cursor:pointer;
        padding:10px 13px;
        border-radius:16px;
        font-size:12px;
        font-weight:900;
        color:var(--text);
        background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025));
        border:1px solid rgba(255,255,255,.10);
        transition:all .15s ease;
      }

      @media (max-width: 640px){
        .topbar{ padding:8px 8px 0; }

        .topbarInner{
          width:100%;
          min-height:62px;
          padding:10px 10px;
          border-radius:18px;        }

        .brandLogo{
          width:38px;
          height:38px;
          border-radius:12px;
        }

        .brandTitle{ font-size:14px; }
        .brandSub{ font-size:10px; }

        .topActions{ gap:6px; }

        .appShell{
          width:100%;
          padding:12px 8px 112px;
        }

        .card{
          border-radius:24px;
        }

        .cardBody{
          padding:14px;
        }

        .heroTitle{
          font-size:22px;
          max-width:none;
        }

        .heroText{
          font-size:13px;
          line-height:1.55;
        }

        .statsGrid{
          grid-template-columns:1fr;
          gap:8px;
        }

        .stat{
          min-height:66px;
          padding:11px;
          border-radius:18px;
        }

        .footerNav{
          width:calc(100% - 16px);
          bottom:8px;
          padding:8px;
          border-radius:20px;
          gap:6px;
        }

        .footerBtn{
          min-height:52px;
          border-radius:14px;
          font-size:10px;
          padding:8px 4px;
        }

        .nativeAd{
          min-height:62px;
          border-radius:24px;
          padding:8px 10px;
          gap:10px;
        }

        .nativeAdText{
          font-size:14px;
          line-height:1.22;
        }

        .nativeAdSub{
          font-size:10px;
        }

        .nativeAdKicker{
          font-size:9px;
        }

        .nativeAdTag{
          font-size:10px;
          padding:9px 10px;
        }

        .nativeAdOrb{
          width:72px;
          height:72px;
          right:40px;
          opacity:.58;
        }

        .nativeAdCrystal{
          right:86px;
        }

        .modalCard{
          width:100%;
          border-radius:22px;
        }
      }
    `}</style>
  );
}

function Card({ children, style }) {
  return (
    <div className="card" style={style}>
      <div className="cardBody">{children}</div>
    </div>
  );
}

function Pill({ children, style }) {
  return (
    <span className="pill" style={style}>
      {children}
    </span>
  );
}

function SectionHeader({ title, sub, right }) {
  return (
    <div className="sectionHeader">
      <div>
        <div className="sectionTitle">{title}</div>
        {sub ? <div className="sectionSub">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

function MiniBtn({ children, onClick, disabled, tone = "default", style }) {
  const toneStyle =
    tone === "good"
      ? {
          background:
            "linear-gradient(135deg, rgba(25,230,162,.22), rgba(143,255,208,.12))",
          border: "1px solid rgba(25,230,162,.30)",
          color: "var(--text)",
          boxShadow: "0 8px 20px rgba(25,230,162,.12)",
        }
      : tone === "danger"
      ? {
          background: "rgba(255,107,107,.12)",
          border: "1px solid rgba(255,107,107,.25)",
          color: "#FFD1D1",
        }
      : {
          background:
            "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025))",
          border: "1px solid rgba(255,255,255,.10)",
          color: "var(--text)",
        };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "10px 13px",
        borderRadius: 16,
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: ".2px",
        opacity: disabled ? 0.55 : 1,
        transition: "all .15s ease",
        ...toneStyle,
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.96)";
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "14px 16px",
        borderRadius: 18,
        fontSize: 14,
        fontWeight: 1000,
        letterSpacing: ".2px",
        color: "#03110D",
        background:
          "linear-gradient(135deg, var(--primary) 0%, var(--primary2) 100%)",
        boxShadow: `
          0 14px 40px rgba(25,230,162,.25),
          inset 0 1px 0 rgba(255,255,255,.4)
        `,
        transition: "all .18s ease",
        transform: disabled ? "none" : "translateY(0)",
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  textarea = false,
  rows = 4,
  style,
  rightLabel,
  onRightLabelClick,
}) {
  const baseStyle = {
    width: "100%",
    padding: "12px 13px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.03)",
    color: "var(--text)",
    outline: "none",
    fontSize: 14,
  };

  if (textarea) {
    return (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        style={{
          ...baseStyle,
          resize: "vertical",
          minHeight: 110,
          ...style,
        }}
      />
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type === "number" ? "text" : type}
        inputMode={type === "number" ? "decimal" : undefined}
        style={{
          ...baseStyle,
          paddingRight: rightLabel ? 76 : undefined,
          ...style,
        }}
      />
      {rightLabel ? (
        <button
          type="button"
          onClick={onRightLabelClick}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            border: "1px solid rgba(255,255,255,.10)",
            background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025))",
            color: "var(--text)",
            borderRadius: 12,
            padding: "7px 10px",
            fontSize: 11,
            fontWeight: 1000,
            cursor: "pointer",
          }}
        >
          {rightLabel}
        </button>
      ) : null}
    </div>
  );
}

function ScreenShell({ children }) {
  return <div className="midCol">{children}</div>;
}

function Title({ children, sub = null, right = null }) {
  return (
    <div className="sectionHeader" style={{ marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: ".2px" }}>
          {children}
        </div>
        {sub ? (
          <div style={{ marginTop: 5, fontSize: 12, color: "var(--muted)" }}>{sub}</div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function Toast({ text, onClose }) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => onClose?.(), 2200);
    return () => clearTimeout(t);
  }, [text, onClose]);

  if (!text) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 200,
        padding: "11px 14px",
        borderRadius: 14,
        border: "1px solid rgba(25,230,162,.24)",
        background: "rgba(7,11,14,.95)",
        color: "var(--text)",
        boxShadow: "0 18px 60px rgba(0,0,0,.35)",
        fontSize: 13,
        fontWeight: 900,
        maxWidth: "calc(100% - 24px)",
      }}
    >
      {text}
    </div>
  );
}

function NativeFunRunAd({ compact = false }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((v) => (v + 1) % FUNRUN_AD_SEQUENCE.length);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const text = FUNRUN_AD_SEQUENCE[idx % FUNRUN_AD_SEQUENCE.length] || REFERRAL_AD_TEXT;
  const isReferral = text === REFERRAL_AD_TEXT;
  const displayText = isReferral ? "Fun.Run — Invite friends and earn " : text;

  return (
    <div className="nativeAd" style={compact ? { minHeight: 56, borderRadius: 18, padding: "7px 10px" } : null}>
      <div className="nativeAdOrb" />
      <div className="nativeAdCrystal" />
      <div className="nativeAdContent">
        <div className="nativeAdKicker">✦ Native Fun.Run Ad</div>
        <div className="nativeAdText">
          {isReferral ? (
            <>{displayText}<strong>50% rewards</strong></>
          ) : (
            text
          )}
        </div>
        <div className="nativeAdSub">
          {isReferral ? "Share your link, grow the community, and earn on referrals." : "Fast launch. Clean trading. Creator-first growth engine."}
        </div>
        <div className="nativeAdDots">
          {[0, 1, 2, 3].map((n) => (
            <span key={n} className={`nativeAdDot ${n === idx % 4 ? "active" : ""}`} />
          ))}
        </div>
      </div>
      <div className="nativeAdTag">{isReferral ? "50% Rewards" : "Fun.Run"}</div>
    </div>
  );
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function shortWallet(w) {
  const s = String(w || "");
  if (!s) return "—";
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

function fmtNum(n, digits = 2) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return "0";
  return x.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function fmtUsd(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return "$0";
  if (x >= 1_000_000_000) return `$${(x / 1_000_000_000).toFixed(2)}B`;
  if (x >= 1_000_000) return `$${(x / 1_000_000).toFixed(2)}M`;
  if (x >= 1_000) return `$${(x / 1_000).toFixed(2)}K`;
  if (x >= 1) return `$${x.toFixed(2)}`;
  if (x >= 0.01) return `$${x.toFixed(4)}`;
  if (x >= 0.0001) return `$${x.toFixed(6)}`;
  if (x >= 0.000001) return `$${x.toFixed(8)}`;
  return `$${x.toFixed(10)}`;
}

function fmtSol(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x) || x <= 0) return "0";
  if (x >= 1000) return fmtNum(x, 0);
  if (x >= 1) return fmtNum(x, 3);
  if (x >= 0.01) return fmtNum(x, 4);
  return fmtNum(x, 6);
}

function pctChangeFromChart(chart, lookback = 12) {
  const arr = Array.isArray(chart)
    ? chart.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    : [];

  if (arr.length < 2) return 0;

  const end = arr[arr.length - 1];
  const startIndex = Math.max(0, arr.length - 1 - lookback);
  const start = arr[startIndex] || arr[0] || end;

  if (!start || !Number.isFinite(start) || start <= 0) return 0;

  const pct = ((end - start) / start) * 100;
  const clamped = Math.max(-9999, Math.min(9999, pct));
  return Number.isFinite(clamped) ? clamped : 0;
}

function normalizeCoin(c = {}) {
  const totalSupply = Math.max(1, safeNum(c.totalSupply, 1_000_000_000));
  const curveSupply = Math.max(1, safeNum(c.curveSupply, c.curve_supply || totalSupply));
  const tokenReserve = Math.max(0, safeNum(c.tokenReserve, c.reserve_token || 0));
  const circulating = Math.max(0, totalSupply - tokenReserve);
  const mc =
    safeNum(c.mc, 0) ||
    safeNum(c.marketCapUsd, 0) ||
    safeNum(c.market_cap, 0) ||
    STARTING_MC_USD;

  const chart =
    Array.isArray(c.chart) && c.chart.length
      ? c.chart.map((x) => safeNum(x, 0)).filter((x) => x >= 0)
      : [mc, mc, mc, mc, mc];

  return {
    ...c,
    id: String(c.id || ""),
    name: String(c.name || ""),
    symbol: String(c.symbol || "").toUpperCase(),
    story: String(c.story || ""),
    logo: String(c.logo || ""),
    metadataUri: String(c.metadataUri || c.metadata_uri || ""),
    creatorWallet: String(c.creatorWallet || c.creator_wallet || c.owner || ""),
    totalSupply,
    curveSupply,
    curveSold: Math.max(0, safeNum(c.curveSold, c.curve_sold || 0)),
    tokenReserve,
    circulating,
    volumeSol: Math.max(0, safeNum(c.volumeSol, c.volume_sol || 0)),
    priceSol: Math.max(0, safeNum(c.priceSol, c.last_price || 0)),
    priceUsd: Math.max(0, safeNum(c.priceUsd, c.price || 0)),
    lastPriceUsd: Math.max(0, safeNum(c.lastPriceUsd, c.last_price_usd || c.priceUsd || c.price || 0)),
    vTokens: Math.max(0, safeNum(c.vTokens, c.v_tokens || 0)),
    vSol: Math.max(0, safeNum(c.vSol, c.v_sol || 0)),
    mc,
    ath: Math.max(mc, safeNum(c.ath, c.ath_market_cap || mc)),
    chart,
    holders:
      c && typeof c.holders === "object" && !Array.isArray(c.holders)
        ? c.holders
        : c.prevHolders && typeof c.prevHolders === "object"
        ? c.prevHolders
        : {},
    createdAt: safeNum(c.createdAt, c.created_at ? new Date(c.created_at).getTime() : Date.now()),
    lastTradeAt: safeNum(c.lastTradeAt, c.last_trade_at || 0),
    creatorRewardsSol: Math.max(0, safeNum(c.creatorRewardsSol, c.creator_rewards || 0)),
  };
}

function getCoinPriceUsd(c) {
  const direct = safeNum(c?.priceUsd, 0);
  if (direct > 0) {
    return direct;
  }

  const mc = safeNum(c?.mc, 0);
  const total = Math.max(1, safeNum(c?.totalSupply, 1_000_000_000));
  if (mc > 0 && total > 0) return mc / total;

  const chart = Array.isArray(c?.chart) ? c.chart : [];
  return Math.max(0, safeNum(chart[chart.length - 1], 0));
}

function coinSubtitle(c) {
  const move24h = getCoin24hMovePct(c);
  const sign = move24h > 0 ? "+" : "";
  const age = getCoinAgeLabel(c);
  return `Age ${age} • 24h ${sign}${move24h.toFixed(2)}%`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(String(text || ""));
    return true;
  } catch {
    return false;
  }
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function timeAgo(ts) {
  const n = Number(ts || 0);
  if (!Number.isFinite(n) || n <= 0) return "just now";

  const diff = Math.max(0, Date.now() - n);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function rangePointsFor(chartRange) {
  switch (String(chartRange || "1D").toUpperCase()) {
    case "5M": return 20;
    case "15M": return 32;
    case "1H": return 48;
    case "4H": return 72;
    case "1D": return 96;
    case "1W": return 132;
    case "1M": return 180;
    default: return 96;
  }
}

const CHART_TIMEFRAMES = {
  "5M": { ms: 5 * 60 * 1000, label: "5m", bars: 100 },
  "15M": { ms: 15 * 60 * 1000, label: "15m", bars: 100 },
  "1H": { ms: 60 * 60 * 1000, label: "1h", bars: 100 },
  "4H": { ms: 4 * 60 * 60 * 1000, label: "4h", bars: 100 },
  "1D": { ms: 24 * 60 * 60 * 1000, label: "1D", bars: 100 },
  "1W": { ms: 7 * 24 * 60 * 60 * 1000, label: "1W", bars: 100 },
  "1M": { ms: 30 * 24 * 60 * 60 * 1000, label: "1M", bars: 100 },
};

function getTimeframeCfg(range) {
  return CHART_TIMEFRAMES[String(range || "1D").toUpperCase()] || CHART_TIMEFRAMES["1D"];
}

function bucketStartMs(ts, bucketMs) {
  const n = safeNum(ts, Date.now());
  return Math.floor(n / bucketMs) * bucketMs;
}

function getApproxSolUsd(coin) {
  const priceUsd = safeNum(coin?.priceUsd, 0);
  const priceSol = safeNum(coin?.priceSol, 0);
  if (priceUsd > 0 && priceSol > 0) return priceUsd / Math.max(priceSol, 1e-12);
  return 80;
}

function getTradePriceUsd(trade, coin, fallback) {
  const direct = safeNum(trade?.priceUsd, 0);
  if (direct > 0) return direct;

  const sol = Math.max(0, safeNum(trade?.sol, 0));
  const tokens = Math.max(0, safeNum(trade?.tokens, 0));
  const solUsd = getApproxSolUsd(coin);

  if (sol > 0 && tokens > 0) {
    const pxSol = sol / Math.max(tokens, 1e-12);
    const pxUsd = pxSol * solUsd;

    if (Number.isFinite(pxUsd) && pxUsd > 0) {
      const ref = Math.max(
        0.00000001,
        safeNum(fallback, 0) || safeNum(coin?.priceUsd, 0) || safeNum(coin?.lastPriceUsd, 0) || 0.000001
      );

      const minAllowed = ref * 0.2;
      const maxAllowed = ref * 5;

      if (pxUsd >= minAllowed && pxUsd <= maxAllowed) {
        return pxUsd;
      }
    }
  }

  return Math.max(
    0.00000001,
    safeNum(fallback, 0.000001)
  );
}

function getCoin24hMovePct(c) {
  const chart = Array.isArray(c?.chart) ? c.chart.map((x) => safeNum(x, 0)).filter((x) => x > 0) : [];
  if (chart.length < 2) return 0;
  const lookback = Math.min(24, chart.length - 1);
  const start = Math.max(0.00000001, safeNum(chart[chart.length - 1 - lookback], chart[0]));
  const end = Math.max(0.00000001, safeNum(chart[chart.length - 1], start));
  const pct = ((end - start) / start) * 100;
  return Number.isFinite(pct) ? Math.max(-99.99, Math.min(199.99, pct)) : 0;
}

function getCoinAgeLabel(c) {
  return timeAgo(c?.createdAt || c?.created_at);
}

function getReferralLink(addr) {
  if (!addr) return "";

  let base = "";

  try {
    base =
      (import.meta.env?.VITE_APP_URL || window.location.origin || "")
        .replace(/\/$/, "");
  } catch {
    base = window.location.origin || "";
  }

  return `${base}/?ref=${encodeURIComponent(addr)}`;
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  const base = String(API_BASE || "").replace(/\/$/, "");
  const url = base ? `${base}${path}` : path;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      throw new Error(json?.error || `Request failed (${res.status})`);
    }

    return json || {};
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("Request timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0a7 7 0 0114 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4.5v-6h-5v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 21a8 8 0 10-16 0m8-10a4 4 0 100-8a4 4 0 000 8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15.5A3.5 3.5 0 1012 8.5a3.5 3.5 0 000 7zm7.4-3.5a7.7 7.7 0 00-.08-1l2.04-1.59l-2-3.46l-2.46.76a7.85 7.85 0 00-1.73-1L14.8 2h-4l-.37 2.71c-.62.24-1.21.58-1.73 1l-2.46-.76l-2 3.46L6.28 11c-.05.33-.08.66-.08 1s.03.67.08 1l-2.04 1.59l2 3.46l2.46-.76c.52.42 1.11.76 1.73 1L10.8 22h4l.37-2.71c.62-.24 1.21-.58 1.73-1l2.46.76l2-3.46L19.32 13c.05-.33.08-.66.08-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 7a2 2 0 012-2h12a2 2 0 012 2v1H5a2 2 0 00-2 2V7zm0 4a2 2 0 012-2h16v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-6zm14 3a1.5 1.5 0 100-3a1.5 1.5 0 000 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CoinLogo({ c, size = 44, radius = 14 }) {
  const src = String(c?.logo || "").trim();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        flex: `0 0 ${size}px`,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.04)",
        display: "grid",
        placeItems: "center",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={c?.symbol || "coin"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div style={{ fontSize: 12, fontWeight: 1000, color: "var(--muted)" }}>
          {String(c?.symbol || c?.name || "?").slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function ThemeOption({ theme, current, setTheme, label }) {
  const active = current === theme;

  return (
    <button
      className={`themeOption ${active ? "active" : ""}`}
      onClick={() => {
        setTheme(theme);
        try {
          localStorage.setItem(LS_THEME, theme);
        } catch {}
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 1000, fontSize: 13 }}>{label || theme}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--muted2)" }}>{theme}</div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 999, background: "var(--primary)", border: "1px solid rgba(255,255,255,.12)" }} />
          <span style={{ width: 14, height: 14, borderRadius: 999, background: "var(--accent2)", border: "1px solid rgba(255,255,255,.12)" }} />
          <span style={{ width: 14, height: 14, borderRadius: 999, background: "var(--accent3)", border: "1px solid rgba(255,255,255,.12)" }} />
        </div>
      </div>
    </button>
  );
}

const CoinMiniCard = React.memo(function CoinMiniCard({ c, onOpen, subtitle }) {
  const move24h = getCoin24hMovePct(c);
  const isUp = move24h >= 0;
  const age = getCoinAgeLabel(c);

  return (
    <button className="coinBtn" onClick={onOpen}>
      <div className="coinRow">
        <CoinLogo c={c} size={46} radius={16} />

        <div className="coinText">
          <div className="coinName" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>{c?.name || c?.symbol || "—"}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 1000,
                padding: "4px 8px",
                borderRadius: 999,
                color: isUp ? "#07140F" : "#19080B",
                background: isUp
                  ? "linear-gradient(135deg, rgba(53,224,182,.98), rgba(120,255,210,.98))"
                  : "linear-gradient(135deg, rgba(255,95,109,.98), rgba(255,140,120,.98))",
                boxShadow: isUp ? "0 6px 18px rgba(53,224,182,.25)" : "0 6px 18px rgba(255,95,109,.25)",
              }}
            >
              {isUp ? "PUMP" : "DUMP"}
            </span>
          </div>
          <div className="coinMeta" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", whiteSpace: "normal" }}>
            <span>{c?.symbol || "—"}</span>
            <span>•</span>
            <span>Age {age}</span>
            <span>•</span>
            <span style={{ color: isUp ? "#35E0B6" : "#FF5F6D", fontWeight: 1000 }}>
              24h {move24h > 0 ? "+" : ""}{move24h.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="rightNum">
          <div className="rightNumMain" style={{ color: "#FFFFFF", fontWeight: 1000 }}>{fmtUsd(c?.mc || 0)}</div>
          <div className="rightNumSub" style={{ color: isUp ? "#35E0B6" : "#FF5F6D", fontWeight: 1000 }}>
            {move24h > 0 ? "+" : ""}{move24h.toFixed(2)}%
          </div>
        </div>
      </div>
    </button>
  );
});

function InlineAffiliateBar({ wallet, onCopy }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        marginBottom: 14,
      }}
    >
      <MiniBtn onClick={onCopy} style={{ paddingInline: 14 }}>
        Copy Link
      </MiniBtn>

      <div
        style={{
          minWidth: 0,
          flex: 1,
          padding: "10px 14px",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.025))",
          fontSize: 12,
          fontWeight: 900,
          color: "var(--text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {wallet ? getReferralLink(wallet) : "Affiliate link unavailable"}
      </div>
    </div>
  );
}

function ProfileCoinRow({ coin, primary, secondary, rightMain, rightSub, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: 12,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.03)",
        color: "var(--text)",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        marginBottom: 10,
      }}
    >
      <div className="coinRow">
        <CoinLogo c={coin} size={46} radius={16} />
        <div className="coinText">
          <div className="coinName">{coin?.name || coin?.symbol || "Unknown coin"}</div>
          <div className="coinMeta">{secondary}</div>
        </div>
        <div className="rightNum">
          <div className="rightNumMain">{rightMain}</div>
          <div className="rightNumSub">{rightSub}</div>
        </div>
      </div>
    </button>
  );
}

function PriceChart({ coin, height = 280, chartRange, setChartRange, isMobile = false, reloadKey = 0 }) {
  const chartRef = useRef(null);
  const [candles, setCandles] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [chartLook, setChartLook] = useState(() => {
    try {
      return localStorage.getItem("chart_look_v1") || "dark";
    } catch {
      return "dark";
    }
  });

  const themeCfg = useMemo(() => {
    const isLight = chartLook === "light";

    return isLight
      ? {
          wrapBg: "#FFFFFF",
          chartBg: "#FFFFFF",
          topText: "#0F172A",
          subText: "#475569",
          faintText: "#64748B",
          grid: "rgba(15,23,42,.06)",
          axis: "rgba(15,23,42,.10)",
          up: "#10B981",
          down: "#F43F5E",
          wickUp: "#10B981",
          wickDown: "#F43F5E",
          btnBg: "#F8FAFC",
          btnBorder: "rgba(15,23,42,.08)",
          btnText: "#111827",
          activeBg: "#E6FFFB",
          activeText: "#0F172A",
          activeBorder: "rgba(34,211,238,.45)",
          pctBg: "rgba(16,185,129,.08)",
        }
      : {
          wrapBg: "#091018",
          chartBg: "#091018",
          topText: "#F8FAFC",
          subText: "#94A3B8",
          faintText: "#64748B",
          grid: "rgba(148,163,184,.055)",
          axis: "rgba(148,163,184,.14)",
          up: "#23D7A0",
          down: "#F43F5E",
          wickUp: "#23D7A0",
          wickDown: "#F43F5E",
          btnBg: "rgba(255,255,255,.04)",
          btnBorder: "rgba(255,255,255,.08)",
          btnText: "rgba(255,255,255,.90)",
          activeBg: "linear-gradient(180deg, rgba(36,224,255,.98), rgba(32,210,250,.92))",
          activeText: "#03131A",
          activeBorder: "rgba(36,224,255,.45)",
          pctBg: "rgba(35,215,160,.10)",
        };
  }, [chartLook]);

  useEffect(() => {
    try {
      localStorage.setItem("chart_look_v1", chartLook);
    } catch {}
  }, [chartLook]);

  useEffect(() => {
    let mounted = true;
    let timer = null;

    async function loadActivity(force = false) {
      if (!coin?.id) return;

      const tfKey = String(chartRange || "1D").toUpperCase();
      const cacheKey = `coin_activity_${coin.id}_${tfKey}`;
      const cacheTTL = 2500;

      try {
        setActivityLoading(true);

        if (!force) {
          const cachedRaw = localStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (
              cached &&
              Array.isArray(cached.rows) &&
              Date.now() - Number(cached.ts || 0) < cacheTTL
            ) {
              if (mounted) setCandles(cached.rows);
              setActivityLoading(false);
              return;
            }
          }
        }

        const tfMap = {
          "5M": "5m",
          "15M": "15m",
          "1H": "1h",
          "4H": "4h",
          "1D": "1d",
          "1W": "1w",
          "1M": "1m",
        };

        const tf = tfMap[String(chartRange || "1D").toUpperCase()] || "1d";
        const json = await api(`/coin/${coin.id}/candles?tf=${tf}&limit=120`);

        if (!mounted) return;

        const rows = Array.isArray(json?.candles) ? json.candles : [];

        if (rows.length > 0) {
          setCandles(rows);
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ ts: Date.now(), rows })
          );
        } else {
          console.log("⚠️ empty candles for", tfKey, "keeping previous chart");
        }
      } catch {
      } finally {
        if (mounted) setActivityLoading(false);
      }
    }

    loadActivity(Boolean(reloadKey));
    timer = setInterval(() => loadActivity(true), 600000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [coin?.id, chartRange, reloadKey]);

  const candleData = useMemo(() => {
    const list = Array.isArray(candles) ? candles : [];
    if (!list.length) return [];

    const cfg = getTimeframeCfg(chartRange);
    const bucketMs = cfg.ms;
    const maxBars = 120;

    const refPrice = Math.max(0.00000001, safeNum(coin?.priceUsd || coin?.lastPriceUsd || coin?.price || 0, 0.00000001));
    const cleanPx = (v) => {
      const x = Math.max(0.00000001, safeNum(v, refPrice));
      if (refPrice > 0 && x > refPrice * 250) return refPrice;
      if (refPrice > 0 && x < refPrice / 250) return refPrice;
      return x;
    };

    const sorted = [...list]
      .map((c) => {
        const close = cleanPx(c.close);
        return {
          time: Math.floor(safeNum(c.time, 0) / bucketMs) * bucketMs,
          rawOpen: cleanPx(c.open),
          rawHigh: cleanPx(c.high),
          rawLow: cleanPx(c.low),
          close,
        };
      })
      .filter((c) => c.time > 0 && c.rawOpen > 0 && c.rawHigh > 0 && c.rawLow > 0 && c.close > 0)
      .sort((a, b) => a.time - b.time);

    if (!sorted.length) return [];

    const merged = [];
    let chainPrevClose = null;

    for (const row of sorted) {
      const last = merged[merged.length - 1];

      const open = chainPrevClose !== null ? chainPrevClose : row.rawOpen;
      const high = Math.max(open, row.close, row.rawHigh);
      const low = Math.min(open, row.close, row.rawLow);

      if (last && last.time === row.time) {
        last.high = Math.max(last.high, high);
        last.low = Math.min(last.low, low);
        last.close = row.close;
      } else {
        merged.push({
          time: row.time,
          open,
          high,
          low,
          close: row.close,
        });
      }

      chainPrevClose = row.close;
    }

    const nowBucket = Math.floor(Date.now() / bucketMs) * bucketMs;
    const start = Math.max(
      merged[0].time,
      nowBucket - (maxBars - 1) * bucketMs
    );

    const normalized = [];
    let cursor = start;
    let i = 0;
    let prevClose = merged[0].close;

    while (i < merged.length && merged[i].time < start) {
      prevClose = merged[i].close;
      i += 1;
    }

    while (cursor <= nowBucket) {
      const row = merged[i];

      if (row && row.time === cursor) {
        normalized.push(row);
        prevClose = row.close;
        i += 1;
      } else {
        normalized.push({
          time: cursor,
          open: prevClose,
          high: prevClose,
          low: prevClose,
          close: prevClose,
        });
      }

      cursor += bucketMs;
    }

    return normalized.slice(-maxBars);
  }, [candles, chartRange, coin?.priceUsd, coin?.lastPriceUsd, coin?.price]);

  const pct = useMemo(() => {
    return getCoin24hMovePct(coin || {});
  }, [coin?.chart, coin?.priceUsd, coin?.lastPriceUsd]);

  const livePrice = safeNum(
    candleData[candleData.length - 1]?.close,
    Math.max(0.00000001, safeNum(coin?.priceUsd, 0.000001))
  );

  const up = pct >= 0;
  const createdAgo = timeAgo(coin?.createdAt || coin?.created_at);
  const isLight = chartLook === "light";

  useEffect(() => {
    const host = chartRef.current;
    if (!host) return;
    if (!candleData.length) return;

    const width = Math.max(280, host.clientWidth || 280);

    const chart = createChart(host, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: themeCfg.chartBg },
        textColor: themeCfg.faintText,
        attributionLogo: false,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      },
      grid: {
        vertLines: { color: themeCfg.grid, visible: true },
        horzLines: { color: themeCfg.grid, visible: true },
      },
      rightPriceScale: {
        visible: true,
        borderColor: themeCfg.axis,
        scaleMargins: { top: 0.10, bottom: 0.08 },
        entireTextOnly: true,
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: themeCfg.axis,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
        barSpacing: Math.max(
          2.2,
          Math.min(
            candleData.length < 25 ? 12 : candleData.length < 60 ? 7 : 4.2,
            width / Math.max(100, candleData.length)
          )
        ),
        minBarSpacing: 1,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: isLight ? "rgba(15,23,42,.12)" : "rgba(148,163,184,.14)",
          labelBackgroundColor: isLight ? "#E2E8F0" : "#1E293B",
        },
        horzLine: {
          color: isLight ? "rgba(15,23,42,.12)" : "rgba(148,163,184,.14)",
          labelBackgroundColor: up ? themeCfg.up : themeCfg.down,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: themeCfg.up,
      downColor: themeCfg.down,
      borderUpColor: themeCfg.up,
      borderDownColor: themeCfg.down,
      wickUpColor: themeCfg.wickUp,
      wickDownColor: themeCfg.wickDown,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: up ? themeCfg.up : themeCfg.down,
      priceFormat: {
        type: "price",
        precision: livePrice > 1 ? 4 : livePrice > 0.01 ? 6 : 8,
        minMove: livePrice > 1 ? 0.0001 : livePrice > 0.01 ? 0.000001 : 0.00000001,
      },
    });

    const uniqueCandles = [];
    const seen = new Set();

    for (const c of candleData || []) {
      const t = Math.floor(Number(c.time) / 1000);

      if (
        !seen.has(t) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close)
      ) {
        seen.add(t);

        uniqueCandles.push({
          time: t,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        });
      }
    }

    series.setData(uniqueCandles);

    chart.timeScale().scrollToRealTime();
    chart.timeScale().fitContent();

    series.priceScale().applyOptions({
      autoScale: true,
      scaleMargins: {
        top: 0.25,
        bottom: 0.25,
      },
    });

    const handleResize = () => {
      if (!chartRef.current) return;
      chart.applyOptions({
        width: Math.max(280, chartRef.current.clientWidth || 280),
      });
    };

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(handleResize);
      ro.observe(host);
    } else {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candleData, chartLook, height, themeCfg, isLight, up, livePrice]);

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 20,
        overflow: "hidden",
        background: themeCfg.wrapBg,
        border: isLight ? "1px solid rgba(15,23,42,.06)" : "1px solid rgba(255,255,255,.06)",
        padding: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
          flexWrap: isMobile ? "wrap" : "nowrap",
          padding: "12px 14px 0 14px",
        }}
      >
        <div style={{ minWidth: 0, paddingTop: 2 }}>
          <div
            style={{
              fontSize: 12,
              color: isLight ? "#334155" : themeCfg.subText,
              lineHeight: 1.2,
            }}
          >
            Live Price
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 1000,
              color: isLight ? "#020617" : themeCfg.topText,
              lineHeight: 1.15,
              marginTop: 4,
            }}
          >
            {fmtUsd(livePrice)}
          </div>

          <div
            style={{
              fontSize: 11,
              color: isLight ? "#475569" : themeCfg.subText,
              marginTop: 6,
              lineHeight: 1.2,
            }}
          >
            Created {createdAgo}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isMobile ? "flex-start" : "flex-end",
            gap: 8,
            flexWrap: "wrap",
            marginLeft: "auto",
            maxWidth: "100%",
            width: "100%",
          }}
        >
          <button
            onClick={() => setChartLook(chartLook === "dark" ? "light" : "dark")}
            style={{
              height: 30,
              minWidth: 72,
              padding: "0 14px",
              borderRadius: 11,
              border: "1px solid rgba(0,0,0,.08)",
              background: "linear-gradient(180deg, rgba(36,224,255,.98), rgba(32,210,250,.92))",
              color: "#03131A",
              fontSize: 11,
              fontWeight: 1000,
              cursor: "pointer",
            }}
          >
            {chartLook === "dark" ? "Light" : "Dark"}
          </button>

          {["5M", "15M", "1H", "4H", "1D", "1W"].map((value) => {
            const active = chartRange === value;

            return (
              <button
                key={value}
                onClick={() => setChartRange(value)}
                style={{
                  height: 30,
                  minWidth: value === "15M" ? 50 : value === "1W" ? 58 : 42,
                  padding: "0 12px",
                  borderRadius: 11,
                  border: active ? `1px solid ${themeCfg.activeBorder}` : `1px solid ${themeCfg.btnBorder}`,
                  background: active ? themeCfg.activeBg : themeCfg.btnBg,
                  color: active ? themeCfg.activeText : themeCfg.btnText,
                  fontSize: 11,
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                {value === "5M"
                  ? "5m"
                  : value === "15M"
                  ? "15m"
                  : value === "1H"
                  ? "1h"
                  : value === "4H"
                  ? "4h"
                  : value === "1D"
                  ? "1D"
                  : "Week"}
              </button>
            );
          })}

          <div
            style={{
              fontSize: 11,
              fontWeight: 1000,
              color: up ? themeCfg.up : themeCfg.down,
              padding: "8px 10px",
              borderRadius: 999,
              border: `1px solid ${isLight ? "rgba(15,23,42,.08)" : "rgba(255,255,255,.08)"}`,
              background: up ? themeCfg.pctBg : "rgba(244,63,94,.08)",
              whiteSpace: "nowrap",
            }}
          >
            {up ? "+" : ""}
            {pct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div
        ref={chartRef}
        style={{
          width: "100%",
          height,
          borderRadius: 0,
          overflow: "hidden",
          marginTop: 0,
          padding: 0,
        }}
      />
    </div>
  );
}

export default function App() {
  const { login, authenticated, user, ready, logout } = usePrivy();
  const { exportWallet } = useExportWallet();
  const wsRef = useRef(null);

  const [recentTrades, setRecentTrades] = useState([]);

  const [showIntro, setShowIntro] = useState(() => {
    try {
      return sessionStorage.getItem("introSeen") !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!showIntro) return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem("introSeen", "1");
      } catch {}
      setShowIntro(false);
    }, INTRO_MS);
    return () => clearTimeout(t);
  }, [showIntro]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 520;

  const [toast, setToast] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAddr, setWithdrawAddr] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(LS_THEME) || "calm";
    } catch {
      return "calm";
    }
  });

  const [profileAvatar, setProfileAvatar] = useState(() => {
    try {
      return localStorage.getItem(LS_PROFILE_AVATAR) || PROFILE_PRESET_LOGOS[0];
    } catch {
      return PROFILE_PRESET_LOGOS[0];
    }
  });

  const [screen, setScreen] = useState("HOME");
  const [screenHistory, setScreenHistory] = useState(["HOME"]);
  const [selectedCoinId, setSelectedCoinId] = useState(null);
  const [creatorProfileId, setCreatorProfileId] = useState("");
  const [favoriteCoinIds, setFavoriteCoinIds] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("favorite_coins_v1") || "[]");
  } catch {
    return [];
  }
});

function toggleFavoriteCoin(coinId) {
  if (!coinId) return;

  setFavoriteCoinIds((prev) => {
    const next = prev.includes(coinId)
      ? prev.filter((id) => id !== coinId)
      : [...prev, coinId];

    localStorage.setItem(
      "favorite_coins_v1",
      JSON.stringify(next)
    );

    return next;
  });
}

  const [coins, setCoins] = useState([]);
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [coinsPage, setCoinsPage] = useState(0);
  const [coinsHasMore, setCoinsHasMore] = useState(true);
  const [hot15m, setHot15m] = useState([]);
  const [homeFeedMode, setHomeFeedMode] = useState("ALL");


  

  const [searchQ, setSearchQ] = useState("");
const [searchMode, setSearchMode] = useState("SEARCH");

const [profile, setProfile] = useState(null);
const [loadingProfile, setLoadingProfile] = useState(false);
const [walletSolBalance, setWalletSolBalance] = useState(0);
const [unlockNow, setUnlockNow] = useState(Date.now());

useEffect(() => {
  const timer = setInterval(() => {
    setUnlockNow(Date.now());
  }, 1000);

  return () => clearInterval(timer);
}, []);

const unlockDate = new Date("2027-01-01T00:00:00Z").getTime();
const unlockDiff = Math.max(0, unlockDate - unlockNow);

const unlockDays = Math.floor(unlockDiff / (1000 * 60 * 60 * 24));
const unlockHours = Math.floor((unlockDiff / (1000 * 60 * 60)) % 24);
const unlockMinutes = Math.floor((unlockDiff / (1000 * 60)) % 60);
const unlockSeconds = Math.floor((unlockDiff / 1000) % 60);

const [settingsOpen, setSettingsOpen] = useState(false);
const [phantomWallet, setPhantomWallet] = useState("");
const [connectingPhantom, setConnectingPhantom] = useState(false);

  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [story, setStory] = useState("");
  const [initialSol, setInitialSol] = useState("0.01");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [creating, setCreating] = useState(false);

  const [tradeMode, setTradeMode] = useState("BUY");
  const [chartRange, setChartRange] = useState("1D");
  const [chartReloadKey, setChartReloadKey] = useState(0);
  const [tradeAmount, setTradeAmount] = useState("");
  const [trading, setTrading] = useState(false);
  const [dexModalOpen, setDexModalOpen] = useState(false);

  const coinsLoadMoreRef = useRef(null);
  const didBootRef = useRef(false);

  function clearCoinsCache() {
    try {
      Object.keys(localStorage || {}).forEach((key) => {
        if (key === "coins_cache_v1" || key.startsWith("coins_page_")) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
  }

  useEffect(() => {
    const ws = new WebSocket(WS_BASE);

    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "coin:update") {
          const updated = normalizeCoin(msg.payload);

          setCoins((prev) =>
            prev.map((c) => {
              if (c.id !== updated.id) return c;

              return {
                ...c,
                ...updated,
                holders:
                  updated.holders &&
                  Object.keys(updated.holders).length
                    ? {
                        ...c.holders,
                        ...updated.holders,
                      }
                    : c.holders || {},
              };
            })
          );
        }
        if (msg.event === "trade:new") {
          setRecentTrades((prev) => [
            msg.payload,
            ...prev.slice(0, 24),
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = (url.searchParams.get("ref") || "").trim();
      if (ref) {
        localStorage.setItem("ref", ref);
        url.searchParams.delete("ref");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {}
  }, []);

  function getPhantomProvider() {
    try {
      if (typeof window === "undefined") return null;

      const phantomProvider = window?.phantom?.solana;
      if (phantomProvider?.isPhantom) return phantomProvider;

      const injectedProvider = window?.solana;
      if (injectedProvider?.isPhantom) return injectedProvider;

      if (Array.isArray(injectedProvider?.providers)) {
        return injectedProvider.providers.find((p) => p?.isPhantom) || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  const connectPhantom = async () => {
    try {
      setConnectingPhantom(true);
      const provider = getPhantomProvider();
      if (!provider) {
        alert("Phantom wallet not found. Install Phantom extension/app first.");
        window.open("https://phantom.app/", "_blank");
        return;
      }

      const resp = await provider.connect();
      const address = String(resp?.publicKey?.toString?.() || provider?.publicKey?.toString?.() || "").trim();
      if (!address) throw new Error("Phantom address not found");

      setPhantomWallet(address);
      setToast(`Phantom connected: ${shortWallet(address)}`);
    } catch (err) {
      console.error("Phantom connect error:", err);
      setToast(err?.message || "Phantom connect failed");
    } finally {
      setConnectingPhantom(false);
    }
  };

  async function disconnectPhantom() {
    try {
      const provider = getPhantomProvider();
      if (provider?.isConnected) await provider?.disconnect?.();
    } catch {}
    setPhantomWallet("");
    setToast("Phantom disconnected");
  }

  const solAddr = useMemo(() => {
    const phantom = String(phantomWallet || "").trim();
 // if (phantom) {
//   console.log("PHANTOM WALLET ACTIVE:", phantom);
//   return phantom;
// }

    const primary = String(user?.wallet?.address || "").trim();
    console.log("FULL USER:", user);
    if (primary) {
  console.log("PRIMARY WALLET:", primary);
  
  return primary;
}

    const solLinked =
      user?.linkedAccounts?.find(
        (a) => a?.type === "wallet" && a?.chainType === "solana" && a?.address
      )?.address || "";

    if (solLinked) return String(solLinked).trim();

    const anyLinked =
      user?.linkedAccounts?.find(
        (a) => a?.type === "wallet" && a?.address
      )?.address || "";

    return String(anyLinked).trim();
  }, [user, phantomWallet]);

  const isWalletConnected = useMemo(() => Boolean(solAddr), [solAddr]);

  // useEffect(() => {
//   const provider = getPhantomProvider();
//   if (!provider) return;

//   provider
//     .connect({ onlyIfTrusted: true })
//     .then((resp) => {
//       const addr = String(
//         resp?.publicKey?.toString?.() ||
//         provider?.publicKey?.toString?.() ||
//         ""
//       ).trim();

//       if (addr) setPhantomWallet(addr);
//     })
//     .catch(() => {});
// }, []);

  const selectedCoin = useMemo(() => {
    return (coins || []).find((c) => String(c.id) === String(selectedCoinId)) || null;
  }, [coins, selectedCoinId]);

  const myCreations = useMemo(() => {
    if (!solAddr) return [];
    return (coins || [])
      .filter((c) => String(c.creatorWallet || "").trim() === String(solAddr).trim())
      .sort((a, b) => safeNum(b.createdAt, 0) - safeNum(a.createdAt, 0));
  }, [coins, solAddr]);

  const topVolume = useMemo(() => {
    return (coins || [])
      .slice()
      .sort((a, b) => safeNum(b.volumeSol, 0) - safeNum(a.volumeSol, 0))
      .slice(0, 20);
  }, [coins]);

  const topMoves20 = useMemo(() => {
    return (coins || [])
      .map((c) => ({ c, pct: pctChangeFromChart(c?.chart || []) }))
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
      .slice(0, 20);
  }, [coins]);

  const filteredCoins = useMemo(() => {
    const q = String(searchQ || "").trim().toLowerCase();
    if (!q) return coins || [];

    return (coins || []).filter((c) => {
      return (
        String(c?.name || "").toLowerCase().includes(q) ||
        String(c?.symbol || "").toLowerCase().includes(q) ||
        String(c?.creatorWallet || "").toLowerCase().includes(q)
      );
    });
  }, [coins, searchQ]);

  const latestCoins = useMemo(() => {
    return (coins || [])
      .slice()
      .sort((a, b) => safeNum(b.createdAt, 0) - safeNum(a.createdAt, 0))
      .slice(0, 20);
  }, [coins]);

  const topMovers4h = useMemo(() => {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    return [...(coins || [])]
      .filter((c) => Number(c?.lastTradeAt || 0) >= cutoff)
      .sort((a, b) => Number(b?.volumeSol || 0) - Number(a?.volumeSol || 0));
  }, [coins]);

  async function loadCoins(page = 0, append = false) {
    try {
      setLoadingCoins(true);

      const cacheKey = `coins_page_${page}`;
      const cacheTTL = 2500;
      let json = null;

      if (!append) {
        try {
          const cachedRaw = localStorage.getItem(cacheKey);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached && Date.now() - Number(cached.ts || 0) < cacheTTL) {
              json = cached.data || null;
            }
          }
        } catch {}
      }

      if (!json) {
        try {
          json = await api(`/coin/list?page=${page}&limit=50`);
        } catch {
          const base = String(API_BASE || "").replace(/\/$/, "");
          const res = await fetch(`${base}/coin/list?page=${page}&limit=50`, { cache: "no-store" });
          json = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(json?.error || `Request failed (${res.status})`);
          }
        }

        if (!append) {
          try {
            localStorage.setItem(
              cacheKey,
              JSON.stringify({ ts: Date.now(), data: json })
            );
          } catch {}
        }
      }

      const rawCoins =
        Array.isArray(json?.coins) ? json.coins :
        Array.isArray(json?.items) ? json.items :
        Array.isArray(json?.data) ? json.data :
        Array.isArray(json) ? json :
        [];

      const rawHot =
        Array.isArray(json?.hot15m) ? json.hot15m :
        Array.isArray(json?.hot) ? json.hot :
        [];

      const incoming = (rawCoins || [])
        .map((c) => {
          try {
            const coin = normalizeCoin(c);
            if (!coin?.id) return null;
            return coin;
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const incomingHot = (rawHot || [])
        .map((c) => {
          try {
            return normalizeCoin(c);
          } catch {
            return null;
          }
        })
        .filter((c) => c && c.id);

      setHot15m(incomingHot);

      setCoins((prev) => {
        const base = append ? [...(prev || []), ...incoming] : incoming;
        const map = new Map();

        base.forEach((c) => {
          if (c?.id) map.set(String(c.id), c);
        });

        return Array.from(map.values()).sort(
          (a, b) => safeNum(b.createdAt, 0) - safeNum(a.createdAt, 0)
        );
      });

      setCoinsPage(page);
      setCoinsHasMore(Boolean(json?.hasMore ?? (incoming.length >= 50)));

      if (page === 0) {
        try {
          localStorage.setItem("coins_cache_v1", JSON.stringify(incoming));
        } catch {}
      }
    } catch (e) {
      setToast(e?.message || "Failed to load coins");
    } finally {
      setLoadingCoins(false);
    }
  }

  async function loadProfile(wallet = solAddr) {
    if (!wallet) return;

    try {
      setLoadingProfile(true);
      const json = await api(`/profile/${wallet}`);

 
      
      console.log(json);
      console.log(json.profile);
      console.log("ALL TXS:", json.profile?.txs);
      setProfile(json?.profile || null);

    } catch (e) {
      setToast(e?.message || "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
  }

  async function loadBalance(wallet = solAddr) {
    if (!wallet) return;
    try {
      const json = await api(`/balance/${wallet}`);
      setWalletSolBalance(Math.max(0, safeNum(json?.sol, 0)));
    } catch {
      setWalletSolBalance(0);
    }
  }

  useEffect(() => {
    if (didBootRef.current) return;
    didBootRef.current = true;

    try {
      const cached = JSON.parse(localStorage.getItem("coins_cache_v1") || "[]");
      if (Array.isArray(cached) && cached.length) {
        setCoins(cached.map(normalizeCoin));
      }
    } catch {}

    loadCoins(0, false);
  }, []);

  useEffect(() => {
    if (!isWalletConnected || !solAddr) {
      setProfile(null);
      setWalletSolBalance(0);
      return;
    }
    loadProfile(solAddr);
    loadBalance(solAddr);
  }, [isWalletConnected, solAddr]);

  useEffect(() => {
    if (screen !== "HOME") return;
    const el = coinsLoadMoreRef.current;
    if (!el || !coinsHasMore || loadingCoins) return;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && !loadingCoins && coinsHasMore) {
          loadCoins(coinsPage + 1, true);
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [screen, coinsPage, coinsHasMore, loadingCoins]);

  useEffect(() => {
    const themes = {
      calm: {
        bg: "#07111F",
        card: "rgba(18,29,45,.45)",
        text: "#F7FBFF",
        primary: "#63F5C8",
        secondary: "#7CCBFF",
        accent: "#A78BFA",
        danger: "#FF8DA1",
        glow: "rgba(99,245,200,.25)",
      },
      neon: {
        bg: "#0C0B1A",
        card: "rgba(31,20,49,.45)",
        text: "#FBF8FF",
        primary: "#C084FC",
        secondary: "#22D3EE",
        accent: "#F472B6",
        danger: "#FF4D6D",
        glow: "rgba(192,132,252,.35)",
      },
      ocean: {
        bg: "#071A22",
        card: "rgba(15,40,54,.45)",
        text: "#F2FCFF",
        primary: "#4FD1FF",
        secondary: "#63F5C8",
        accent: "#38BDF8",
        danger: "#FF7B7B",
        glow: "rgba(79,209,255,.25)",
      },
      fire: {
        bg: "#140707",
        card: "rgba(40,15,15,.45)",
        text: "#FFF5F5",
        primary: "#FF6B3D",
        secondary: "#FFD166",
        accent: "#FF3D6E",
        danger: "#FF2E2E",
        glow: "rgba(255,107,61,.25)",
      },
      royal: {
        bg: "#0A1024",
        card: "rgba(22,30,62,.45)",
        text: "#F6F8FF",
        primary: "#8FA8FF",
        secondary: "#63F5C8",
        accent: "#A78BFA",
        danger: "#FF6B9D",
        glow: "rgba(143,168,255,.25)",
      },
      rose: {
        bg: "#1A0B14",
        card: "rgba(56,24,43,.45)",
        text: "#FFF7FB",
        primary: "#FF8FB1",
        secondary: "#FDB7EA",
        accent: "#F472B6",
        danger: "#FF6B8A",
        glow: "rgba(255,143,177,.28)",
      },
    };

    const t = themes[theme] || themes.calm;

    document.documentElement.style.setProperty("--bg", t.bg);
    document.documentElement.style.setProperty("--card", t.card);
    document.documentElement.style.setProperty("--text", t.text);

    document.documentElement.style.setProperty("--btn-primary", t.primary);
    document.documentElement.style.setProperty("--btn-secondary", t.secondary);

    document.documentElement.style.setProperty("--border", t.secondary + "33");
    document.documentElement.style.setProperty("--shadow", t.glow);

    document.documentElement.style.setProperty("--primary", t.primary);
    document.documentElement.style.setProperty("--secondary", t.secondary);
    document.documentElement.style.setProperty("--accent", t.accent);
    document.documentElement.style.setProperty("--danger", t.danger);
    document.documentElement.style.setProperty("--glow", t.glow);

    document.body.style.background = `
      radial-gradient(900px 600px at 10% 0%, ${t.glow}, transparent),
      radial-gradient(800px 500px at 100% 0%, ${t.accent}, transparent),
      ${t.bg}
    `;

    document.body.style.color = t.text;

    try {
      localStorage.setItem(LS_THEME, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_PROFILE_AVATAR, profileAvatar);
    } catch {}
  }, [profileAvatar]);

  async function handleLogoPick(file) {
    if (!file) return;

    if (file.size > MAX_LOGO_BYTES) {
      setToast("Logo too large");
      return;
    }

    try {
      const data = await fileToDataUrl(file);
      setLogoFile(file);
      setLogoPreview(data);
    } catch {
      setToast("Logo read failed");
    }
  }

  function goScreen(next) {
    setScreenHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last === next) return prev;
      return [...prev, next];
    });
    setScreen(next);
  }

  function goBack() {
    setScreenHistory((prev) => {
      if (prev.length <= 1) {
        setScreen("HOME");
        return ["HOME"];
      }
      const nextHistory = prev.slice(0, -1);
      const prevScreen = nextHistory[nextHistory.length - 1] || "HOME";
      setScreen(prevScreen);
      return nextHistory;
    });
  }

  function openCoin(coin) {
    if (!coin?.id) return;
    setSelectedCoinId(coin.id);
    goScreen("COIN");
  }

  function openCreatorFromCoin(coin) {
    const wallet = String(coin?.creatorWallet || "").trim();
    if (!wallet) return;
    setCreatorProfileId(wallet);
    goScreen("CREATOR");
  }

  function renderBackButton() {
    return (
      <MiniBtn onClick={goBack} style={{ width: "fit-content" }}>
        ← Back
      </MiniBtn>
    );
  }

  async function handleCreateCoin() {
    if (!isWalletConnected || !solAddr) {
      setToast("Connect wallet first");
      return;
    }

    const n = tokenName.trim();
    const s = symbol.trim().toUpperCase();
    const st = story.trim();
    const init = Math.max(0, safeNum(initialSol, 0));

    if (!n || !s) {
      setToast("Name and symbol required");
      return;
    }

    try {
      setCreating(true);

      console.log("creatorWallet:", solAddr);

      const payload = {
        name: n,
        symbol: s,
        story: st,
        logo: logoPreview,
        initialSol: init,
        creatorWallet: solAddr,
      };

      const json = await api("/coin/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const created = normalizeCoin(json?.coin || {});
      if (!created?.id) throw new Error("Create failed");

      setCoins((prev) => [
        created,
        ...(prev || []).filter((x) => String(x.id) !== String(created.id)),
      ]);
      setSelectedCoinId(created.id);
      goScreen("COIN");

      setTokenName("");
      setSymbol("");
      setStory("");
      setInitialSol("0.01");
      setLogoFile(null);
      setLogoPreview("");

      setToast("Coin created");
      loadCoins(0, false);
      loadProfile(solAddr);
      loadBalance(solAddr);
    } catch (e) {
      setToast(e?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function patchProfileHoldingLocal(prev, coin, amount) {
    if (!prev || !coin?.id) return prev;
    const amt = Math.max(0, safeNum(amount, 0));
    const list = Array.isArray(prev.holdings) ? [...prev.holdings] : [];
    const idx = list.findIndex((h) => String(h.coinId || h.id || "") === String(coin.id));

    if (amt <= 0) {
      if (idx >= 0) list.splice(idx, 1);
      return { ...prev, holdings: list };
    }

    const row = {
      ...(idx >= 0 ? list[idx] : {}),
      coinId: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      logo: coin.logo,
      amount: amt,
      tokens: amt,
      totalSupply: Math.max(1, safeNum(coin.totalSupply, 1_000_000_000)),
      pct: (amt / Math.max(1, safeNum(coin.totalSupply, 1_000_000_000))) * 100,
      lastAt: Date.now(),
    };

    if (idx >= 0) list[idx] = row;
    else list.unshift(row);

    return { ...prev, holdings: list.sort((a, b) => safeNum(b.lastAt, 0) - safeNum(a.lastAt, 0)) };
  }

  const tradePreview = useMemo(() => {
    const amount = Math.max(0, safeNum(tradeAmount, 0));
    const feePct = 0.01;

    if (!selectedCoin || amount <= 0) {
      return {
        ok: false,
        estTokens: 0,
        feeSol: 0,
        netSol: 0,
        grossSolNeeded: 0,
        youReceiveSol: 0,
        priceSol: Math.max(0, safeNum(selectedCoin?.priceSol, 0)),
      };
    }

    const priceSol = Math.max(0.0000000001, safeNum(selectedCoin?.priceSol, 0));
    const solReserve = Math.max(0, safeNum(selectedCoin?.solReserve, 0));
    const tokenReserve = Math.max(1, safeNum(selectedCoin?.tokenReserve, 1));
    const curveSupply = Math.max(1, safeNum(selectedCoin?.curveSupply, tokenReserve));
    const vSol = Math.max(0.000000001, safeNum(selectedCoin?.vSol, 30));
    const vTokens = Math.max(1, safeNum(selectedCoin?.vTokens, curveSupply * 0.02));

    if (tradeMode === "BUY") {
      const feeSol = amount * feePct;
      const netSol = Math.max(0, amount - feeSol);

      const x = solReserve + vSol;
      const y = tokenReserve + vTokens;
      const k = x * y;

      const newX = x + netSol;
      const newY = k / Math.max(0.000000001, newX);
      const estTokens = Math.max(0, y - newY);

      return {
        ok: estTokens > 0,
        estTokens,
        feeSol,
        netSol,
        grossSolNeeded: amount,
        youReceiveSol: 0,
        priceSol,
      };
    }

    const tokensIn = amount;
    const x = solReserve + vSol;
    const y = tokenReserve + vTokens;
    const k = x * y;

    const newY = y + tokensIn;
    const newX = k / newY;
    const solOut = Math.max(0, x - newX);

    const feeSol = solOut * feePct;
    const netSol = Math.max(0, solOut - feeSol);

    return {
      ok: netSol > 0,
      estTokens: tokensIn,
      feeSol,
      netSol,
      grossSolNeeded: 0,
      youReceiveSol: netSol,
      priceSol,
    };
  }, [tradeAmount, tradeMode, selectedCoin]);

  async function handleTrade() {
    if (!isWalletConnected || !solAddr) {
      setToast("Connect wallet first");
      return;
    }

    if (!selectedCoin?.id) {
      setToast("Select a coin first");
      return;
    }

    const amount = Math.max(0, safeNum(tradeAmount, 0));
    if (amount <= 0) {
      setToast("Enter amount");
      return;
    }

    const current = { ...selectedCoin };
    const currentHolder = Math.max(0, safeNum(current?.holders?.[solAddr], 0));

    if (tradeMode === "SELL" && amount > currentHolder) {
      setToast("Not enough tokens");
      return;
    }

    const previewTokens = Math.max(0, safeNum(tradePreview?.estTokens, 0));

    try {
      setTrading(true);

      const path = tradeMode === "BUY" ? "/coin/buy" : "/coin/sell";
      const payload = {
        wallet: solAddr,
        coinId: current.id,
        ...(tradeMode === "BUY" ? { sol: amount } : { tokens: amount }),
      };

      const json = await api(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (json?.ok === false) {
        throw new Error(json?.error || "Trade failed");
      }

      const updated = normalizeCoin(json?.coin || {});
      const tradedTokens = Math.max(0, safeNum(json?.tokens, tradeMode === "BUY" ? previewTokens : amount));
      const fallbackHolder = Math.max(
        0,
        currentHolder + (tradeMode === "BUY" ? tradedTokens : -tradedTokens)
      );
      const resolvedHolder = Math.max(
        0,
        safeNum(updated?.holders?.[solAddr], fallbackHolder)
      );

      if (updated?.id) {
        const resolvedCoin = {
          ...updated,
          holders: {
            ...(updated.holders || {}),
            [solAddr]: resolvedHolder,
          },
        };

        setCoins((prev) => {
          const rows = Array.isArray(prev) ? prev : [];
          const exists = rows.some((c) => String(c.id) === String(resolvedCoin.id));
          return exists
            ? rows.map((c) => (String(c.id) === String(resolvedCoin.id) ? resolvedCoin : c))
            : [resolvedCoin, ...rows];
        });
        setProfile((prev) => patchProfileHoldingLocal(prev, resolvedCoin, resolvedHolder));
        setSelectedCoinId(resolvedCoin.id);
      }

      setTradeAmount("");
      setToast(tradeMode === "BUY" ? "Buy successful" : "Sell successful");
      clearCoinsCache();

      try {
        const latestJson = await api(`/coin/${current.id}`);
        const latestCoin = normalizeCoin(latestJson?.coin || updated || {});
        if (latestCoin?.id) {
          const latestHolder = Math.max(0, safeNum(latestCoin?.holders?.[solAddr], resolvedHolder));
          const latestResolved = {
            ...latestCoin,
            holders: { ...(latestCoin.holders || {}), [solAddr]: latestHolder },
          };
          setCoins((prev) => {
            const rows = Array.isArray(prev) ? prev : [];
            const exists = rows.some((c) => String(c.id) === String(latestResolved.id));
            return exists
              ? rows.map((c) => (String(c.id) === String(latestResolved.id) ? latestResolved : c))
              : [latestResolved, ...rows];
          });
          setProfile((prev) => patchProfileHoldingLocal(prev, latestResolved, latestHolder));
          setSelectedCoinId(latestResolved.id);
        }
      } catch {}

      setChartReloadKey((x) => x + 1);
      await Promise.allSettled([loadProfile(solAddr), loadBalance(solAddr), loadCoins(0, false)]);
    } catch (e) {
      setCoins((prev) =>
        (prev || []).map((c) =>
          String(c.id) === String(current.id)
            ? { ...c, holders: { ...(c.holders || {}), [solAddr]: currentHolder } }
            : c
        )
      );
      setProfile((prev) => patchProfileHoldingLocal(prev, current, currentHolder));
      setToast(e?.message || "Trade failed");
    } finally {
      setTrading(false);
    }
  }

  async function handleSetReferrer() {
    if (!isWalletConnected || !solAddr) return;

    try {
      const saved = (localStorage.getItem("ref") || "").trim();
      if (!saved || saved === solAddr) return;

      await api("/referral/set", {
        method: "POST",
        body: JSON.stringify({
          wallet: solAddr,
          referrer: saved,
        }),
      });
    } catch {}
  }

  useEffect(() => {
    if (!isWalletConnected || !solAddr) return;
    handleSetReferrer();
  }, [isWalletConnected, solAddr]);

  async function handleClaim(kind) {
    if (!isWalletConnected || !solAddr) {
      setToast("Connect wallet first");
      return;
    }

    try {
      const json = await api("/claim", {
        method: "POST",
        body: JSON.stringify({
          wallet: solAddr,
          kind,
        }),
      });

      if (json?.ok) {
        setToast(`Claimed ${fmtSol(json.amount)} SOL 🚀`);
        loadProfile(solAddr);
        loadBalance(solAddr);
        loadCoins(0, false);
      } else {
        setToast(json?.error || "Claim failed");
      }
    } catch (e) {
      setToast(e?.message || "Claim failed");
    }
  }

  const creatorCoin = selectedCoin || null;
  const creatorCoins = useMemo(() => {
    const cid = creatorProfileId || creatorCoin?.creatorWallet || "";
    return (coins || []).filter((x) => String(x.creatorWallet || "") === String(cid));
  }, [coins, creatorProfileId, creatorCoin]);

  const creatorRewards = useMemo(() => {
    return creatorCoins.reduce((sum, coin) => sum + Number(coin?.creatorRewardsSol || 0), 0);
  }, [creatorCoins]);

  const creatorHoldings = useMemo(() => {
    const cid = creatorProfileId || creatorCoin?.creatorWallet || "";
    if (!cid) return [];

    return creatorCoins
      .map((coin) => {
        const amt = Math.max(0, safeNum(coin?.holders?.[cid], 0));
        const pct = coin?.totalSupply ? (amt / coin.totalSupply) * 100 : 0;
        return { coin, amt, pct };
      })
      .filter((x) => x.amt > 0)
      .sort((a, b) => b.amt - a.amt);
  }, [creatorCoins, creatorProfileId, creatorCoin]);

  const profileHoldings = Array.isArray(profile?.holdings) ? profile.holdings : [];
  const profileTxs = Array.isArray(profile?.txs) ? profile.txs : [];

  const depositHistory = Array.isArray(profile?.depositHistory)
  ? profile.depositHistory
  : [];

const withdrawHistory = Array.isArray(profile?.withdrawHistory)
  ? profile.withdrawHistory
  : [];

const walletHistory = [
  ...depositHistory.map((d) => ({
    type: "DEPOSIT",
    amount: d.amount,
    txHash: d.tx_hash,
    createdAt: d.created_at,
  })),
  ...withdrawHistory.map((w) => ({
    type: "WITHDRAW",
    amount: w.amount,
    txHash: w.tx_hash,
    createdAt: w.created_at,
  })),
].sort(
  (a, b) =>
    new Date(b.createdAt).getTime() -
    new Date(a.createdAt).getTime()
);

  const recentCoinActivity = useMemo(() => {
    if (!selectedCoin?.id) return [];
    return (profileTxs || [])
      .filter((tx) => String(tx.coinId || "") === String(selectedCoin.id))
      .sort((a, b) => safeNum(b.ts || b.t, 0) - safeNum(a.ts || a.t, 0))
      .slice(0, 20);
  }, [profileTxs, selectedCoin]);

  const currentCoinPriceUsd = getCoinPriceUsd(selectedCoin || {});
  const currentCoinPriceSol = Math.max(0, safeNum(selectedCoin?.priceSol, 0));
  const currentWalletTokens = Math.max(0, safeNum(selectedCoin?.holders?.[solAddr], 0));
  const isSelectedCoinCreator = Boolean(selectedCoin?.creatorWallet && solAddr && String(selectedCoin.creatorWallet).trim() === String(solAddr).trim());
  const dexLaunchReady = Boolean(selectedCoin && safeNum(selectedCoin.mc, 0) >= DEX_LAUNCH_MC_USD);

  const toUsdFromSol = (sol) => fmtUsd(Number(sol || 0) * 80);

  const portfolioWalletUsd = Number(walletSolBalance || 0) * 80;

  const portfolioHoldingsUsd = profileHoldings.reduce((sum, h) => {
  const coin =
    (coins || []).find(
      (x) => String(x.id) === String(h.coinId || h.id || h.coin?.id)
    ) || {};

  const amt = Math.max(0, safeNum(h.amount, h.tokens || h.balance || 0));

  return sum + amt * getCoinPriceUsd(coin);
}, 0);

  return (
    <>
      <ThemeStyles />

      {withdrawOpen && (
        <div className="modalBack">
          <div className="modalCard">
            <div className="modalHead">
              <div className="modalTitle">Withdraw SOL</div>
              <MiniBtn onClick={() => setWithdrawOpen(false)}>Close</MiniBtn>
            </div>

            <div className="modalBody">
              <Input
                value={withdrawAddr}
                onChange={(e) => setWithdrawAddr(e.target.value)}
                placeholder="Enter SOL address"
              />

              <div style={{ height: 10 }} />

              <Input
                value={withdrawAmt}
                onChange={(e) => setWithdrawAmt(e.target.value)}
                placeholder="Enter amount in SOL"
                type="number"
              />

              <div style={{ height: 14 }} />

              <PrimaryButton
                onClick={async () => {
                  try {
                    if (!withdrawAddr || !withdrawAmt) {
                      setToast("Enter address & amount");
                      return;
                    }

                   const json = await api("/withdraw", {
  method: "POST",
  body: JSON.stringify({
    wallet: profile?.wallet,
    destination: withdrawAddr,
    amount: Number(withdrawAmt),
  }),
});

                    if (json?.ok) {
  setToast(`Sent ${withdrawAmt} SOL 🚀`);
  setWithdrawOpen(false);
  setWithdrawAddr("");
  setWithdrawAmt("");

  loadProfile(solAddr);
  loadBalance(solAddr);
}
                    
                    else {
                      setToast(json?.error || "Withdraw failed");
                    }
                  } catch (e) {
                    setToast(e.message || "Withdraw failed");
                  }
                }}
              >
                Confirm Withdraw
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {dexModalOpen && selectedCoin ? (
        <div className="modalBack" onClick={() => setDexModalOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div className="modalTitle">Launch to DEX</div>
              <MiniBtn onClick={() => setDexModalOpen(false)}>Close</MiniBtn>
            </div>
            <div className="modalBody">
              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "linear-gradient(135deg, rgba(99,245,200,.12), rgba(124,203,255,.08), rgba(167,139,250,.10))",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 1000 }}>{selectedCoin.name} → DEX Migration</div>
                  <div className="miniMuted" style={{ marginTop: 6 }}>
                    Required MC: {fmtUsd(DEX_LAUNCH_MC_USD)} • Current MC: {fmtUsd(selectedCoin.mc || 0)}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Pill style={{ color: dexLaunchReady ? "var(--good)" : "var(--warn)" }}>
                      {dexLaunchReady ? "Ready for Phase 2 launch" : "Locked until $2M MC"}
                    </Pill>
                  </div>
                </div>

                {DEX_OPTIONS.map((dex) => (
                  <button
                    key={dex.id}
                    type="button"
                    onClick={() => setToast(dexLaunchReady ? `${dex.name} launch will be enabled in Phase 2` : "DEX launch unlocks at $2M MC")}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "1px solid rgba(255,255,255,.10)",
                      borderRadius: 18,
                      padding: 14,
                      cursor: "pointer",
                      color: "var(--text)",
                      background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025))",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 1000 }}>{dex.name}</div>
                        <div className="miniMuted" style={{ marginTop: 5 }}>{dex.sub}</div>
                      </div>
                      <Pill>{dexLaunchReady ? "Select" : "Phase 2"}</Pill>
                    </div>
                  </button>
                ))}

                <div className="miniMuted" style={{ lineHeight: 1.55 }}>
                  This is a safe placeholder for launch. Real liquidity pool creation is intentionally disabled until mainnet DEX integration is audited.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Toast text={toast} onClose={() => setToast("")} />

      {showIntro ? (
        <IntroSplash
          durationMs={5000}
          logoUrl={APP_LOGO_URL}
          onDone={() => setShowIntro(false)}
        />
      ) : null}

      <div className="topbar">
        <div className="topbarInner">
          <div
            className="brand"
            style={{ cursor: "pointer" }}
            onClick={() => goScreen("HOME")}
          >
            <div className="brandLogo">
              <img src={APP_LOGO_URL} alt="logo" />
            </div>
            <div className="brandText">
              <div className="brandTitle">Fun.Run</div>
              <div className="brandSub">Smooth launches. Fast trades. Made for creators.</div>
            </div>
          </div>

          <div className="topActions">
            {!authenticated ? (
              <MiniBtn
                tone="good"
                onClick={async () => {
                  try {
                    await login?.();
                  } catch (e) {
                    setToast(e?.message || "Google login failed");
                  }
                }}
              >
                Google Login
              </MiniBtn>
            ) : (
              <MiniBtn
                onClick={async () => {
                  try {
                    await logout?.();
                    setToast("Google logged out");
                  } catch (e) {
                    setToast(e?.message || "Logout failed");
                  }
                }}
              >
                Google Logout
              </MiniBtn>
            )}
            {phantomWallet ? (
              <MiniBtn onClick={disconnectPhantom}>
                {shortWallet(phantomWallet)}
              </MiniBtn>
            ) : (
              <MiniBtn tone="good" onClick={connectPhantom} disabled={connectingPhantom}>
                {connectingPhantom ? "Check Phantom" : "Connect Phantom"}
              </MiniBtn>
            )}
          </div>
        </div>
      </div>

      <div className="appShell">

        {screen === "HOME" && (
          <ScreenShell>
            <Card style={{ position: "relative", overflow: "hidden" }}>
              <div className="heroGlow" />
              <div className="heroTitle">Launch fast. Trade smooth. Earn rewards.</div>
              <div className="heroText">
                A premium mobile-first meme coin launchpad with creator rewards,
                affiliate rewards, and instant SOL-only trading.
              </div>

              <div className="heroActions">
                <MiniBtn tone="good" onClick={() => goScreen("CREATE")}>
                  Create Coin
                </MiniBtn>
                <MiniBtn onClick={() => goScreen("SEARCH")}>Explore Coins</MiniBtn>
                <button
                  className="ghostBtn"
                  onClick={() => goScreen("INFO")}
                >
                  Why Fun.Run
                </button>
              </div>
            </Card>

            <NativeFunRunAd />

            <Card>

{favoriteCoinIds.length > 0 && (
  <div style={{ marginBottom: 14 }}>
    <div
      style={{
        fontSize: 13,
        fontWeight: 900,
        marginBottom: 10,
        color: "var(--muted)",
      }}
    >
      ⭐ Favorites ({favoriteCoinIds.length})
    </div>

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {(coins || [])
        .filter((c) => favoriteCoinIds.includes(c.id))
        .slice(0, 10)
        .map((coin) => (
          <MiniBtn
            key={coin.id}
            onClick={() => openCoin(coin)}
          >
            <div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    lineHeight: 1.1,
  }}
>
  <span>{coin.symbol || coin.name}</span>

  <span
    style={{
      fontSize: 11,
      color: getCoin24hMovePct(coin) >= 0 ? "#22c55e" : "#ef4444",
      fontWeight: 900,
      marginTop: 3,
    }}
  >
    24h {getCoin24hMovePct(coin) >= 0 ? "+" : ""}
{getCoin24hMovePct(coin).toFixed(2)}%
  </span>
</div>
          </MiniBtn>
        ))}
    </div>
  </div>
)}
              
              <SectionHeader
                title="Feed"
                right={
                  <div className="tabs">
                    <button
                      className={`tabBtn ${homeFeedMode === "ALL" ? "active" : ""}`}
                      onClick={() => setHomeFeedMode("ALL")}
                    >
                      All
                    </button>
                    <button
                      className={`tabBtn ${homeFeedMode === "HOT" ? "active" : ""}`}
                      onClick={() => setHomeFeedMode("HOT")}
                    >
                      Hot 15m
                    </button>
                    <button
                      className={`tabBtn ${homeFeedMode === "LATEST" ? "active" : ""}`}
                      onClick={() => setHomeFeedMode("LATEST")}
                    >
                      Latest
                    </button>
                  </div>
                }
              />

              <div className="coinList">
                {(homeFeedMode === "HOT" ? hot15m : homeFeedMode === "LATEST" ? latestCoins : coins).length ? (
                  (homeFeedMode === "HOT" ? hot15m : homeFeedMode === "LATEST" ? latestCoins : coins).map((c) => (
                    <CoinMiniCard
                      key={c.id}
                      c={c}
                      subtitle={coinSubtitle(c)}
                      onOpen={() => openCoin(c)}
                    />
                  ))
                ) : (
                  <div className="miniMuted">No coins loaded yet.</div>
                )}
              </div>

              <div ref={coinsLoadMoreRef} style={{ height: 10 }} />
              {loadingCoins ? (
                <div className="miniMuted" style={{ marginTop: 10 }}>
                  Loading...
                </div>
              ) : null}
            </Card>

            <Card>
              <SectionHeader title="Trending by Volume" right={<Pill>{topVolume.length}</Pill>} />
              <div className="hScroll">
                {topVolume.map((c) => (
                  <div key={c.id} className="tinyCard">
                    <div className="row">
                      <CoinLogo c={c} size={42} radius={14} />
                      <div className="space">
                        <div style={{ fontWeight: 1000, fontSize: 13 }}>{c.name}</div>
                        <div className="miniMuted">{c.symbol} • {timeAgo(c.createdAt || c.created_at)}</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }} className="pillRow">
                      <Pill>MC {fmtUsd(c.mc || 0)}</Pill>
                      <Pill>{fmtSol(c.volumeSol || 0)} SOL</Pill>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <MiniBtn onClick={() => openCoin(c)} style={{ width: "100%" }}>
                        Open
                      </MiniBtn>
                    </div>
                  </div>
                ))}
              </div>
            </Card>




          </ScreenShell>
        )}

      {screen === "INFO" && (
  <ScreenShell>
    {renderBackButton()}

    <NativeFunRunAd compact />

    <Card>
      <Title sub="Why creators and traders choose Fun.Run">
        About Fun.Run
      </Title>

      <div
        style={{
          color: "var(--muted)",
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        Fun.Run is a mobile-first meme coin launchpad
        built for the Solana community. Create your coin
        in seconds, earn from every trade as the creator,
        and grow your network with 50% affiliate rewards.
        Built for speed, designed for fun.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "1fr"
            : "repeat(2, 1fr)",
          gap: 14,
          marginTop: 20,
        }}
      >
        {[
          {
            icon: "🚀",
            title: "Launch Fast",
            text: "Create your meme coin instantly with automated launch mechanics.",
          },

          {
            icon: "💰",
            title: "Earn Rewards",
            text: "Creators earn fees automatically from every buy and sell trade.",
          },

          {
            icon: "⚡",
            title: "50% Affiliate",
            text: "Invite users with your referral link and earn platform rewards.",
          },

          {
            icon: "📈",
            title: "Trade Early",
            text: "Discover and buy new meme coins before they trend.",
          },
        ].map((item) => (
          <div
            key={item.title}
            style={{
              position: "relative",
              overflow: "hidden",
              padding: 16,
              borderRadius: 22,
              border:
                "1px solid rgba(255,255,255,.08)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
              boxShadow:
                "0 10px 30px rgba(0,0,0,.24)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                borderRadius: "50%",
                background:
                  "rgba(120,255,214,.15)",
                filter: "blur(24px)",
              }}
            />

            <div
              style={{
                fontSize: 28,
                position: "relative",
                zIndex: 1,
              }}
            >
              {item.icon}
            </div>

            <div
              style={{
                marginTop: 10,
                fontWeight: 1000,
                fontSize: 15,
                position: "relative",
                zIndex: 1,
              }}
            >
              {item.title}
            </div>

            <div
              style={{
                marginTop: 6,
                color:
                  "rgba(238,248,255,.74)",
                fontSize: 13,
                lineHeight: 1.5,
                position: "relative",
                zIndex: 1,
              }}
            >
              {item.text}
            </div>
          </div>
        ))}
      </div>
    </Card>
  </ScreenShell>
)}

        {screen === "SEARCH" && (
          <ScreenShell>
            {renderBackButton()}

            <NativeFunRunAd compact />

            <Card>
              <Title sub="Find by name, symbol, or creator wallet">Search</Title>

              <div className="searchBox">
                <SearchIcon />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search coins..."
                />
              </div>

              <div className="tabs" style={{ marginTop: 12 }}>
                <button
                  className={`tabBtn ${searchMode === "SEARCH" ? "active" : ""}`}
                  onClick={() => setSearchMode("SEARCH")}
                >
                  Search
                </button>
                <button
                  className={`tabBtn ${searchMode === "VOLUME" ? "active" : ""}`}
                  onClick={() => setSearchMode("VOLUME")}
                >
                  Top Volume
                </button>
                <button
                  className={`tabBtn ${searchMode === "MOVES" ? "active" : ""}`}
                  onClick={() => setSearchMode("MOVES")}
                >
                  Top Moves
                </button>
              </div>

              <div className="coinList" style={{ marginTop: 14 }}>
                {searchMode === "SEARCH" &&
                  (filteredCoins.length ? (
                    filteredCoins.map((c) => (
                      <CoinMiniCard key={c.id} c={c} onOpen={() => openCoin(c)} />
                    ))
                  ) : (
                    <div className="miniMuted">No coins found.</div>
                  ))}

                {searchMode === "VOLUME" &&
                  topVolume.map((c) => (
                    <CoinMiniCard key={c.id} c={c} onOpen={() => openCoin(c)} />
                  ))}

                {searchMode === "MOVES" &&
                  topMoves20.map(({ c, pct }) => (
                    <CoinMiniCard
                      key={c.id}
                      c={c}
                      subtitle={`MC ${fmtUsd(c?.mc || 0)} • ${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`}
                      onOpen={() => openCoin(c)}
                    />
                  ))}
              </div>
            </Card>
          </ScreenShell>
        )}

        {screen === "CREATE" && (
          <ScreenShell>
            {renderBackButton()}

            <NativeFunRunAd compact />

            <Card
              style={{
                background: `
                  radial-gradient(circle at 18% 12%, rgba(99,245,200,.22), transparent 34%),
                  radial-gradient(circle at 86% 24%, rgba(124,203,255,.18), transparent 38%),
                  radial-gradient(circle at 50% 100%, rgba(167,139,250,.16), transparent 42%),
                  linear-gradient(145deg, rgba(8,32,42,.82), rgba(14,20,42,.72))
                `,
                border: "1px solid rgba(99,245,200,.22)",
                boxShadow: "0 24px 80px rgba(0,0,0,.34), 0 0 46px rgba(99,245,200,.12), inset 0 1px 0 rgba(255,255,255,.10)",
              }}
            >
              <Title sub="Launch your coin with optional first buy">Create Coin</Title>

              <div style={{ display: "grid", gap: 13 }}>
                <Input
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="Token name"
                  style={{ background: "rgba(255,255,255,.055)", border: "1px solid rgba(99,245,200,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}
                />

                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="Symbol"
                  style={{ background: "rgba(255,255,255,.055)", border: "1px solid rgba(124,203,255,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}
                />

                <Input
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  placeholder="Story / description"
                  textarea
                  rows={5}
                  style={{ background: "rgba(255,255,255,.055)", border: "1px solid rgba(167,139,250,.20)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}
                />

                <Input
                  value={initialSol}
                  onChange={(e) => setInitialSol(e.target.value)}
                  placeholder="Initial buy (SOL)"
                  type="number"
                  style={{ background: "rgba(255,255,255,.055)", border: "1px solid rgba(99,245,200,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}
                />

                <div
                  style={{
                    padding: 12,
                    borderRadius: 18,
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "linear-gradient(135deg, rgba(99,245,200,.10), rgba(124,203,255,.08))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)",
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(238,248,255,.78)", marginBottom: 8, fontWeight: 900 }}>
                    Logo
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLogoPick(e.target.files?.[0])}
                    style={{ width: "100%", color: "var(--text)", fontSize: 12 }}
                  />

                  {logoPreview ? (
                    <div style={{ marginTop: 12 }}>
                      <CoinLogo c={{ logo: logoPreview, symbol }} size={80} radius={18} />
                    </div>
                  ) : null}
                </div>

                <PrimaryButton
                  disabled={creating}
                  onClick={handleCreateCoin}
                  style={{
                    background: "linear-gradient(135deg, #63F5C8 0%, #7CCBFF 55%, #A78BFA 100%)",
                    boxShadow: "0 18px 46px rgba(99,245,200,.28), 0 0 34px rgba(124,203,255,.16), inset 0 1px 0 rgba(255,255,255,.35)",
                  }}
                >
                  {creating ? "Creating..." : "Create Coin"}
                </PrimaryButton>
              </div>
            </Card>
          </ScreenShell>
        )}

        {screen === "COIN" && (
          <ScreenShell>
            {renderBackButton()}

            {!selectedCoin ? (
              <Card>
                <div className="miniMuted">Select a coin first.</div>
              </Card>
            ) : (
              <>
                <Card>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
                    <CoinLogo c={selectedCoin} size={72} radius={20} />

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 24, fontWeight: 1000, lineHeight: 1.05 }}>
                        {selectedCoin.name}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
                        {selectedCoin.symbol}
                      </div>

                      <div className="pillRow" style={{ marginTop: 10 }}>
                        <Pill>MC {fmtUsd(selectedCoin.mc || 0)}</Pill>
                        <Pill>ATH {fmtUsd(selectedCoin.ath || 0)}</Pill>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 8, width: isMobile ? "100%" : 190 }}>
                      <MiniBtn onClick={() => openCreatorFromCoin(selectedCoin)}>
                        Creator Profile
                      </MiniBtn>

<MiniBtn
  onClick={() => toggleFavoriteCoin(selectedCoin?.id)}
>
  <span
  style={{
    color: favoriteCoinIds.includes(selectedCoin?.id)
      ? "#22c55e"
      : undefined,
    fontWeight: 900,
  }}
>
  {favoriteCoinIds.includes(selectedCoin?.id)
    ? "★ Remove Favorite"
    : "☆ Add Favorite"}
</span>

</MiniBtn>

                      <MiniBtn
                        onClick={async () => {
                          const ok = await copyText(selectedCoin?.id || "");
                          setToast(ok ? "Coin address copied" : "Copy failed");
                        }}
                      >
                        Copy Coin Address
                      </MiniBtn>

                      {isSelectedCoinCreator ? (
                        <MiniBtn tone="good" onClick={() => setDexModalOpen(true)}>
                          Launch to DEX
                        </MiniBtn>
                      ) : null}
                    </div>
                  </div>

                  {selectedCoin.story ? (
                    <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
                      {selectedCoin.story}
                    </div>
                  ) : null}

                  <PriceChart
                    coin={selectedCoin}
                    height={isMobile ? 300 : 420}
                    chartRange={chartRange}
                    setChartRange={setChartRange}
                    isMobile={isMobile}
                    reloadKey={chartReloadKey}
                  />
                </Card>

                <Card>
                  <SectionHeader title="Trade" sub="Instant swap • SOL only" />
                  <div className="tabs" style={{ marginBottom: 12 }}>
                    <button
                      className={`tabBtn ${tradeMode === "BUY" ? "active" : ""}`}
                      onClick={() => setTradeMode("BUY")}
                    >
                      Buy
                    </button>
                    <button
                      className={`tabBtn ${tradeMode === "SELL" ? "active" : ""}`}
                      onClick={() => setTradeMode("SELL")}
                    >
                      Sell
                    </button>
                  </div>

                  <div className="statsGrid" style={{ marginTop: 0, marginBottom: 12 }}>
                    <div className="stat">
                      <div className="statLabel">Coin Reward</div>
                      <div className="statValue">{fmtSol(selectedCoin?.creatorRewardsSol || 0)} SOL</div>
                    </div>

                    <div className="stat">
                      <div className="statLabel">Your Tokens</div>
                      <div className="statValue">{fmtNum(currentWalletTokens, 0)}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <Input
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)}
                      placeholder={tradeMode === "BUY" ? "SOL to spend" : "Sell token amount"}
                      type="number"
                      rightLabel={tradeMode === "SELL" ? "ALL" : undefined}
                      onRightLabelClick={() => {
                        if (tradeMode === "SELL" && selectedCoin && solAddr) {
                          const allTokens = Math.max(0, currentWalletTokens);
                          setTradeAmount(allTokens > 0 ? String(Math.floor(allTokens)) : "");
                        }
                      }}
                    />

                    {tradePreview.ok ? (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,.08)",
                          background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.025))",
                        }}
                      >
                        <div style={{ fontSize: 12, color: "var(--muted2)", marginBottom: 8 }}>
                          {tradeMode === "BUY" ? "Estimated receive" : "Tokens required for this sell"}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 1000 }}>
                          {fmtNum(tradePreview.estTokens, 0)} tokens
                        </div>
                      </div>
                    ) : (
                      <div className="miniMuted">
                        {tradeMode === "BUY"
                          ? "Enter SOL to see estimated tokens."
                          : "Enter token amount to see estimated SOL out."}
                      </div>
                    )}

                    <PrimaryButton disabled={trading} onClick={handleTrade}>
                      {trading
                        ? tradeMode === "BUY"
                          ? "Buying..."
                          : "Selling..."
                        : tradeMode === "BUY"
                        ? "Buy Now"
                        : "Sell Now"}
                    </PrimaryButton>
                  </div>
                </Card>

                <Card>
                  <SectionHeader
                    title="Holders / Activity"
                    right={<Pill>{recentCoinActivity.length || Object.keys(selectedCoin.holders || {}).length}</Pill>}
                  />

                  <div className="scrollY">
                    {recentCoinActivity.length > 0 ? (
                      recentCoinActivity.map((tx, idx) => (
                        <div
                          key={tx.id || idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "11px 0",
                            borderBottom: "1px solid rgba(255,255,255,.06)",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900, fontSize: 13 }}>
                              {shortWallet(tx.wallet || solAddr)} • {String(tx.type || tx.side || "TX").toUpperCase()}
                            </div>
                            <div className="miniMuted">{timeAgo(tx.ts || tx.t)}</div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 900, fontSize: 13 }}>
                              {fmtNum(tx.tokens || 0, 0)} tokens
                            </div>
                            <div className="miniMuted">{fmtSol(tx.sol || 0)} SOL</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      Object.entries(selectedCoin.holders || {})
                        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
                        .slice(0, 50)
                        .map(([wallet, amount]) => {
                          const pct =
                            selectedCoin.totalSupply > 0
                              ? (Number(amount || 0) / Number(selectedCoin.totalSupply || 1)) * 100
                              : 0;

                          return (
                            <div
                              key={wallet}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                padding: "11px 0",
                                borderBottom: "1px solid rgba(255,255,255,.06)",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 900, fontSize: 13 }}>
                                  {shortWallet(wallet)}
                                </div>
                                <div className="miniMuted">{pct.toFixed(4)}% supply</div>
                              </div>

                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: 900, fontSize: 13 }}>
                                  {fmtNum(amount, 0)}
                                </div>
                                <div className="miniMuted">tokens</div>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </Card>
              </>
            )}
          </ScreenShell>
        )}

        {screen === "CREATOR" && (
          <ScreenShell>
            {renderBackButton()}

            <NativeFunRunAd compact />

            <Card>
              <Title sub="Creator profile, rewards and holdings">
                Creator Profile
              </Title>

              <div className="statsGrid" style={{ marginTop: 0 }}>
                <div className="stat">
                  <div className="statLabel">This Coin Reward</div>
                  <div className="statValue">
                    {fmtSol(
                      creatorCoin && String(creatorCoin?.creatorWallet || "") === String(creatorProfileId || creatorCoin?.creatorWallet || "")
                        ? creatorCoin?.creatorRewardsSol || 0
                        : 0
                    )} SOL
                  </div>
                </div>

                <div className="stat">
                  <div className="statLabel">Lifetime All Coins Reward</div>
                  <div className="statValue">{fmtSol(creatorRewards || 0)} SOL</div>
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader title="Created Coins" right={<Pill>{creatorCoins.length}</Pill>} />
              <div className="scrollY">
                {creatorCoins.length === 0 ? (
                  <div className="miniMuted">No created coins found.</div>
                ) : (
                  creatorCoins.map((coin) => (
                    <button
                      key={coin.id}
                      onClick={() => openCoin(coin)}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,.08)",
                        background: "rgba(255,255,255,.03)",
                        color: "var(--text)",
                        textAlign: "left",
                        cursor: "pointer",
                        marginBottom: 10,
                      }}
                    >
                      <div className="coinRow">
                        <CoinLogo c={coin} size={44} radius={15} />
                        <div className="coinText">
                          <div className="coinName">{coin.name}</div>
                          <div className="coinMeta">
                            Reward {fmtSol(coin.creatorRewardsSol || 0)} SOL • {timeAgo(coin.createdAt || coin.created_at)}
                          </div>
                        </div>
                        <div className="rightNum">
                          <div className="rightNumMain">{fmtUsd(coin.mc || 0)}</div>
                          <div className="rightNumSub">MC</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader title="Creator Holdings" right={<Pill>{creatorHoldings.length}</Pill>} />
              <div
                className="creatorScroll"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  maxHeight: 320,
                  overflowY: "auto",
                  paddingRight: 4,
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {creatorHoldings.length === 0 ? (
                  <div style={{ color: "var(--muted2)", fontSize: 13 }}>No holdings found.</div>
                ) : (
                  creatorHoldings.map(({ coin, amt, pct }) => (
                    <button
                      key={coin.id}
                      onClick={() => {
                        setSelectedCoinId(coin.id);
                        setScreen("COIN");
                      }}
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,.08)",
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
                        color: "var(--text)",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 1000 }}>{coin.name}</div>
                          <div style={{ color: "var(--muted2)", fontSize: 12 }}>
                            {fmtNum(amt, 0)} tokens
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 1000 }}>{pct.toFixed(4)}%</div>
                          <div style={{ color: "var(--muted2)", fontSize: 12 }}>Supply</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </ScreenShell>
        )}

        

        {screen === "PROFILE" && (
          <ScreenShell>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              {renderBackButton()}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: 999,
                    background: "linear-gradient(135deg, rgba(99,245,200,.16), rgba(124,203,255,.10))",
                    border: "1px solid rgba(99,245,200,.22)",
                    color: "var(--text)",
                    fontSize: 12,
                    fontWeight: 1000,
                    lineHeight: 1,
                  }}
                >
                  Affiliates: {profile?.referralCount || 0}
                </div>

                <MiniBtn
                  tone="good"
                  onClick={async () => {
                    const ok = await copyText(solAddr ? getReferralLink(solAddr) : "");
                    setToast(ok ? "Affiliate link copied" : "Copy failed");
                  }}
                  style={{ padding: "9px 12px", borderRadius: 999 }}
                >
                  Copy Affiliate Link
                </MiniBtn>
              </div>
            </div>

            <NativeFunRunAd compact />

            <Card>
              <Title sub="Wallet, creator income and affiliate earnings">Profile</Title>

              <div className="statsGrid">

                
                <div
                  className="stat"
                  style={{
                    gridColumn: "span 2",
                    minHeight: 210,
                    padding: 16,
                    position: "relative",
                    overflow: "hidden",
                    textAlign: "center",
                    background:
                      "radial-gradient(circle at 12% 0%, rgba(99,245,200,.40), transparent 35%), radial-gradient(circle at 96% 18%, rgba(124,203,255,.36), transparent 38%), linear-gradient(135deg, rgba(10,55,55,.96), rgba(10,25,62,.92))",
                    border: "1px solid rgba(99,245,200,.30)",
                    boxShadow:
                      "0 18px 42px rgba(0,0,0,.26), 0 0 30px rgba(99,245,200,.16), inset 0 1px 0 rgba(255,255,255,.12)",
                  }}
                >
<div
  style={{
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    background:
      "linear-gradient(135deg, rgba(99,245,200,.18), rgba(124,203,255,.12))",
    border: "1px solid rgba(99,245,200,.25)",
  }}
>
  <div className="statLabel">Portfolio Value</div>

  <div
    style={{
      fontSize: 28,
      fontWeight: 1000,
      marginTop: 4,
    }}
  >
    {fmtUsd(portfolioWalletUsd + portfolioHoldingsUsd)}
  </div>

  
</div>



                  <div className="statLabel">Main Wallet</div>
                  <div className="statValue">{fmtSol(walletSolBalance)} SOL</div>
                  <div className="miniMuted" style={{ marginTop: 6 }}>
                    {toUsdFromSol(walletSolBalance)}
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                 

    <span
  style={{
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 120,
  }}
>
  {(() => {

    
    
    const walletAddress =
  profile?.wallet ||
  profile?.wallet_address ||
  profile?.custodialWallet ||
  profile?.depositAddress;




return walletAddress
  ? `${String(walletAddress).slice(0, 4)}...${String(walletAddress).slice(-4)}`
  : "No wallet";
  })()}
</span>
                    

                    <div style={{ display: "flex", gap: 6 }}>
                      <MiniBtn



          onClick={() => {
  navigator.clipboard.writeText(
    profile?.wallet
  );

  setToast("Deposit address copied");
}}





                        style={{
                          padding: "7px 12px",
                          width: "auto",
                          background: "linear-gradient(135deg, rgba(99,245,200,.95), rgba(124,203,255,.92))",
                          color: "#03131A",
                          border: "1px solid rgba(255,255,255,.20)",
                          boxShadow: "0 8px 18px rgba(99,245,200,.20)",
                        }}
                      >
                        Deposit
                      </MiniBtn>

                      <MiniBtn
                        onClick={() => {
                          navigator.clipboard.writeText(
  profile?.wallet
);
                          setToast("Wallet copied");
                        }}
                        style={{
                          padding: "7px 12px",
                          width: "auto",
                          background: "linear-gradient(135deg, rgba(255,255,255,.14), rgba(255,255,255,.06))",
                          border: "1px solid rgba(255,255,255,.18)",
                          boxShadow: "0 8px 18px rgba(124,203,255,.12)",
                        }}
                      >
                        Copy
                      </MiniBtn>
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <MiniBtn
                      onClick={() => setWithdrawOpen(true)}
                      style={{
                        width: "100%",
                        background: "linear-gradient(135deg, rgba(99,245,200,.22), rgba(124,203,255,.18))",
                        border: "1px solid rgba(99,245,200,.28)",
                        boxShadow: "0 12px 24px rgba(99,245,200,.14)",
                      }}
                    >
                      Withdraw
                    </MiniBtn>
                  </div>
                </div>

                <div
  className="stat"
  style={{

    gridColumn: "span 2",
    minHeight: 190,
    padding: 18,
    position: "relative",
    overflow: "hidden",
    background:
      "radial-gradient(circle at 15% 0%, rgba(99,245,200,.25), transparent 36%), radial-gradient(circle at 100% 100%, rgba(124,203,255,.25), transparent 44%), linear-gradient(135deg, rgba(8,32,56,.96), rgba(5,20,40,.95))",
    border: "1px solid rgba(99,245,200,.25)",
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 20,
    }}
  >
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "var(--muted)",
        }}
      >
        RUN REWARDS
      </div>

      <div
        style={{
          fontSize: 34,
          fontWeight: 1000,
          marginTop: 6,
        }}
      >
        {fmtUsd((profile?.run_balance || 700000) * 0.000002)}
      </div>

      <div
        style={{
          marginTop: 6,
          color: "#63F5C8",
          fontWeight: 900,
        }}
      >
        {(profile?.run_balance || 700000).toLocaleString()} RUN
      </div>

      <div
  style={{
    marginTop: 6,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(124,203,255,.06)",
    border: "1px solid rgba(124,203,255,.10)",
    fontSize: 12,
    color: "#7CCBFF",
    fontWeight: 800,
  }}
>
  👥 Referral: {Math.max(0, (profile?.run_balance || 700000) - 700000).toLocaleString()} RUN
</div>

      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          opacity: 0.8,
        }}
      >
        Unlocks on 01 Jan 2027
      </div>
    </div>



    <div
      style={{
        width: 85,
        height: 85,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 25% 20%, #F5F5F5 0%, #D8D8D8 20%, #B8B8B8 45%, #8F8F8F 75%, #6A6A6A 100%)",
        border: "5px solid rgba(255,255,255,.28)",
        outline: "2px solid rgba(255,215,0,.65)",
        outlineOffset: "-8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        fontWeight: 800,
        color: "#2B2B2B",
        letterSpacing: 1,
        textShadow: "0 1px 2px rgba(255,255,255,.35)",
        boxShadow:
          "0 0 6px rgba(255,255,255,.08), inset 0 1px 3px rgba(255,255,255,.12), inset 0 -2px 4px rgba(0,0,0,.12)",
        animation: "flipRunCoin 10s ease-in-out infinite",
        willChange: "transform",
        transformStyle: "preserve-3d",
      }}
    >
      <span style={{ position: "absolute", backfaceVisibility: "hidden" }}>
        RUN
      </span>
      <span
        style={{
          position: "absolute",
          transform: "rotateY(180deg)",
          backfaceVisibility: "hidden",
        }}
      >
        RUN
      </span>
    </div>
  




    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--muted)",
          marginBottom: 6,
        }}
      >
        Unlock Countdown
      </div>

      <div
  style={{
    fontSize: 24,
    fontWeight: 1000,
    color: "#7CCBFF",
    lineHeight: 1.4,
  }}
>
  {unlockDays}d {unlockHours}h
  <br />
  {unlockMinutes}m {unlockSeconds}s
</div>
    </div>
  </div>
</div>

                <div
                  className="stat"
                  style={{
                    gridColumn: "span 2",
                    minHeight: 158,
                    padding: 14,
                    textAlign: "left",
                    position: "relative",
                    overflow: "hidden",
                    background:
                      "radial-gradient(circle at 18% 0%, rgba(99,245,200,.38), transparent 38%), radial-gradient(circle at 100% 100%, rgba(124,203,255,.28), transparent 42%), linear-gradient(135deg, rgba(12,52,50,.92), rgba(6,30,47,.88))",
                    border: "1px solid rgba(99,245,200,.42)",
                    boxShadow:
                      "0 18px 44px rgba(0,0,0,.32), 0 0 28px rgba(99,245,200,.18), inset 0 1px 0 rgba(255,255,255,.14)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      right: -34,
                      top: -34,
                      width: 108,
                      height: 108,
                      borderRadius: 999,
                      background: "rgba(99,245,200,.16)",
                      filter: "blur(2px)",
                    }}
                  />

                  <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div className="statLabel" style={{ color: "rgba(228,255,248,.78)", fontWeight: 1000 }}>
                        Affiliate Reward
                      </div>
                      <div style={{ marginTop: 5, fontSize: 10, color: "rgba(228,255,248,.72)", fontWeight: 1000 }}>
                        Earn 50% from your link
                      </div>
                    </div>
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 1000,
                        color: "#022018",
                        background: "linear-gradient(135deg, #63F5C8, #7CCBFF)",
                        boxShadow: "0 0 18px rgba(99,245,200,.45)",
                      }}
                    >
                      50%
                    </span>
                  </div>
<div className="statValue" style={{ position: "relative", zIndex: 1, fontSize: 19, color: "#FFFFFF", textShadow: "0 0 18px rgba(99,245,200,.35)" }}>
  {fmtSol(profile?.referralRewardsSol || 0)} SOL
</div>

<div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 11 }}>
  <MiniBtn

    onClick={() => handleClaim("REF")}
    style={{
      padding: "8px 8px",
      borderRadius: 13,
      color: "#03110D",
      background: "linear-gradient(135deg, #63F5C8, #7CCBFF)",
      border: "1px solid rgba(255,255,255,.20)",
      boxShadow: "0 10px 22px rgba(99,245,200,.24)",
    }}


  >
    Claim
  </MiniBtn>

  

  <MiniBtn
    onClick={async () => {
      const ok = await copyText(solAddr ? getReferralLink(solAddr) : "");
      setToast(ok ? "Affiliate link copied" : "Copy failed");
    }}
    style={{
      padding: "8px 8px",
      borderRadius: 13,
      color: "#FFFFFF",
      background: "linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.06))",
      border: "1px solid rgba(255,255,255,.18)",
      boxShadow: "0 10px 22px rgba(0,0,0,.18)",
    }}
                    >
                      Share
                    </MiniBtn>
                  </div>
                </div>

                <div
                  className="stat"
                  style={{
                    gridColumn: "span 2",
                    minHeight: 158,
                    padding: 14,
                    position: "relative",
                    overflow: "hidden",
                    background:
                      "radial-gradient(circle at 20% 0%, rgba(255,143,177,.34), transparent 38%), radial-gradient(circle at 100% 100%, rgba(167,139,250,.32), transparent 42%), linear-gradient(135deg, rgba(51,20,57,.92), rgba(22,22,58,.88))",
                    border: "1px solid rgba(255,143,177,.36)",
                    boxShadow:
                      "0 18px 44px rgba(0,0,0,.32), 0 0 28px rgba(167,139,250,.18), inset 0 1px 0 rgba(255,255,255,.14)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: -34,
                      bottom: -34,
                      width: 112,
                      height: 112,
                      borderRadius: 999,
                      background: "rgba(167,139,250,.15)",
                      filter: "blur(2px)",
                    }}
                  />
                  <div className="statLabel" style={{ position: "relative", zIndex: 1, color: "rgba(255,236,247,.76)", fontWeight: 1000 }}>
                    Creator Reward
                  </div>
                  <div className="statValue" style={{ position: "relative", zIndex: 1, fontSize: 19, color: "#FFFFFF", textShadow: "0 0 18px rgba(255,143,177,.32)" }}>
                    {fmtSol(profile?.creatorRewardsSol || creatorRewards || 0)} SOL
                  </div>
                  <div style={{ position: "relative", zIndex: 1, marginTop: 11, display: "flex", justifyContent: "center" }}>
                    <MiniBtn
                      onClick={() => handleClaim("CREATOR")}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 13,
                        color: "#FFFFFF",
                        background: "linear-gradient(135deg, #FF8FB1, #A78BFA)",
                        border: "1px solid rgba(255,255,255,.20)",
                        boxShadow: "0 10px 22px rgba(167,139,250,.25)",
                      }}
                    >
                      Claim
                    </MiniBtn>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader title="My Creations" right={<Pill>{myCreations.length}</Pill>} />
              <div className="scrollY">
                {myCreations.length === 0 ? (
                  <div className="miniMuted">No created coins.</div>
                ) : (
                  myCreations.map((coin) => (
                    <div key={coin.id} style={{ marginBottom: 10 }}>
                      <CoinMiniCard c={coin} onOpen={() => openCoin(coin)} />
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader title="Open Positions" right={<Pill>{profileHoldings.length}</Pill>} />

<div
  style={{
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(99,245,200,.08)",
    border: "1px solid rgba(99,245,200,.18)",
  }}
>
  <div className="miniMuted">Total Holdings Value</div>
  <div
    style={{
      fontSize: 22,
      fontWeight: 1000,
      marginTop: 4,
    }}
  >
    {fmtUsd(portfolioHoldingsUsd)}
  </div>
</div>



              <div className="scrollY">
                {profileHoldings.length === 0 ? (
                  <div className="miniMuted">No holdings yet.</div>
                ) : (
                  profileHoldings.map((h, idx) => {
                    const coin =
                      (coins || []).find((x) => String(x.id) === String(h.coinId || h.id || h.coin?.id)) ||
                      normalizeCoin({
                        id: h.coinId || h.id || h.coin?.id || `holding-${idx}`,
                        name: h.name || h.coin?.name || h.symbol || "Unknown coin",
                        symbol: h.symbol || h.coin?.symbol || "??",
                        logo: h.logo || h.coin?.logo || "",
                      });
                    const amt = Math.max(0, safeNum(h.amount, h.tokens || h.balance || 0));
                    const pct = coin?.totalSupply ? (amt / Math.max(1, safeNum(coin.totalSupply, 1))) * 100 : 0;
                    const holdingUsd = amt * getCoinPriceUsd(coin);
                    const allocationPct = portfolioHoldingsUsd > 0 ? (holdingUsd / portfolioHoldingsUsd) * 100 : 0;
                    const coinTxs = (profileTxs || []).filter(
  (tx) => String(tx.coinId) === String(coin.id)
);

const totalBuySol = coinTxs
  .filter((tx) => tx.side === "BUY")
  .reduce((sum, tx) => sum + Number(tx.sol || 0), 0);

const totalSellSol = coinTxs
  .filter((tx) => tx.side === "SELL")
  .reduce((sum, tx) => sum + Number(tx.sol || 0), 0);

const pnlUsd = holdingUsd - ((totalBuySol - totalSellSol) * 80);
                    return (
                      <ProfileCoinRow
                        key={`${h.coinId || coin?.id || idx}`}
                        coin={coin}
                        
                        secondary={`${fmtNum(amt, 0)} tokens`}
                        rightMain={fmtUsd(holdingUsd)}
                        rightSub={`${allocationPct.toFixed(1)}% • ${pnlUsd >= 0 ? "+" : ""}${fmtUsd(pnlUsd)}`}
                        onClick={coin ? () => openCoin(coin) : undefined}
                      />
                    );
                  })
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader title="Last Transactions" right={<Pill>{profileTxs.length}</Pill>} />
              <div className="scrollY">
                {profileTxs.length === 0 ? (
                  <div className="miniMuted">No recent activity.</div>
                ) : (
                  profileTxs.map((tx, idx) => {
                    const txCoin =
                      (coins || []).find((x) => String(x.id) === String(tx.coinId || tx.id || tx.coin?.id)) ||
                      normalizeCoin({
                        id: tx.coinId || tx.id || `tx-${idx}`,
                        name: tx.coinName || tx.name || tx.symbol || "Unknown coin",
                        symbol: tx.symbol || tx.coin?.symbol || "??",
                        logo: tx.logo || tx.coin?.logo || "",
                      });

                    return (
                      <div
                        key={tx.id || idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "11px 0",
                          borderBottom: "1px solid rgba(255,255,255,.06)",
                        }}
                      >
                        <div className="coinRow" style={{ minWidth: 0, flex: 1 }}>
                          <CoinLogo c={txCoin} size={42} radius={14} />
                          <div className="coinText">
                            <div className="coinName">
                              {String(tx.type || tx.side || "TRADE").toUpperCase()}
                            </div>
                            <div className="coinMeta">
                              {txCoin?.name || shortWallet(tx.wallet || solAddr)}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 900, fontSize: 13 }}>{fmtSol(tx.sol || 0)} SOL</div>
                          <div className="miniMuted">{fmtNum(tx.tokens || 0, 0)} tokens</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

<Card>
  <SectionHeader
    title="Wallet History"
    right={<Pill>{walletHistory.length}</Pill>}
  />

  <div className="scrollY">
    {walletHistory.length === 0 ? (
      <div style={{ color: "var(--muted2)", fontSize: 13 }}>
        No wallet history yet.
      </div>
    ) : (
      walletHistory.slice(0, 50).map((item, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "12px 0",
            borderBottom: "1px solid rgba(255,255,255,.06)",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 1000,
                color:
                  item.type === "DEPOSIT"
                    ? "#63F5C8"
                    : "#FF8A8A",
              }}
            >
              {item.type}
            </div>

            <div className="miniMuted">
              {new Date(item.createdAt).toLocaleString()}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 1000 }}>
              {fmtSol(item.amount)} SOL
            </div>

            <div className="miniMuted">
              {String(item.txHash || "").slice(0, 8)}...
            </div>

<MiniBtn
  onClick={async () => {
    const ok = await copyText(item.txHash || "");
    setToast(ok ? "TX Hash copied" : "Copy failed");
  }}
  style={{
    marginTop: 4,
    padding: "4px 10px",
    minHeight: 28,
    fontSize: 11,
  }}
>
  Copy
</MiniBtn>

          </div>
        </div>
      ))
    )}
  </div>
</Card>

          </ScreenShell>
        )}

        {screen === "SETTINGS" && (
          <ScreenShell>
            {renderBackButton()}

            <Card>
              <Title sub="Theme, appearance and quick actions">Settings</Title>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted2)", marginBottom: 10 }}>
                    Profile Logo
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 18,
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,.10)",
                        background: "rgba(255,255,255,.04)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <img
                        src={profileAvatar}
                        alt="profile avatar"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <label
                      style={{
                        padding: "10px 14px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,.10)",
                        background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.025))",
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Upload From Gallery
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > MAX_LOGO_BYTES) {
                            setToast("Logo too large");
                            return;
                          }
                          try {
                            const data = await fileToDataUrl(file);
                            setProfileAvatar(data);
                            setToast("Profile logo updated");
                          } catch {
                            setToast("Image read failed");
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    {PROFILE_PRESET_LOGOS.map((logo, idx) => (
                      <button
                        key={logo}
                        onClick={() => {
                          setProfileAvatar(logo);
                          setToast("Profile logo selected");
                        }}
                        style={{
                          height: 78,
                          borderRadius: 18,
                          overflow: "hidden",
                          border:
                            profileAvatar === logo
                              ? "1px solid rgba(50,230,255,.42)"
                              : "1px solid rgba(255,255,255,.08)",
                          background: "rgba(255,255,255,.03)",
                          padding: 0,
                          cursor: "pointer",
                        }}
                      >
                        <img
                          src={logo}
                          alt={`preset ${idx + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hr" />

                <div>
                  <div style={{ fontSize: 12, color: "var(--muted2)", marginBottom: 10 }}>
                    Theme
                  </div>

                  <div className="themeGrid">
                    <ThemeOption theme="calm" current={theme} setTheme={setTheme} label="Obsidian" />
                    <ThemeOption theme="neon" current={theme} setTheme={setTheme} label="Deep Blue" />
                    <ThemeOption theme="ocean" current={theme} setTheme={setTheme} label="Ocean Glass" />
                    <ThemeOption theme="rose" current={theme} setTheme={setTheme} label="Velvet Rose" />
                    <ThemeOption theme="royal" current={theme} setTheme={setTheme} label="Royal Night" />
                  </div>
                </div>

                <div className="hr" />

                <div style={{ display: "grid", gap: 10 }}>
                  <MiniBtn
                    onClick={async () => {
                      if (!solAddr) {
                        setToast("No wallet connected");
                        return;
                      }
                      const ok = await copyText(solAddr);
                      setToast(ok ? "Wallet copied" : "Copy failed");
                    }}
                  >
                    Copy Wallet Address
                  </MiniBtn>

                  <MiniBtn
                    onClick={async () => {
                      if (!solAddr) {
                        setToast("No wallet connected");
                        return;
                      }
                      const ok = await copyText(getReferralLink(solAddr));
                      setToast(ok ? "Referral link copied" : "Copy failed");
                    }}
                  >
                    Copy Referral Link
                  </MiniBtn>

                  <MiniBtn
                    onClick={async () => {
                      try {
                        await exportWallet?.();
                        setToast("Wallet export opened");
                      } catch (e) {
                        setToast(e?.message || "Export failed");
                      }
                    }}
                  >
                    Export Wallet
                  </MiniBtn>

                  {phantomWallet ? (
                    <MiniBtn tone="danger" onClick={disconnectPhantom}>
                      Disconnect Phantom
                    </MiniBtn>
                  ) : null}

                  {authenticated ? (
                    <MiniBtn
                      tone="danger"
                      onClick={async () => {
                        try {
                          await logout?.();
                          setToast("Google logged out");
                          goScreen("HOME");
                        } catch (e) {
                          setToast(e?.message || "Logout failed");
                        }
                      }}
                    >
                      Google Logout
                    </MiniBtn>
                  ) : null}
                </div>
              </div>
            </Card>
          </ScreenShell>
        )}
      </div>

      <div className="footerNav">
        <button
          className={`footerBtn ${screen === "HOME" ? "active" : ""}`}
          onClick={() => goScreen("HOME")}
        >
          <div style={{ display: "grid", placeItems: "center", gap: 6 }}>
            <HomeIcon />
            <span>Home</span>
          </div>
        </button>

        <button
          className={`footerBtn ${screen === "SEARCH" ? "active" : ""}`}
          onClick={() => goScreen("SEARCH")}
        >
          <div style={{ display: "grid", placeItems: "center", gap: 6 }}>
            <SearchIcon />
            <span>Search</span>
          </div>
        </button>

        <button
          className={`footerBtn ${screen === "CREATE" ? "active" : ""}`}
          onClick={() => goScreen("CREATE")}
        >
          <div style={{ display: "grid", placeItems: "center", gap: 6 }}>
            <PlusIcon />
            <span>Create</span>
          </div>
        </button>

        <button
          className={`footerBtn ${screen === "PROFILE" ? "active" : ""}`}
          onClick={() => goScreen("PROFILE")}
        >
          <div style={{ display: "grid", placeItems: "center", gap: 6 }}>
            <UserIcon />
            <span>Profile</span>
          </div>
        </button>

        <button
          className={`footerBtn ${screen === "SETTINGS" ? "active" : ""}`}
          onClick={() => goScreen("SETTINGS")}
        >
          <div style={{ display: "grid", placeItems: "center", gap: 6 }}>
            <CogIcon />
            <span>Settings</span>
          </div>
        </button>
      </div>

      {settingsOpen ? (
        <div className="modalBack" onClick={() => setSettingsOpen(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div className="modalTitle">Quick Settings</div>
              <MiniBtn onClick={() => setSettingsOpen(false)}>Close</MiniBtn>
            </div>

            <div className="modalBody">
              <div className="themeGrid">
                <ThemeOption theme="calm" current={theme} setTheme={setTheme} label="Obsidian" />
                <ThemeOption theme="neon" current={theme} setTheme={setTheme} label="Deep Blue" />
                <ThemeOption theme="ocean" current={theme} setTheme={setTheme} label="Ocean Glass" />
                <ThemeOption theme="rose" current={theme} setTheme={setTheme} label="Velvet Rose" />
                <ThemeOption theme="royal" current={theme} setTheme={setTheme} label="Royal Night" />
              </div>

              <div className="hr" />

              <div style={{ display: "grid", gap: 10 }}>
                <MiniBtn
                  onClick={async () => {
                    if (!solAddr) {
                      setToast("No wallet connected");
                      return;
                    }
                    const ok = await copyText(solAddr);
                    setToast(ok ? "Wallet copied" : "Copy failed");
                  }}
                >
                  Copy Wallet
                </MiniBtn>

                <MiniBtn
                  onClick={async () => {
                    if (!solAddr) {
                      setToast("No wallet connected");
                      return;
                    }
                    const ok = await copyText(getReferralLink(solAddr));
                    setToast(ok ? "Referral link copied" : "Copy failed");
                  }}
                >
                  Copy Referral Link
                </MiniBtn>

                {!authenticated ? (
                  <MiniBtn
                    tone="good"
                    onClick={async () => {
                      try {
                        if (ready) await login?.();
                        setSettingsOpen(false);
                      } catch (e) {
                        setToast(e?.message || "Google login failed");
                      }
                    }}
                  >
                    Google Login
                  </MiniBtn>
                ) : (
                  <MiniBtn
                    tone="danger"
                    onClick={async () => {
                      try {
                        await logout?.();
                        setSettingsOpen(false);
                        setToast("Google logged out");
                        goScreen("HOME");
                      } catch (e) {
                        setToast(e?.message || "Logout failed");
                      }
                    }}
                  >
                    Google Logout
                  </MiniBtn>
                )}

                {phantomWallet ? (
                  <MiniBtn tone="danger" onClick={disconnectPhantom}>
                    Disconnect Phantom
                  </MiniBtn>
                ) : (
                  <MiniBtn tone="good" onClick={connectPhantom} disabled={connectingPhantom}>
                    {connectingPhantom ? "Connecting" : "Connect Phantom"}
                  </MiniBtn>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
