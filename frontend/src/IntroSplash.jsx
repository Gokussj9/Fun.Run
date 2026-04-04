import React, { useEffect, useMemo, useState } from "react";

export default function IntroSplash({
  durationMs = 5000,
  onDone,
  logoUrl = "/logo.png",
}) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const emittedCoins = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        id: i + 1,
        emoji: ["🐶", "🐸", "😂", "🦍", "🚀", "🔥", "🍌", "💎", "👑", "🪙", "😺", "🤖"][i],
        delay: `${i * 0.22}s`,
        duration: `${2.6 + (i % 4) * 0.25}s`,
        size: 18 + (i % 3) * 4,
      })),
    []
  );

  const runningCoins = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        id: i + 1,
        emoji: ["🐶", "🐸", "😂", "🦍", "🚀", "🔥", "🍌", "💎", "👑", "🪙", "😺", "🤖"][i],
        left: `${6 + i * 7.8}%`,
        delay: `${i * 0.28}s`,
        duration: `${4.8 + (i % 5) * 0.35}s`,
        size: 20 + (i % 3) * 3,
      })),
    []
  );

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const total = reduce ? 1200 : durationMs;
    const logoTime = reduce ? 300 : 900;

    const t0 = setTimeout(() => setStep(1), logoTime);
    const t1 = setTimeout(() => setLeaving(true), Math.max(0, total - 320));
    const t2 = setTimeout(() => onDone?.(), total);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [durationMs, onDone]);

  return (
    <>
      <div className={`funIntroRoot ${leaving ? "funIntroLeave" : ""}`}>
        {step === 0 ? (
          <div className="funLogoStage">
            <div className="funLogoHalo" />
            <img src={logoUrl} alt="Fun.Run" className="funMainLogo" />
          </div>
        ) : (
          <div className="funScene">
            <div className="funSkyGlow funSkyGlowA" />
            <div className="funSkyGlow funSkyGlowB" />
            <div className="funSun" />
            <div className="funCloud funCloudA" />
            <div className="funCloud funCloudB" />
            <div className="funHill funHillBack" />
            <div className="funHill funHillMid" />
            <div className="funHill funHillFront" />
            <div className="funGrass" />

            <div className="funBrandChip">
              <span className="funBrandDot" />
              <span>Fun.Run is starting</span>
            </div>

            <div className="funTitleWrap">
              <div className="funBrand">Fun.Run</div>
              <h1 className="funTitle">
  Creator-first
  <br />
  meme coin launchpad
</h1>
              <p className="funSub">
  Launch fast, discover new coins, and enjoy a smooth Solana-native experience built for creators and communities.
</p>
            </div>

            <div className="funMachineWrap">
              <div className="funMachineShadow" />
              <div className="funMachine">
                <div className="funMachineTop">
                  <div className="funMachineBadge">SOLANA ENGINE</div>

                  <div className="funScreen">
                    {logoUrl ? (
                      <img src={logoUrl} alt="logo" className="funScreenLogo" />
                    ) : (
                      <div className="funSolanaMark funSolanaTiny">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}

                    <div className="funScreenText">
                      <div className="funScreenTitle">Meme Coin Factory</div>
                      <div className="funScreenSub">
                        coins launching • running • playing
                      </div>
                    </div>
                  </div>
                </div>

                <div className="funSolanaBody">
                  <div className="funSolanaMark funSolanaBig">
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="funEnergyRing funEnergyRingA" />
                  <div className="funEnergyRing funEnergyRingB" />

                  <div className="funGear funGearA">⚙️</div>
                  <div className="funGear funGearB">⚙️</div>
                  <div className="funGear funGearC">⚙️</div>

                  <div className="funPulseLine funPulseLineA" />
                  <div className="funPulseLine funPulseLineB" />
                </div>

                <div className="funPipeRow">
                  <div className="funPipe funPipeLeft" />
                  <div className="funPipe funPipeMid" />
                  <div className="funPipe funPipeRight" />
                </div>

                <div className="funOutputLane">
                  <div className="funLaneGlow" />
                  <div className="funSpark funSparkA" />
                  <div className="funSpark funSparkB" />
                  <div className="funSpark funSparkC" />

                  <div className="funEmitter">
                    {emittedCoins.map((coin) => (
                      <div
                        key={coin.id}
                        className="funEmitCoin"
                        style={{
                          animationDelay: coin.delay,
                          animationDuration: "2.2s",
                          fontSize: coin.size,
                        }}
                      >
                        <div className="funEmitCoinFace">{coin.emoji}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="funPlayground">



            {runningCoins.map((coin) => (
  <div
    key={coin.id}
    className="funRunner"
    style={{
      left: coin.left,
      animationDelay: coin.delay,
      animationDuration: "2.2s",
    }}
  >
    <div className="funRunnerChar">
      <div
        className="funRunnerCoin"
        style={{ fontSize: coin.size }}
      >
        <span className="funRunnerFace">{coin.emoji}</span>
      </div>

      <span className="funArm funArmLeft" />
      <span className="funArm funArmRight" />
      <span className="funLeg funLegLeft" />
      <span className="funLeg funLegRight" />
    </div>

    <div className="funRunnerDust" />
  </div>
))}
            </div>

            <div className="funBottomPill">
              Solana machine is running • 10+ meme coins are out playing
            </div>
          </div>
        )}
      </div>

      <style>{`
        .funIntroRoot{
          position:fixed;
          inset:0;
          z-index:999999;
          overflow:hidden;
          background:
            radial-gradient(900px 520px at 50% 18%, rgba(255,225,120,.30), transparent 48%),
            linear-gradient(180deg, #ccffe4 0%, #91ebc9 28%, #2b876f 100%);
          transition:opacity .32s ease, transform .32s ease;
        }

        .funIntroLeave{
          opacity:0;
          transform:scale(1.015);
          pointer-events:none;
        }

        .funLogoStage{
          position:absolute;
          inset:0;
          display:flex;
          align-items:center;
          justify-content:center;
          background:
            radial-gradient(circle at 50% 42%, rgba(255,255,255,.42), transparent 25%),
            radial-gradient(circle at 50% 50%, rgba(0,255,204,.22), transparent 36%),
            linear-gradient(180deg, #e8fff5 0%, #9cf0cf 45%, #267a66 100%);
        }

        .funLogoHalo{
          position:absolute;
          width:min(54vw, 380px);
          height:min(54vw, 380px);
          border-radius:50%;
          background:radial-gradient(circle, rgba(255,255,255,.68), rgba(0,255,204,.14) 55%, transparent 72%);
          filter:blur(10px);
        }

        .funMainLogo{
          position:relative;
          z-index:2;
          width:min(44vw, 290px);
          height:min(44vw, 290px);
          object-fit:contain;
          animation:funLogoFloat 1.8s ease-in-out infinite alternate;
          filter:
            drop-shadow(0 16px 35px rgba(0,0,0,.18))
            drop-shadow(0 0 24px rgba(0,255,204,.22));
        }

        @keyframes funLogoFloat{
          from{ transform:translateY(-6px) scale(1); }
          to{ transform:translateY(6px) scale(1.03); }
        }

        .funScene{
          position:relative;
          width:100%;
          height:100%;
          overflow:hidden;
        }

        .funSkyGlow{
          position:absolute;
          border-radius:50%;
          filter:blur(30px);
          opacity:.85;
          pointer-events:none;
        }

        .funSkyGlowA{
          width:520px;
          height:520px;
          top:-140px;
          left:-120px;
          background:radial-gradient(circle, rgba(255,255,255,.44), transparent 70%);
        }

        .funSkyGlowB{
          width:460px;
          height:460px;
          top:-90px;
          right:-80px;
          background:radial-gradient(circle, rgba(0,255,204,.20), transparent 72%);
        }

        .funSun{
          position:absolute;
          top:7%;
          left:50%;
          transform:translateX(-50%);
          width:min(22vw, 180px);
          height:min(22vw, 180px);
          border-radius:50%;
          background:
            radial-gradient(circle at 50% 50%, rgba(255,250,210,1) 0%, rgba(255,214,92,.96) 48%, rgba(255,184,60,.72) 68%, rgba(255,184,60,0) 100%);
          box-shadow:
            0 0 28px rgba(255,215,96,.55),
            0 0 88px rgba(255,185,62,.28);
        }

        .funCloud{
          position:absolute;
          background:rgba(255,255,255,.48);
          border-radius:999px;
          filter:blur(1px);
        }

        .funCloud:before,
        .funCloud:after{
          content:"";
          position:absolute;
          background:inherit;
          border-radius:999px;
        }

        .funCloudA{
          width:120px;
          height:34px;
          top:14%;
          left:11%;
          animation:funCloudDrift 12s linear infinite;
        }
        .funCloudA:before{ width:42px; height:42px; left:14px; top:-14px; }
        .funCloudA:after{ width:52px; height:52px; right:14px; top:-20px; }

        .funCloudB{
          width:150px;
          height:38px;
          top:19%;
          right:10%;
          animation:funCloudDrift 15s linear infinite reverse;
        }
        .funCloudB:before{ width:44px; height:44px; left:18px; top:-14px; }
        .funCloudB:after{ width:58px; height:58px; right:16px; top:-22px; }

        @keyframes funCloudDrift{
          from{ transform:translateX(0); }
          to{ transform:translateX(20px); }
        }

        .funHill{
          position:absolute;
          left:-8%;
          width:116%;
          border-radius:50%;
        }

        .funHillBack{
          height:38%;
          bottom:15%;
          background:linear-gradient(180deg, #94de8b 0%, #49a55e 100%);
        }

        .funHillMid{
          height:28%;
          bottom:11%;
          background:linear-gradient(180deg, #66d87d 0%, #2f9754 100%);
        }

        .funHillFront{
          height:34%;
          bottom:-4%;
          background:linear-gradient(180deg, #49c96b 0%, #1f8a4b 100%);
        }

        .funGrass{
          position:absolute;
          left:0;
          right:0;
          bottom:0;
          height:22%;
          background:
            linear-gradient(180deg, rgba(255,255,255,.10), transparent 18%),
            repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px 18px),
            linear-gradient(180deg, #3bcf61 0%, #16733a 100%);
          box-shadow: inset 0 14px 30px rgba(255,255,255,.08);
        }

        .funBrandChip{
          position:absolute;
          top:22px;
          left:22px;
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border-radius:999px;
          background:rgba(9,38,34,.22);
          border:1px solid rgba(255,255,255,.20);
          color:#f4fff8;
          font-size:12px;
          font-weight:800;
          backdrop-filter:blur(10px);
          z-index:6;
        }

        .funBrandDot{
          width:8px;
          height:8px;
          border-radius:50%;
          background:#63f5c8;
          box-shadow:0 0 12px rgba(99,245,200,.85);
        }

        .funTitleWrap{
          position:absolute;
          top:14%;
          left:6%;
          max-width:min(48vw, 560px);
          z-index:4;
        }

        .funBrand{
          color:#10392f;
          font-size:clamp(22px, 3vw, 34px);
          font-weight:950;
          letter-spacing:.3px;
          text-shadow:0 2px 0 rgba(255,255,255,.18);
        }

        .funTitle{
          margin:10px 0 12px;
          font-size:clamp(34px, 5vw, 70px);
          line-height:.98;
          font-weight:1000;
          letter-spacing:-1.2px;
          color:#fffdf6;
          text-shadow:
            0 12px 30px rgba(0,0,0,.15),
            0 2px 0 rgba(16,57,47,.18);
        }

        .funSub{
          margin:0;
          max-width:560px;
          color:rgba(11,46,37,.86);
          font-size:clamp(14px, 1.6vw, 18px);
          line-height:1.6;
          font-weight:700;
        }

        .funMachineWrap{
          position:absolute;
          right:6%;
          bottom:18%;
          width:min(40vw, 430px);
          min-width:280px;
          z-index:5;
        }

        .funMachineShadow{
          position:absolute;
          left:8%;
          right:8%;
          bottom:-18px;
          height:28px;
          border-radius:50%;
          background:rgba(0,0,0,.18);
          filter:blur(8px);
        }

        .funMachine{
          position:relative;
          border-radius:32px;
          padding:18px 18px 24px;
          background:
            linear-gradient(180deg, rgba(12,24,38,.95), rgba(10,16,28,.98));
          border:1px solid rgba(255,255,255,.14);
          box-shadow:
            0 26px 60px rgba(6,24,20,.34),
            inset 0 1px 0 rgba(255,255,255,.12);
          overflow:hidden;
        }

        .funMachine:before{
          content:"";
          position:absolute;
          inset:0;
          background:
            radial-gradient(220px 90px at 50% 0%, rgba(99,245,200,.16), transparent 60%),
            radial-gradient(180px 110px at 80% 85%, rgba(167,139,250,.12), transparent 65%);
          pointer-events:none;
        }

        .funMachineTop{
          position:relative;
          z-index:2;
        }

        .funMachineBadge{
          width:max-content;
          margin-bottom:10px;
          padding:6px 10px;
          border-radius:999px;
          background:rgba(99,245,200,.12);
          border:1px solid rgba(99,245,200,.22);
          color:#c6fff1;
          font-size:11px;
          font-weight:900;
          letter-spacing:.3px;
        }

        .funScreen{
          display:flex;
          align-items:center;
          gap:12px;
          padding:14px;
          border-radius:22px;
          background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
          border:1px solid rgba(255,255,255,.10);
        }

        .funScreenLogo{
          width:44px;
          height:44px;
          object-fit:contain;
          display:block;
          flex-shrink:0;
          filter:drop-shadow(0 0 12px rgba(99,245,200,.28));
        }

        .funScreenTitle{
          color:#f8fffd;
          font-size:18px;
          font-weight:950;
        }

        .funScreenSub{
          margin-top:3px;
          color:rgba(225,245,240,.72);
          font-size:12px;
          font-weight:700;
        }

        .funSolanaBody{
          position:relative;
          margin-top:16px;
          min-height:160px;
          border-radius:28px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          border:1px solid rgba(255,255,255,.10);
          overflow:hidden;
        }

        .funSolanaBig{
          position:absolute;
          top:24px;
          left:20px;
          display:grid;
          gap:12px;
        }

        .funSolanaTiny span{
          width:34px;
          height:6px;
          margin-left:0 !important;
        }

        .funSolanaMark span{
          display:block;
          width:160px;
          height:18px;
          border-radius:999px;
          background:linear-gradient(90deg, #7c3aed 0%, #35e0b6 55%, #7ccbff 100%);
          transform:skewX(-18deg);
          box-shadow:0 8px 18px rgba(53,224,182,.22);
        }

        .funSolanaMark span:nth-child(2){ margin-left:16px; }
        .funSolanaMark span:nth-child(3){ margin-left:32px; }

        .funEnergyRing{
          position:absolute;
          border:2px solid rgba(99,245,200,.16);
          border-radius:50%;
          animation:funRingPulse 2.2s ease-out infinite;
        }

        .funEnergyRingA{
          width:120px;
          height:120px;
          right:44px;
          top:18px;
        }

        .funEnergyRingB{
          width:84px;
          height:84px;
          right:62px;
          top:36px;
          animation-delay:.5s;
        }

        @keyframes funRingPulse{
          0%{ transform:scale(.8); opacity:.85; }
          100%{ transform:scale(1.25); opacity:0; }
        }

        .funPulseLine{
          position:absolute;
          height:4px;
          border-radius:999px;
          background:linear-gradient(90deg, transparent, rgba(99,245,200,.9), transparent);
          animation:funPulseLine 1.4s linear infinite;
        }

        .funPulseLineA{
          left:18px;
          right:18px;
          bottom:24px;
        }

        .funPulseLineB{
          left:40px;
          right:40px;
          bottom:40px;
          animation-delay:.5s;
        }

        @keyframes funPulseLine{
          0%{ opacity:.15; transform:scaleX(.7); }
          50%{ opacity:1; transform:scaleX(1); }
          100%{ opacity:.15; transform:scaleX(.7); }
        }

        .funGear{
          position:absolute;
          display:grid;
          place-items:center;
          filter:drop-shadow(0 6px 12px rgba(0,0,0,.22));
          animation:funGearSpin 5s linear infinite;
        }
        .funGearA{ right:18px; top:18px; font-size:28px; }
        .funGearB{ right:60px; top:62px; font-size:44px; animation-duration:6.5s; }
        .funGearC{ right:22px; bottom:16px; font-size:32px; animation-duration:4.2s; }

        @keyframes funGearSpin{
          from{ transform:rotate(0deg); }
          to{ transform:rotate(360deg); }
        }

        .funPipeRow{
          position:relative;
          z-index:2;
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-top:14px;
          padding:0 12px;
          gap:10px;
        }

        .funPipe{
          flex:1;
          height:18px;
          border-radius:999px;
          background:linear-gradient(180deg, #d9e4ef 0%, #95a7b8 100%);
          box-shadow: inset 0 2px 3px rgba(255,255,255,.45);
        }

        .funOutputLane{
          position:relative;
          z-index:2;
          margin-top:14px;
          height:62px;
          border-radius:18px;
          background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03));
          border:1px solid rgba(255,255,255,.08);
          overflow:hidden;
        }

        .funLaneGlow{
          position:absolute;
          inset:0;
          background:linear-gradient(90deg, rgba(99,245,200,.15), rgba(124,58,237,.12), rgba(124,203,255,.15));
          opacity:.8;
        }

        .funSpark{
          position:absolute;
          width:14px;
          height:14px;
          border-radius:50%;
          background:rgba(255,255,255,.95);
          box-shadow:0 0 16px rgba(255,255,255,.8);
          animation:funSparkMove 1.2s linear infinite;
        }
        .funSparkA{ left:18%; top:16px; }
        .funSparkB{ left:46%; top:22px; animation-delay:.4s; }
        .funSparkC{ left:72%; top:14px; animation-delay:.75s; }

        @keyframes funSparkMove{
          0%{ transform:translateY(0) scale(.8); opacity:0; }
          20%{ opacity:1; }
          100%{ transform:translateY(-20px) scale(1.1); opacity:0; }
        }

        .funEmitter{
          position:absolute;
          inset:0;
          pointer-events:none;
        }

        .funEmitCoin{
          position:absolute;
          left:12px;
          top:50%;
          transform:translateY(-50%);
          animation-name:funEmitOut;
          animation-timing-function:linear;
          animation-iteration-count:infinite;
          will-change:transform, opacity;
        }

        .funEmitCoinFace{
          width:30px;
          height:30px;
          display:grid;
          place-items:center;
          border-radius:50%;
          background:
            radial-gradient(circle at 30% 30%, rgba(255,255,255,.95), rgba(255,255,255,.18) 28%, rgba(12,24,38,.08) 29%),
            linear-gradient(180deg, rgba(255,232,165,.98), rgba(255,194,70,.96));
          border:2px solid rgba(255,255,255,.58);
          box-shadow:
            0 10px 18px rgba(0,0,0,.20),
            0 0 14px rgba(255,226,130,.28);
        }

        @keyframes funEmitOut{
          0%{
            opacity:0;
            transform:translate(0,-50%) scale(.65) rotate(-20deg);
          }
          10%{
            opacity:1;
          }
          70%{
            opacity:1;
          }
          100%{
            opacity:0;
            transform:translate(360px,-50%) scale(1.06) rotate(18deg);
          }
        }

        .funPlayground{
          position:absolute;
          left:0;
          right:0;
          bottom:5%;
          height:min(28vh, 210px);
          z-index:5;
          pointer-events:none;
        }

        .funRunner{
          position:absolute;
          bottom:0;
          transform:translateX(-50%);
          animation-name:funRunLoop;
          animation-timing-function:linear;
          animation-iteration-count:infinite;
          will-change:transform;
        }

      .funRunnerCoin{
  position:relative;
  z-index:2;
  width:48px;
  height:48px;
  display:grid;
  place-items:center;
  border-radius:50%;
  background:
    radial-gradient(circle at 30% 30%, rgba(255,255,255,.92), rgba(255,255,255,.18) 28%, rgba(12,24,38,.10) 29%),
    linear-gradient(180deg, rgba(255,232,165,.98), rgba(255,194,70,.96));
  border:2px solid rgba(255,255,255,.55);
  box-shadow:
    0 10px 20px rgba(0,0,0,.18),
    0 0 20px rgba(255,226,130,.28);
  animation:funCoinBody .34s ease-in-out infinite alternate;
}

@keyframes funCoinBody{
  from{ transform:translateY(0) rotate(-4deg); }
  to{ transform:translateY(2px) rotate(4deg); }
}

.funRunnerChar{
  position:relative;
  width:48px;
  height:48px;
}

.funRunnerFace{
  position:relative;
  z-index:3;
  display:block;
  transform:translateY(1px);
}

.funArm,
.funLeg{
  position:absolute;
  display:block;
  background:#fff7dc;
  border-radius:999px;
  z-index:1;
  box-shadow:0 2px 6px rgba(0,0,0,.14);
  transform-origin:center top;
}

.funArm{
  width:14px;
  height:5px;
  top:18px;
}

.funArmLeft{
  left:-8px;
  animation:funArmLeftRun .28s ease-in-out infinite alternate;
}

.funArmRight{
  right:-8px;
  animation:funArmRightRun .28s ease-in-out infinite alternate;
}

.funLeg{
  width:5px;
  height:16px;
  top:40px;
}

.funLegLeft{
  left:15px;
  animation:funLegLeftRun .22s ease-in-out infinite alternate;
}

.funLegRight{
  right:15px;
  animation:funLegRightRun .22s ease-in-out infinite alternate;
}

@keyframes funArmLeftRun{
  from{ transform:rotate(28deg) translateX(0); }
  to{ transform:rotate(-28deg) translateX(-2px); }
}

@keyframes funArmRightRun{
  from{ transform:rotate(-28deg) translateX(0); }
  to{ transform:rotate(28deg) translateX(2px); }
}

@keyframes funLegLeftRun{
  from{ transform:rotate(24deg); }
  to{ transform:rotate(-26deg); }
}

@keyframes funLegRightRun{
  from{ transform:rotate(-24deg); }
  to{ transform:rotate(26deg); }
}

        .funRunnerDust{
          position:absolute;
          left:50%;
          bottom:-6px;
          width:38px;
          height:14px;
          transform:translateX(-50%);
          border-radius:50%;
          background:rgba(255,255,255,.24);
          filter:blur(6px);
        }

     @keyframes funRunLoop{
  0%{
    transform:translate(-50%, 20px) scale(.92) rotate(-8deg);
    opacity:0;
  }
  8%{
    opacity:1;
  }
  20%{
    transform:translate(-35%, -60px) scale(.96) rotate(6deg);
    opacity:1;
  }
  40%{
    transform:translate(-10%, -220px) scale(.82) rotate(-4deg);
    opacity:.98;
  }
  65%{
    transform:translate(12%, -430px) scale(.62) rotate(8deg);
    opacity:.88;
  }
  100%{
    transform:translate(28%, -760px) scale(.30) rotate(-10deg);
    opacity:0;
  }
}

        @keyframes funCoinBob{
          from{ transform:translateY(-2px) rotate(-4deg); }
          to{ transform:translateY(2px) rotate(4deg); }
        }

        .funBottomPill{
          position:absolute;
          left:50%;
          bottom:18px;
          transform:translateX(-50%);
          z-index:6;
          padding:10px 16px;
          border-radius:999px;
          background:rgba(8,35,31,.22);
          border:1px solid rgba(255,255,255,.20);
          color:#f6fff9;
          font-size:13px;
          font-weight:900;
          backdrop-filter:blur(10px);
          text-align:center;
          white-space:nowrap;
        }

        @media (max-width: 900px){
          .funTitleWrap{
            top:11%;
            left:5%;
            right:5%;
            max-width:none;
          }

          .funMachineWrap{
            right:50%;
            transform:translateX(50%);
            bottom:18%;
            width:min(88vw, 430px);
          }

          .funSub{
            max-width:100%;
          }

          @keyframes funEmitOut{
            0%{
              opacity:0;
              transform:translate(0,-50%) scale(.65) rotate(-20deg);
            }
            10%{ opacity:1; }
            70%{ opacity:1; }
            100%{
              opacity:0;
              transform:translate(280px,-50%) scale(1.06) rotate(18deg);
            }
          }
        }

        @media (max-width: 640px){
          .funBrandChip{
            top:14px;
            left:14px;
            font-size:11px;
          }

          .funTitleWrap{
            top:9%;
          }

          .funTitle{
            font-size:clamp(28px, 9vw, 44px);
          }

          .funSub{
            font-size:13px;
            max-width:92%;
          }

          .funMachineWrap{
            bottom:22%;
            width:min(92vw, 390px);
            min-width:0;
          }

          .funMachine{
            border-radius:26px;
            padding:16px 14px 18px;
          }

          .funScreen{
            padding:12px;
          }

          .funSolanaMark span{
            width:118px;
            height:14px;
          }

          .funGearA{ font-size:24px; }
          .funGearB{ font-size:36px; }
          .funGearC{ font-size:28px; }

          .funPlayground{
            bottom:3%;
            height:160px;
          }

          .funRunnerCoin{
            width:40px;
            height:40px;
            font-size:18px !important;
          }

          .funBottomPill{
            bottom:10px;
            width:calc(100% - 28px);
            white-space:normal;
            font-size:12px;
          }

          @keyframes funEmitOut{
            0%{
              opacity:0;
              transform:translate(0,-50%) scale(.65) rotate(-20deg);
            }
            10%{ opacity:1; }
            70%{ opacity:1; }
            100%{
              opacity:0;
              transform:translate(220px,-50%) scale(1.03) rotate(18deg);
            }
          }
        }
      `}</style>
    </>
  );
}