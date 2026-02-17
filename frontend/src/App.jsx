import { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useExportWallet } from "@privy-io/react-auth/solana";

const API_BASE =
  (import.meta?.env?.VITE_API_BASE || "http://localhost:5000").trim();

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const STARTING_MC_USD = 6500;
const LS_THEME = "theme";

function ThemeStyles() {
  return (
    <style>{`
      :root{
        --bg:#070A12; --card:#0C1020; --card2:#0A0E1C; --border:rgba(255,255,255,.10);
        --text:#F3F5FF; --muted:rgba(243,245,255,.65); --muted2:rgba(243,245,255,.45);
        --primary:#74F7B2; --danger:#FF7A7A; --warn:#FFCF6A;
        --shadow: 0 18px 55px rgba(0,0,0,.45);
        --shadow2: 0 14px 40px rgba(0,0,0,.50);
        --r:22px;
        --accent2:#A0B4FF;
      }

      [data-theme="neon"]{ --bg:#070A12; --card:#0C1020; --card2:#0A0E1C; --primary:#74F7B2; --accent2:#A0B4FF; }
      [data-theme="ocean"]{ --bg:#061019; --card:#07192A; --card2:#061424; --primary:#6AD7FF; --accent2:#74F7B2; }
      [data-theme="rose"]{ --bg:#14070B; --card:#1B0B12; --card2:#170810; --primary:#FF86B1; --accent2:#FFB55C; }
      [data-theme="royal"]{ --bg:#070718; --card:#0B0B25; --card2:#09091D; --primary:#A0B4FF; --accent2:#74F7B2; }
      [data-theme="sunset"]{ --bg:#120A06; --card:#1B110A; --card2:#140D08; --primary:#FFB55C; --accent2:#FF86B1; }
      [data-theme="lightgreen"]{ --bg:#07110B; --card:#0A1A12; --card2:#08150F; --primary:#9BFFB9; --accent2:#6AD7FF; }

      *{ box-sizing:border-box; }
      button, input, textarea { font-family:inherit; }
      input::-webkit-outer-spin-button, input::-webkit-inner-spin-button{ -webkit-appearance: none; margin: 0; }
      input[type=number]{ -moz-appearance:textfield; }

      .fadeIn{ animation: fadeIn .18s ease-out; }
      @keyframes fadeIn{ from{opacity:.0; transform: translateY(6px);} to{opacity:1; transform: translateY(0);} }

      .noScrollbar{ scrollbar-width: none; -ms-overflow-style: none; }
      .noScrollbar::-webkit-scrollbar{ display:none; }

      .miniScroll{
        overflow-y:auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .miniScroll::-webkit-scrollbar{ display:none; }

      .hScroll{
        overflow-x:auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .hScroll::-webkit-scrollbar{ display:none; }

      .snapX{ scroll-snap-type: x mandatory; }
      .snapItem{ scroll-snap-align: start; }
    `}</style>
  );
}

function ScreenShell({ children, fullBleed = false, allowYScroll = false }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(255,255,255,.08), transparent 60%), var(--bg)",
        color: "var(--text)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        paddingBottom: 86,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        className={`fadeIn ${allowYScroll ? "noScrollbar" : ""}`}
        style={{
          width: 520,
          maxWidth: "92vw",
          padding: fullBleed ? 12 : 18,
          background:
            "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.08)), var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r)",
          boxShadow: "var(--shadow)",
          maxHeight: allowYScroll ? "calc(100vh - 110px)" : undefined,
          overflowY: allowYScroll ? "auto" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Title({ children, sub, right }) {
  return (
    <div
      style={{
        marginBottom: 14,
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div>
        <div style={{ fontWeight: 950, fontSize: 18, letterSpacing: 0.2 }}>
          {children}
        </div>
        {sub ? (
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
            {sub}
          </div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 18,
        border: "1px solid var(--border)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.12)), var(--card2)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "muted" }) {
  const color =
    tone === "good"
      ? "var(--primary)"
      : tone === "warn"
      ? "var(--warn)"
      : tone === "danger"
      ? "var(--danger)"
      : "var(--muted)";
  const border =
    tone === "good"
      ? "rgba(116,247,178,.25)"
      : tone === "warn"
      ? "rgba(255,207,106,.25)"
      : tone === "danger"
      ? "rgba(255,122,122,.25)"
      : "var(--border)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: "rgba(255,255,255,.04)",
        color,
        fontSize: 12,
        fontWeight: 850,
      }}
    >
      {children}
    </span>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  hint,
  error,
  rightIcon,
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          marginBottom: 6,
          color: "var(--muted)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        {hint ? <span style={{ color: "var(--muted2)" }}>{hint}</span> : null}
      </div>
      <div style={{ position: "relative" }}>
        <input
          value={value}
          maxLength={maxLength}
          type={type}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: rightIcon ? "12px 44px 12px 12px" : 12,
            borderRadius: 14,
            border: `1px solid ${
              error ? "rgba(255,122,122,.6)" : "var(--border)"
            }`,
            background: "rgba(0,0,0,.18)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        {rightIcon ? (
          <div
            style={{
              position: "absolute",
              right: 10,
              top: 0,
              bottom: 0,
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
            }}
          >
            {rightIcon}
          </div>
        ) : null}
      </div>
      {error ? (
        <div style={{ marginTop: 7, color: "var(--danger)", fontSize: 12 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, maxLength, error }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          marginBottom: 6,
          color: "var(--muted)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        <span style={{ color: "var(--muted2)" }}>
          {value.length}/{maxLength}
        </span>
      </div>
      <textarea
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 14,
          border: `1px solid ${
            error ? "rgba(255,122,122,.6)" : "var(--border)"
          }`,
          background: "rgba(0,0,0,.18)",
          color: "var(--text)",
          outline: "none",
          resize: "none",
        }}
      />
      {error ? (
        <div style={{ marginTop: 7, color: "var(--danger)", fontSize: 12 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: 12,
        borderRadius: 16,
        border: "none",
        background: disabled ? "rgba(255,255,255,.10)" : "var(--primary)",
        color: disabled ? "rgba(255,255,255,.6)" : "#000",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : "var(--shadow2)",
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: 12,
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

function MiniBtn({ children, onClick, disabled, tone = "normal", style }) {
  const toneStyle =
    tone === "warn"
      ? { border: "1px solid rgba(255,207,106,.35)", color: "var(--warn)" }
      : tone === "danger"
      ? { border: "1px solid rgba(255,122,122,.35)", color: "var(--danger)" }
      : tone === "good"
      ? { border: "1px solid rgba(116,247,178,.35)", color: "var(--primary)" }
      : {};
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,.03)",
        color: "var(--text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontWeight: 900,
        ...toneStyle,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
  onConfirm,
  confirmText = "Confirm",
  confirmTone = "primary",
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 99999,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fadeIn"
        style={{
          width: 520,
          maxWidth: "92vw",
          borderRadius: 22,
          border: "1px solid var(--border)",
          background: "var(--card)",
          boxShadow: "var(--shadow)",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 950 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ marginTop: 12 }}>{children}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <GhostButton onClick={onClose}>Close</GhostButton>
          {onConfirm ? (
            confirmTone === "danger" ? (
              <button
                onClick={onConfirm}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid rgba(255,122,122,.35)",
                  background: "rgba(255,122,122,.12)",
                  color: "var(--danger)",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
              >
                {confirmText}
              </button>
            ) : (
              <PrimaryButton onClick={onConfirm}>{confirmText}</PrimaryButton>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div
      className="fadeIn"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 86,
        display: "flex",
        justifyContent: "center",
        zIndex: 99998,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "rgba(0,0,0,.55)",
          backdropFilter: "blur(10px)",
          color: "var(--text)",
          fontWeight: 850,
          fontSize: 12,
        }}
      >
        {msg}
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, text }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: "100%",
        background: "transparent",
        border: "none",
        color: active ? "var(--primary)" : "var(--muted)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        cursor: "pointer",
        fontSize: 18,
      }}
    >
      <span style={{ fontWeight: 950 }}>{icon}</span>
      {text ? <span style={{ fontSize: 11 }}>{text}</span> : null}
    </button>
  );
}

function BottomNav({ screen, setScreen }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: 70,
        background: "rgba(12,16,32,.85)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        zIndex: 9999,
        backdropFilter: "blur(12px)",
      }}
    >
      <NavBtn
        active={screen === "HOME"}
        onClick={() => setScreen("HOME")}
        icon="🏠"
        text="Home"
      />
      <NavBtn
        active={screen === "SEARCH"}
        onClick={() => setScreen("SEARCH")}
        icon="⌕"
        text="Search"
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          marginTop: -28,
        }}
      >
        <button
          onClick={() => setScreen("CREATE")}
          style={{
            width: 64,
            height: 64,
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,.12)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,.18), rgba(0,0,0,.14))",
            boxShadow: "0 22px 60px rgba(0,0,0,.65)",
            color: "var(--text)",
            fontSize: 22,
            cursor: "pointer",
          }}
          title="Create"
        >
          ✦
        </button>
      </div>
      <NavBtn
        active={screen === "LATEST"}
        onClick={() => setScreen("LATEST")}
        icon="◷"
        text="Latest"
      />
      <NavBtn
        active={screen === "PROFILE"}
        onClick={() => setScreen("PROFILE")}
        icon="👤"
        text="Profile"
      />
    </div>
  );
}

function Pager({ pages, pageIndex, setPageIndex }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: w * pageIndex, behavior: "smooth" });
  }, [pageIndex]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const idx = Math.round(el.scrollLeft / w);
    if (idx !== pageIndex) setPageIndex(idx);
  }

  return (
    <div>
      <div
        ref={ref}
        onScroll={onScroll}
        className="hScroll snapX"
        style={{ display: "flex", gap: 0, width: "100%" }}
      >
        {pages.map((p, i) => (
          <div
            key={i}
            className="snapItem"
            style={{ width: "100%", flex: "0 0 100%" }}
          >
            {p}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginTop: 10,
        }}
      >
        {pages.map((_, i) => (
          <button
            key={i}
            onClick={() => setPageIndex(i)}
            style={{
              width: i === pageIndex ? 22 : 8,
              height: 8,
              borderRadius: 999,
              border: "none",
              background:
                i === pageIndex
                  ? "var(--primary)"
                  : "rgba(255,255,255,.14)",
              cursor: "pointer",
              transition: "all .15s ease",
            }}
            title={`Page ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`);
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}
async function apiPostTry(paths, body) {
  let last = null;
  for (const p of paths) {
    try {
      const res = await apiPost(p, body);
      last = res;
      if (res?.ok) return res;
    } catch (e) {
      last = { ok: false, error: String(e?.message || e) };
    }
  }
  return last || { ok: false, error: "No endpoint responded" };
}

function isValidSymbol(s) {
  const v = (s || "").trim();
  if (v.length < 2 || v.length > 10) return false;
  return /^[A-Z0-9]+$/.test(v);
}
function isValidName(s) {
  const v = (s || "").trim();
  return v.length >= 2 && v.length <= 32;
}
function isValidStory(s) {
  const v = (s || "").trim();
  return v.length >= 20 && v.length <= 300;
}
function ensureCoinShape(c) {
  const live = c?.status === "LIVE";
  const baseMC = live ? Number(c?.mc || STARTING_MC_USD) : 0;
  const baseATH = live ? Number(c?.ath || baseMC || STARTING_MC_USD) : 0;
  const chart =
    Array.isArray(c?.chart) && c.chart.length
      ? c.chart
      : live
      ? [baseMC, baseMC, baseMC, baseMC, baseMC]
      : [0, 0, 0, 0, 0];

  return {
    ...c,
    mc: baseMC,
    ath: baseATH,
    chart,
    createdAt: c?.createdAt || Date.now(),
    volumeSol: Number(c?.volumeSol || 0),
    creatorRewardsSol: Number(c?.creatorRewardsSol || 0),
    totalSupply: Number(c?.totalSupply || 0),
  };
}
function fmtTime(t) {
  const d = new Date(t);
  return d.toLocaleString();
}
function shortWallet(w) {
  const s = String(w || "");
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
function fmtUsd(n) {
  const x = Number(n || 0);
  return `$${Math.round(x).toLocaleString()}`;
}
function safeOrigin() {
  try {
    return window.location.origin;
  } catch {
    return "http://localhost:5173";
  }
}
function pctFromChart(chart) {
  const arr = Array.isArray(chart) ? chart : [];
  if (arr.length < 2) return 0;
  const a = Number(arr[arr.length - 2] || 0);
  const b = Number(arr[arr.length - 1] || 0);
  if (!a) return 0;
  return ((b - a) / a) * 100;
}

function CoinLogo({ c, size = 46 }) {
  const src = c?.logo || "";
  const has = !!src;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.35),
        border: "1px solid var(--border)",
        background: "rgba(0,0,0,.18)",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {has ? (
        <img
          src={src}
          alt="logo"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {(c?.symbol || "•").slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function CoinRow({ c, onClick, right }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: 12,
        borderRadius: 18,
        border: "1px solid var(--border)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.14)), var(--card2)",
        color: "var(--text)",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <CoinLogo c={c} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 950 }}>
              {c.name} <span style={{ color: "var(--muted)" }}>({c.symbol})</span>
            </div>
            {right || <Pill>{c.status}</Pill>}
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
            Tap to open market
          </div>
        </div>
      </div>
    </button>
  );
}

function CoinMiniCard({ c, subtitle, tag, accent = "var(--primary)", onOpen }) {
  const p = pctFromChart(c.chart);
  const pos = p >= 0;
  return (
    <button
      onClick={onOpen}
      style={{
        width: 250,
        minWidth: 250,
        textAlign: "left",
        padding: 12,
        borderRadius: 18,
        border: "1px solid var(--border)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.16)), var(--card2)",
        color: "var(--text)",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(220px 120px at 30% 10%, ${accent}20, transparent 60%)`,
        }}
      />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CoinLogo c={c} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 950, lineHeight: 1.15 }}>
              {c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name}{" "}
              <span style={{ color: "var(--muted)" }}>({c.symbol})</span>
            </div>
            <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>
              {subtitle}
            </div>
          </div>
        </div>

        <div
          style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}
        >
          <Pill tone={pos ? "good" : "danger"}>
            {pos ? "↑" : "↓"} {Math.abs(p).toFixed(1)}%
          </Pill>
          <Pill>MC: {fmtUsd(c.mc || 0)}</Pill>
          <Pill>VOL: {Number(c.volumeSol || 0).toFixed(2)} SOL</Pill>
          {tag ? <Pill tone="warn">{tag}</Pill> : null}
        </div>
      </div>
    </button>
  );
}

function PriceChart({ points, txMarkers, mode, onToggleMode }) {
  const W = 1000;
  const H = 380;
  const PAD = 18;

  const safePoints =
    Array.isArray(points) && points.length ? points : [0, 0, 0, 0, 0];
  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);
  const span = Math.max(1, max - min);

  const bg = mode === "dark" ? "#0B0F1D" : "#FFFFFF";
  const border = mode === "dark" ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)";
  const text = mode === "dark" ? "rgba(255,255,255,.75)" : "rgba(0,0,0,.65)";

  const xFor = (i) =>
    PAD + (i * (W - PAD * 2)) / Math.max(1, safePoints.length - 1);
  const yFor = (v) => {
    const t = (Number(v) - min) / span;
    return PAD + (1 - t) * (H - PAD * 2);
  };

  let d = "";
  safePoints.forEach((v, i) => {
    const x = xFor(i);
    const y = yFor(v);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  const dots = Array.isArray(txMarkers) ? txMarkers.slice(0, 20) : [];
  const dotItems = dots.map((t, idx) => {
    const i = Math.max(0, safePoints.length - 1 - idx * 2);
    const x = xFor(i);
    const y = yFor(safePoints[i]);
    const side = String(t.side || "").toUpperCase();
    const fill = side === "SELL" ? "#FF4D4D" : "#16C784";
    return { x, y, fill, id: t.id || `${idx}` };
  });

  const lastV = safePoints[safePoints.length - 1];
  const label = Number(lastV || 0) ? fmtUsd(lastV) : "—";

  return (
    <div
      style={{
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${border}`,
        background: bg,
      }}
    >
      <div
        style={{
          padding: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          borderBottom: `1px solid ${border}`,
        }}
      >
        <div style={{ fontSize: 12, color: text, fontWeight: 900 }}>
          Price:{" "}
          <span style={{ color: mode === "dark" ? "#fff" : "#000" }}>
            {label}
          </span>
        </div>

        <button
          onClick={onToggleMode}
          style={{
            padding: "8px 10px",
            borderRadius: 999,
            border: `1px solid ${border}`,
            background:
              mode === "dark"
                ? "rgba(255,255,255,.06)"
                : "rgba(0,0,0,.04)",
            color:
              mode === "dark"
                ? "rgba(255,255,255,.85)"
                : "rgba(0,0,0,.75)",
            cursor: "pointer",
            fontWeight: 900,
            fontSize: 12,
          }}
          title="Toggle chart theme"
        >
          {mode === "dark" ? "Dark" : "Light"} ▾
        </button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="340"
        style={{ display: "block" }}
      >
        <path
          d={d}
          fill="none"
          stroke={mode === "dark" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.30)"}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {dotItems.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r="6"
            fill={p.fill}
            opacity="0.95"
          />
        ))}
      </svg>
    </div>
  );
}

function ThemeOption({ theme, current, setTheme, label, badge }) {
  const active = current === theme;
  return (
    <button
      onClick={() => setTheme(theme)}
      style={{
        width: "100%",
        padding: 12,
        borderRadius: 18,
        border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
        background: "rgba(255,255,255,.03)",
        color: "var(--text)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        cursor: "pointer",
        fontWeight: 900,
      }}
    >
      <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
        <span>{label}</span>
        {badge ? <Pill tone="warn">{badge}</Pill> : null}
      </span>
      <span style={{ color: "var(--muted)" }}>
        {active ? "Selected" : "Tap"}
      </span>
    </button>
  );
}

function Tabs({ value, onChange, items }) {
  return (
    <div className="hScroll" style={{ display: "flex", gap: 10, paddingBottom: 2 }}>
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
              background: "rgba(255,255,255,.03)",
              color: active ? "var(--text)" : "var(--muted)",
              cursor: "pointer",
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function NetLogo({ chain }) {
  const c = String(chain || "").toLowerCase();
  const common = { width: 24, height: 24, viewBox: "0 0 24 24" };

  if (c === "solana") {
    return (
      <svg {...common} aria-label="Solana">
        <defs>
          <linearGradient id="solg2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#14F195" />
            <stop offset="1" stopColor="#9945FF" />
          </linearGradient>
        </defs>
        <path
          d="M6.2 7.1c.3-.3.7-.5 1.1-.5h12.2c.2 0 .3.3.1.4l-2 2c-.3.3-.7.5-1.1.5H4.3c-.2 0-.3-.3-.1-.4l2-2z"
          fill="url(#solg2)"
        />
        <path
          d="M6.2 11.3c.3-.3.7-.5 1.1-.5h12.2c.2 0 .3.3.1.4l-2 2c-.3.3-.7.5-1.1.5H4.3c-.2 0-.3-.3-.1-.4l2-2z"
          fill="url(#solg2)"
          opacity="0.9"
        />
        <path
          d="M6.2 15.5c.3-.3.7-.5 1.1-.5h12.2c.2 0 .3.3.1.4l-2 2c-.3.3-.7.5-1.1.5H4.3c-.2 0-.3-.3-.1-.4l2-2z"
          fill="url(#solg2)"
          opacity="0.8"
        />
      </svg>
    );
  }

  if (c === "bnb") {
    return (
      <svg {...common} aria-label="BNB">
        <path
          d="M12 2.6l3.8 3.8L12 10.2 8.2 6.4 12 2.6zm0 6.9l2.5 2.5L12 14.5 9.5 12 12 9.5zm6.1-3.1l3.8 3.8-3.8 3.8-3.8-3.8 3.8-3.8zM5.9 6.4l3.8 3.8-3.8 3.8L2.1 10.2 5.9 6.4zM12 13.8l3.8 3.8L12 21.4 8.2 17.6 12 13.8z"
          fill="#F0B90B"
        />
      </svg>
    );
  }

  return (
    <svg {...common} aria-label="Polygon">
      <path
        d="M16.6 8.1c-1.1-.6-2.5-.6-3.6 0l-2.2 1.3-1.5-.9c-1.1-.6-2.5-.6-3.6 0-1.1.6-1.8 1.8-1.8 3v2.6c0 1.3.7 2.4 1.8 3 1.1.6 2.5.6 3.6 0l2.2-1.3 1.5.9c1.1.6 2.5.6 3.6 0 1.1-.6 1.8-1.8 1.8-3v-2.6c0-1.3-.7-2.4-1.8-3zm-7.3 10.1c-.5.3-1.1.3-1.6 0-.5-.3-.8-.8-.8-1.4v-2.6c0-.6.3-1.1.8-1.4.5-.3 1.1-.3 1.6 0l1.2.7v5.3l-1.2-.6zm10-1.4c0 .6-.3 1.1-.8 1.4-.5.3-1.1.3-1.6 0l-1.2-.7V12l1.2-.7c.5-.3 1.1-.3 1.6 0 .5.3.8.8.8 1.4v2.6z"
        fill="#8247E5"
      />
    </svg>
  );
}

function SectionHeader({ title, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 10,
        marginBottom: 10,
      }}
    >
      <div style={{ fontWeight: 950 }}>{title}</div>
      {right}
    </div>
  );
}

export default function App() {
  const { login, authenticated, user, ready, logout, connectOrCreateWallet } =
    usePrivy();
  const { exportWallet } = useExportWallet();

  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState(localStorage.getItem(LS_THEME) || "neon");
  const [screen, setScreen] = useState("HOME");
  const [selectedCoinId, setSelectedCoinId] = useState(null);
  const [homePage, setHomePage] = useState(0);

  const [balance, setBalance] = useState("—");
  const [loadingBal, setLoadingBal] = useState(false);

  const [coins, setCoins] = useState([]);
  const [loadingCoins, setLoadingCoins] = useState(false);

  const [searchQ, setSearchQ] = useState("");

  const [tokenName, setTokenName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [story, setStory] = useState("");
  const [initialSol, setInitialSol] = useState("0.01");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [logoPreview, setLogoPreview] = useState("");
  const [logoError, setLogoError] = useState("");

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [chartMode, setChartMode] = useState("light");
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeSide, setTradeSide] = useState("BUY");
  const [tradeSol, setTradeSol] = useState("0.05");
  const [tradeLoading, setTradeLoading] = useState(false);

  const [dwOpen, setDwOpen] = useState(false);
  const [dwMode, setDwMode] = useState("DEPOSIT"); // DEPOSIT | WITHDRAW
  const [withdrawTo, setWithdrawTo] = useState("");

  const [oneClickW, setOneClickW] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1500);
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(LS_THEME, theme);
  }, [theme]);

  const solAddr = useMemo(() => {
    const w = user?.linkedAccounts?.find(
      (a) => a.type === "wallet" && a.chainType === "solana"
    );
    return w?.address || null;
  }, [user]);

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied ✅");
      return true;
    } catch {
      showToast("Copy failed");
      return false;
    }
  }

  async function openDeposit() {
    if (!solAddr) return showToast("Wallet not ready");
    setDwMode("DEPOSIT");
    setDwOpen(true);
    await copyText(solAddr);
  }

  async function openWithdraw() {
    if (!solAddr) return showToast("Wallet not ready");
    setDwMode("WITHDRAW");
    setWithdrawTo("");
    setDwOpen(true);
  }

 async function refreshBalance(addr = solAddr) {
  if (!addr) return;

  // ✅ ensure string address
  const address =
    typeof addr === "string"
      ? addr
      : addr?.address ||
        addr?.publicKey?.toBase58?.() ||
        addr?.publicKey ||
        "";

  if (!address) return;

  setLoadingBal(true);

  try {
    const data = await apiGet(
      `/api/balance/${encodeURIComponent(address)}`
    );

    const sol =
      Number.isFinite(Number(data?.sol))
        ? Number(data.sol)
        : Number.isFinite(Number(data?.balance))
        ? Number(data.balance)
        : Number.isFinite(Number(data?.lamports))
        ? Number(data.lamports) / 1_000_000_000
        : 0;

    setBalance(sol.toFixed(4));
  } catch {
    setBalance("—");
  }

  setLoadingBal(false);
}


  useEffect(() => {
    if (!authenticated || !solAddr) return;
    refreshBalance();
    const t = setInterval(() => refreshBalance(), 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, solAddr]);

  async function loadCoins() {
    setLoadingCoins(true);
    try {
      const data = await apiGet("/api/coin/list");
      if (data?.ok) setCoins((data.coins || []).map(ensureCoinShape));
    } catch {}
    setLoadingCoins(false);
  }
  useEffect(() => {
    loadCoins();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    if (!(screen === "HOME" || screen === "LATEST")) return;
    const t = setInterval(() => loadCoins(), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, authenticated]);

  const coinsSorted = useMemo(() => {
    const arr = [...coins];
    arr.sort((a, b) => {
      const al = a.status === "LIVE" ? 1 : 0;
      const bl = b.status === "LIVE" ? 1 : 0;
      if (al !== bl) return bl - al;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return arr;
  }, [coins]);

  const selectedCoin = coins.find((c) => c.id === selectedCoinId) || null;

  const movers = useMemo(() => {
    const live = coinsSorted.filter((c) => c.status === "LIVE");
    const scored = live.map((c) => ({ c, p: pctFromChart(c.chart) }));
    scored.sort((a, b) => Math.abs(b.p) - Math.abs(a.p));
    return scored.slice(0, 12).map((x) => x.c);
  }, [coinsSorted]);

  const topVolume = useMemo(() => {
    const live = coinsSorted.filter((c) => c.status === "LIVE");
    const arr = [...live].sort(
      (a, b) => Number(b.volumeSol || 0) - Number(a.volumeSol || 0)
    );
    return arr.slice(0, 12);
  }, [coinsSorted]);

  const moonshots = useMemo(() => {
    const live = coinsSorted.filter((c) => c.status === "LIVE");
    const arr = live
      .map((c) => ({ c, p: pctFromChart(c.chart) }))
      .filter((x) => x.p >= 15)
      .sort((a, b) => b.p - a.p)
      .slice(0, 12)
      .map((x) => x.c);
    return arr.length ? arr : movers.slice(0, 12);
  }, [coinsSorted, movers]);

  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    return coinsSorted
      .filter((c) =>
        `${c.name} ${c.symbol}`.toLowerCase().includes(searchQ.toLowerCase())
      )
      .slice(0, 25);
  }, [searchQ, coinsSorted]);

  const symbolUpper = (symbol || "").toUpperCase().replace(/\s+/g, "");

  const nameOk = isValidName(tokenName);
  const symOk = isValidSymbol(symbolUpper);
  const storyOk = isValidStory(story);
  const nSol = Number(initialSol);
  const paidOk = Number.isFinite(nSol) && (nSol === 0 || nSol >= 0.01);
  const isFree = Number.isFinite(nSol) && nSol <= 0;

  const logoOk = !!logoPreview && !logoError;
  const canCreate = nameOk && symOk && storyOk && paidOk && logoOk;

  const nameErr = !tokenName ? "" : nameOk ? "" : "Name 2–32 chars";
  const symErr = !symbolUpper ? "" : symOk ? "" : "Symbol 2–10 (A-Z/0-9)";
  const storyErr = !story ? "" : storyOk ? "" : "Story 20–300 chars";
  const solErr = paidOk ? "" : "Paid create min 0.01 SOL. Free = 0";

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  async function onPickLogo(file) {
    setLogoError("");
    setLogoPreview("");
    if (!file) return;
    const okType = ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(
      file.type
    );
    if (!okType) return setLogoError("PNG/JPG/WEBP only");
    if (file.size > MAX_LOGO_BYTES) return setLogoError("Logo 5MB se chota hona chahiye");
    if (file.size < 10 * 1024) return setLogoError("Logo bohat choti (min 10KB)");
    try {
      setLogoPreview(await fileToDataUrl(file));
    } catch {
      setLogoError("Logo read failed");
    }
  }

  async function openPrivyBackup() {
    try {
      await connectOrCreateWallet?.();
    } catch {}
    try {
      await exportWallet(solAddr ? { address: solAddr } : undefined);
    } catch {
      showToast("Backup modal open nahi hua");
    }
  }

  const referralFromUrl = useMemo(() => {
    try {
      const u = new URL(window.location.href);
      const ref = u.searchParams.get("ref");
      return ref ? String(ref).trim() : "";
    } catch {
      return "";
    }
  }, []);

  const myReferralLink = useMemo(() => {
    if (!solAddr) return "";
    return `${safeOrigin()}/?ref=${solAddr}`;
  }, [solAddr]);

  const [refStatus, setRefStatus] = useState("");
  async function trySetReferral() {
    if (!solAddr) return;
    if (!referralFromUrl) return;
    if (referralFromUrl === solAddr) return;

    try {
      const res = await apiPost("/api/referral/set", {
        wallet: solAddr,
        referrer: referralFromUrl,
      });
      if (res?.ok) setRefStatus("set");
      else if (String(res?.error || "").toLowerCase().includes("immutable"))
        setRefStatus("already");
      else setRefStatus("invalid");
    } catch {}
  }
  useEffect(() => {
    if (!authenticated || !solAddr) return;
    trySetReferral();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, solAddr]);

  async function loadProfile() {
    if (!solAddr) return;
    setLoadingProfile(true);
    try {
      const j = await apiGet(`/api/profile/${solAddr}`);
      if (j?.ok) setProfile(j.profile || null);
    } catch {}
    setLoadingProfile(false);
  }

  useEffect(() => {
    if (!authenticated || !solAddr) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, solAddr]);

  const myHoldingsList = useMemo(() => {
    const arr = Array.isArray(profile?.holdings) ? profile.holdings : [];
    return [...arr].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
  }, [profile]);

  const myTxList = useMemo(() => {
    const arr = Array.isArray(profile?.txs) ? profile.txs : [];
    return [...arr].sort((a, b) => (b.t || 0) - (a.t || 0));
  }, [profile]);

  const myRewards = useMemo(
    () => profile?.rewards || { totalSol: 0, byCoin: {} },
    [profile]
  );

  const myReferralRewardsSol = useMemo(() => {
    const d = Number(profile?.referralRewards?.totalSol || 0);
    return Number.isFinite(d) && d > 0 ? d : 0;
  }, [profile]);

  const myCoins = useMemo(() => {
    if (!solAddr) return [];
    return coinsSorted.filter((c) => (c.creatorWallet || c.owner) === solAddr);
  }, [coinsSorted, solAddr]);

  async function doTrade(coin, side, solAmount) {
    const s = Number(solAmount);
    if (!solAddr) return showToast("Wallet not ready");
    if (!Number.isFinite(s) || s <= 0) return showToast("Amount invalid");

    setTradeLoading(true);
    try {
      const res = await apiPost("/api/trade", {
        wallet: solAddr,
        coinId: coin.id,
        side,
        sol: s,
      });

      if (!res?.ok) {
        if (res?.maxSol != null) {
          showToast(`${res?.error || "Trade blocked"} (max ${res.maxSol} SOL)`);
        } else {
          showToast(res?.error || "Trade failed");
        }
      } else {
        const updated = ensureCoinShape(res.coin);
        setCoins((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        await loadProfile();
        showToast(`${side} ${s} ✅`);
      }
    } catch {
      showToast("Trade failed");
    }
    setTradeLoading(false);
  }

  async function oneClickWithdraw(kind) {
    if (!solAddr) return showToast("Wallet not ready");
    setOneClickW(kind);

    const body = { wallet: solAddr, to: solAddr, kind };
    const res = await apiPostTry(
      ["/api/withdraw", "/api/withdraw/creator", "/api/withdraw/referral"],
      body
    );

    if (res?.ok) {
      showToast("Withdraw ✅ (sent to main wallet)");
      await loadProfile();
      await refreshBalance();
    } else {
      showToast(res?.error || "Withdraw failed");
    }

    setOneClickW("");
  }

  let content = null;

  if (!ready) {
    content = (
      <ScreenShell>
        <Title sub="Please wait…">Loading</Title>
        <div style={{ color: "var(--muted)" }}>Privy initializing…</div>
      </ScreenShell>
    );
  } else if (!authenticated) {
    content = (
      <ScreenShell>
        <Title sub="Continue with Google">Login</Title>
        <PrimaryButton onClick={login}>Continue with Google</PrimaryButton>
      </ScreenShell>
    );
  } else {
    if (screen === "HOME") {
      const page1 = (
        <div>
          <Title
            sub="Discovery auto-refresh every 5 seconds"
            right={
              <MiniBtn onClick={loadCoins} disabled={loadingCoins}>
                {loadingCoins ? "…" : "Reload"}
              </MiniBtn>
            }
          >
            Market
          </Title>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <Pill>Balance: {balance} SOL</Pill>
            <Pill tone="warn">Deposit in Profile</Pill>
          </div>

          <Card>
            <SectionHeader title="Top movers" right={<Pill tone="good">LIVE</Pill>} />
            <div className="hScroll" style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
              {movers.slice(0, 10).map((c, i) => (
                <CoinMiniCard
                  key={c.id}
                  c={c}
                  subtitle={`Mover • ${fmtUsd(c.mc || 0)}`}
                  tag={`#${i + 1}`}
                  accent={i % 2 === 0 ? "var(--primary)" : "var(--accent2)"}
                  onOpen={() => {
                    setSelectedCoinId(c.id);
                    setScreen("COIN");
                  }}
                />
              ))}
            </div>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <SectionHeader title="Moon shooter" right={<Pill tone="warn">+15% 🚀</Pill>} />
            <div className="hScroll" style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
              {moonshots.slice(0, 10).map((c, i) => (
                <CoinMiniCard
                  key={c.id}
                  c={c}
                  subtitle={`Moon • ${fmtUsd(c.mc || 0)}`}
                  tag="MOON"
                  accent={i % 2 === 0 ? "var(--warn)" : "var(--accent2)"}
                  onOpen={() => {
                    setSelectedCoinId(c.id);
                    setScreen("COIN");
                  }}
                />
              ))}
            </div>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <SectionHeader title="Top volume" right={<Pill tone="warn">Hot</Pill>} />
            <div className="hScroll" style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
              {topVolume.slice(0, 10).map((c, i) => (
                <CoinMiniCard
                  key={c.id}
                  c={c}
                  subtitle={`Volume • ${Number(c.volumeSol || 0).toFixed(2)} SOL`}
                  tag="VOL"
                  accent={i % 3 === 0 ? "var(--warn)" : "var(--primary)"}
                  onOpen={() => {
                    setSelectedCoinId(c.id);
                    setScreen("COIN");
                  }}
                />
              ))}
            </div>
          </Card>
        </div>
      );

      const page2 = (
        <div>
          <Title
            sub="Quick actions + discovery shortcuts"
            right={<MiniBtn onClick={() => setScreen("LATEST")}>Open Latest</MiniBtn>}
          >
            Highlights
          </Title>

          <Card>
            <SectionHeader title="Quick actions" />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <MiniBtn tone="good" onClick={() => setScreen("CREATE")}>
                ✦ Create coin
              </MiniBtn>
              <MiniBtn onClick={() => setScreen("SEARCH")}>⌕ Search</MiniBtn>
              <MiniBtn onClick={() => setScreen("PROFILE")}>👤 Profile</MiniBtn>
              <MiniBtn onClick={() => setScreen("SETTINGS")}>⚙ Settings</MiniBtn>
            </div>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <SectionHeader title="Top movers (shortcut)" right={<Pill>10</Pill>} />
            <div className="hScroll" style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
              {movers.slice(0, 10).map((c, i) => (
                <CoinMiniCard
                  key={c.id}
                  c={c}
                  subtitle="Top mover"
                  tag="MOVE"
                  accent={i % 2 === 0 ? "var(--primary)" : "var(--accent2)"}
                  onOpen={() => {
                    setSelectedCoinId(c.id);
                    setScreen("COIN");
                  }}
                />
              ))}
            </div>
          </Card>
        </div>
      );

      content = (
        <ScreenShell>
          <Pager pages={[page1, page2]} pageIndex={homePage} setPageIndex={setHomePage} />
        </ScreenShell>
      );
    }

    if (screen === "SEARCH") {
      content = (
        <ScreenShell>
          <Title sub="Search + top volume">Search</Title>

          <Input
            label="Search for a coin"
            value={searchQ}
            onChange={setSearchQ}
            placeholder="type name or symbol…"
            rightIcon={<span style={{ fontWeight: 950 }}>⌕</span>}
          />

          <Card>
            <SectionHeader
              title={searchQ.trim() ? `Results (${searchResults.length})` : "Top volume"}
              right={<Pill tone="good">Live</Pill>}
            />
            <div className="miniScroll" style={{ maxHeight: 360, paddingRight: 6, display: "grid", gap: 10 }}>
              {(searchQ.trim() ? searchResults : topVolume.slice(0, 20)).map((c) => (
                <CoinRow
                  key={c.id}
                  c={c}
                  onClick={() => {
                    setSelectedCoinId(c.id);
                    setScreen("COIN");
                  }}
                />
              ))}
              {searchQ.trim() && searchResults.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 12 }}>No results</div>
              ) : null}
            </div>
          </Card>
        </ScreenShell>
      );
    }

    if (screen === "LATEST") {
      content = (
        <ScreenShell>
          <Title
            sub="Discovery screen"
            right={
              <MiniBtn onClick={loadCoins} disabled={loadingCoins}>
                {loadingCoins ? "…" : "Reload"}
              </MiniBtn>
            }
          >
            Latest
          </Title>

          <Card>
            <SectionHeader title="Top movers" right={<Pill tone="good">Live</Pill>} />
            <div className="hScroll" style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
              {movers.slice(0, 10).map((c, i) => (
                <CoinMiniCard
                  key={c.id}
                  c={c}
                  subtitle="Top mover"
                  tag="MOVE"
                  accent={i % 2 === 0 ? "var(--primary)" : "var(--accent2)"}
                  onOpen={() => {
                    setSelectedCoinId(c.id);
                    setScreen("COIN");
                  }}
                />
              ))}
            </div>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <SectionHeader title="Moon shooter" right={<Pill tone="warn">+15% 🚀</Pill>} />
            <div className="hScroll" style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
              {moonshots.slice(0, 10).map((c, i) => (
                <CoinMiniCard
                  key={c.id}
                  c={c}
                  subtitle="Moon"
                  tag="MOON"
                  accent={i % 2 === 0 ? "var(--warn)" : "var(--accent2)"}
                  onOpen={() => {
                    setSelectedCoinId(c.id);
                    setScreen("COIN");
                  }}
                />
              ))}
            </div>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <SectionHeader title="Top volume" right={<Pill tone="warn">SOL</Pill>} />
            <div className="hScroll" style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
              {topVolume.slice(0, 10).map((c, i) => (
                <CoinMiniCard
                  key={c.id}
                  c={c}
                  subtitle={`Volume • ${Number(c.volumeSol || 0).toFixed(2)} SOL`}
                  tag="VOL"
                  accent={i % 3 === 0 ? "var(--warn)" : "var(--primary)"}
                  onOpen={() => {
                    setSelectedCoinId(c.id);
                    setScreen("COIN");
                  }}
                />
              ))}
            </div>
          </Card>
        </ScreenShell>
      );
    }

    if (screen === "COIN") {
      if (!selectedCoin) {
        content = (
          <ScreenShell>
            <Title sub="Pick from Market">No coin selected</Title>
            <GhostButton onClick={() => setScreen("HOME")}>Go to Market</GhostButton>
          </ScreenShell>
        );
      } else {
        const c = selectedCoin;
        const isLiveNow = c.status === "LIVE";
        const txMarkers = myTxList.filter((t) => t.coinId === c.id).slice(0, 20);

        const myHoldingForCoin =
          myHoldingsList.find((h) => h.coinId === c.id)?.amount || 0;

        const totalSupply = Number(c.totalSupply || 0);
        const myPct =
          totalSupply > 0 ? (Number(myHoldingForCoin || 0) / totalSupply) * 100 : 0;

        content = (
          <ScreenShell fullBleed>
            <Title
              sub={
                <span style={{ color: "var(--muted2)" }}>
                  Coin: <b style={{ color: "var(--text)" }}>{shortWallet(c.id)}</b>
                </span>
              }
              right={
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <MiniBtn onClick={() => setScreen("HOME")}>Back</MiniBtn>
                  <MiniBtn onClick={() => copyText(c.id)} tone="warn">
                    Copy ID
                  </MiniBtn>
                </div>
              }
            >
              <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                <CoinLogo c={c} size={30} />
                <span>
                  {c.name} <span style={{ color: "var(--muted)" }}>({c.symbol})</span>
                </span>
              </span>
            </Title>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <Pill>Status: {c.status}</Pill>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Pill>MC: {fmtUsd(c.mc || 0)}</Pill>
                <Pill>ATH: {fmtUsd(c.ath || 0)}</Pill>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <Pill>Supply: {Number(totalSupply || 0).toFixed(2)}</Pill>
              <Pill tone="warn">Your: {Number(myHoldingForCoin || 0).toFixed(2)}</Pill>
              <Pill tone={myPct >= 20 ? "danger" : "good"}>Share: {myPct.toFixed(2)}%</Pill>
            </div>

            <PriceChart
              points={c.chart}
              txMarkers={txMarkers}
              mode={chartMode}
              onToggleMode={() => setChartMode((m) => (m === "dark" ? "light" : "dark"))}
            />

            <div style={{ height: 12 }} />

            <Card>
              <div style={{ fontWeight: 950, marginBottom: 8 }}>Trade</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <MiniBtn
                  onClick={() => {
                    setTradeSide("BUY");
                    setTradeSol("0.05");
                    setTradeOpen(true);
                  }}
                  tone="warn"
                >
                  Buy
                </MiniBtn>
                <MiniBtn
                  disabled={!isLiveNow}
                  onClick={() => {
                    setTradeSide("SELL");
                    setTradeSol("0.05");
                    setTradeOpen(true);
                  }}
                  tone="danger"
                >
                  Sell
                </MiniBtn>

                <Pill>On-chain SOL: {balance} SOL</Pill>
<Pill>Demo Mode: Trades are simulated (no SOL spent)</Pill>

                <Pill>Your tokens: {Number(myHoldingForCoin).toFixed(2)}</Pill>
              </div>
              <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
                Fee note: Buy/Sell fee (1%) backend split: 40% Dev • 40% Creator • 10% Referral • 10% Reserve
              </div>
            </Card>

            <Modal
              open={tradeOpen}
              title={`${tradeSide === "BUY" ? "Buy" : "Sell"} ${c.symbol}`}
              onClose={() => (tradeLoading ? null : setTradeOpen(false))}
              onConfirm={async () => {
                if (tradeLoading) return;
                await doTrade(c, tradeSide, tradeSol);
                setTradeOpen(false);
              }}
              confirmText={tradeLoading ? "..." : tradeSide === "BUY" ? "Confirm Buy" : "Confirm Sell"}
              confirmTone={tradeSide === "BUY" ? "primary" : "danger"}
            >
              <Input
                label="Amount (SOL)"
                value={tradeSol}
                onChange={setTradeSol}
                placeholder="e.g. 0.05"
                type="number"
              />
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                Real on-chain later. Abhi backend demo tracking.
              </div>
            </Modal>

            <div style={{ height: 10 }} />
            <GhostButton onClick={() => setScreen("HOME")}>Back to Market</GhostButton>
          </ScreenShell>
        );
      }
    }

    if (screen === "CREATE") {
      content = (
        <ScreenShell>
          <Title sub="Fees & supply hidden. Create = first buy.">Create Coin</Title>

          <Input label="Coin name" hint="2–32" value={tokenName} onChange={setTokenName} placeholder="e.g. Kashif" maxLength={32} error={nameErr} />
          <Input label="Symbol" hint="A-Z/0-9" value={symbolUpper} onChange={setSymbol} placeholder="e.g. ABK" maxLength={10} error={symErr} />
          <Input label="Initial SOL" hint="0 or 0.01+" value={initialSol} onChange={setInitialSol} placeholder="0 or 0.01+" type="number" error={solErr} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <Pill>Status: {isFree ? "DRAFT" : "LIVE"}</Pill>
            <Pill>Your Bal: {balance} SOL</Pill>
            <Pill>On live MC: ${STARTING_MC_USD.toLocaleString()}</Pill>
          </div>

          <Card>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: 20, border: "1px solid var(--border)", background: "rgba(0,0,0,.18)", overflow: "hidden", display: "grid", placeItems: "center" }}>
                {logoPreview ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "var(--muted)", fontSize: 12 }}>Logo</span>}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>Logo (≤ 5MB)</div>
                <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => onPickLogo(e.target.files?.[0])} style={{ width: "100%", color: "var(--muted)" }} />
                <div style={{ marginTop: 6, color: logoError ? "var(--danger)" : "var(--muted)", fontSize: 12 }}>
                  {logoError ? logoError : (logoPreview ? "Selected ✅" : "Required")}
                </div>
              </div>
            </div>
          </Card>

          <div style={{ height: 12 }} />
          <Textarea label="Your coin story" value={story} onChange={setStory} placeholder="20+ chars story..." maxLength={300} error={storyErr} />

          <div style={{ marginBottom: 12, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
            Create fee note (1%): 70% Dev • 20% Referral • 10% Reserve. Remaining amount = first buy (backend logic).
          </div>

          <PrimaryButton disabled={!canCreate} onClick={() => setConfirmOpen(true)}>
            Review & Create
          </PrimaryButton>

          <div style={{ height: 10 }} />
          <GhostButton onClick={() => setScreen("HOME")}>Back</GhostButton>

          <Modal
            open={confirmOpen}
            title="Confirm coin"
            onClose={() => setConfirmOpen(false)}
            onConfirm={async () => {
              setConfirmOpen(false);
              if (!solAddr) return showToast("Wallet not ready");

              const payload = {
                name: tokenName.trim(),
                symbol: symbolUpper.trim(),
                story: story.trim(),
                logo: logoPreview,
                initialSol: Number(initialSol || 0),
                creatorWallet: solAddr,
              };

              const res = await apiPost("/api/coin/create", payload);
              if (!res?.ok) return showToast(res?.error || "Create failed");

              const created = ensureCoinShape(res.coin);
              setCoins((p) => [created, ...p]);

              setTokenName("");
              setSymbol("");
              setStory("");
              setInitialSol("0.01");
              setLogoPreview("");
              setLogoError("");

              setSelectedCoinId(created.id);
              setScreen("COIN");
              showToast("Coin created ✅");
              loadProfile();
            }}
            confirmText="Create"
          >
            <Card>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 54, height: 54, borderRadius: 20, border: "1px solid var(--border)", overflow: "hidden", background: "rgba(0,0,0,.18)" }}>
                  {logoPreview ? <img src={logoPreview} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 950 }}>{tokenName || "—"}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{symbolUpper || "—"}</div>
                </div>
                <Pill>{Number(initialSol) >= 0.01 ? "LIVE" : "DRAFT"}</Pill>
              </div>
            </Card>
          </Modal>
        </ScreenShell>
      );
    }

    if (screen === "PROFILE") {
      const holdingsEnriched = myHoldingsList
        .map((h) => {
          const coin = coinsSorted.find((c) => c.id === h.coinId);
          const supply = Number(coin?.totalSupply || 0);
          const amt = Number(h.amount || 0);
          const pct = supply > 0 ? (amt / supply) * 100 : 0;
          return { ...h, coin, supply, amt, pct };
        })
        .filter((x) => x.amt > 0.0000001);

      content = (
        <ScreenShell allowYScroll={true}>
          <Title
            sub="Wallet • networks • rewards • holdings • tx"
            right={<MiniBtn onClick={() => setScreen("SETTINGS")}>⚙ Settings</MiniBtn>}
          >
            Profile
          </Title>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Wallet</div>
                <div style={{ fontSize: 12, wordBreak: "break-all" }}>{solAddr || "Creating…"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Balance</div>
                <div style={{ fontWeight: 950 }}>{balance} SOL</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <MiniBtn disabled={!solAddr} onClick={() => solAddr && copyText(solAddr)}>Copy</MiniBtn>
              <MiniBtn disabled={!solAddr || loadingBal} onClick={refreshBalance}>{loadingBal ? "…" : "Refresh"}</MiniBtn>
              <MiniBtn disabled={!solAddr || loadingProfile} onClick={loadProfile}>{loadingProfile ? "…" : "Reload"}</MiniBtn>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <MiniBtn tone="good" disabled={!solAddr} onClick={openDeposit}>💳 Deposit</MiniBtn>
              <MiniBtn tone="warn" disabled={!solAddr} onClick={openWithdraw}>⬇ Withdraw</MiniBtn>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ padding: 12, borderRadius: 16, border: "1px solid var(--border)", background: "rgba(255,255,255,.03)" }}>
              <div style={{ fontWeight: 950, marginBottom: 10 }}>Networks</div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <NetLogo chain="solana" />
                    <div style={{ fontWeight: 900 }}>Solana</div>
                  </div>
                  <Pill tone="good">Active</Pill>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, opacity: 0.85 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <NetLogo chain="bnb" />
                    <div style={{ fontWeight: 900 }}>BNB</div>
                  </div>
                  <Pill>Coming soon</Pill>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, opacity: 0.85 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <NetLogo chain="polygon" />
                    <div style={{ fontWeight: 900 }}>Polygon</div>
                  </div>
                  <Pill>Coming soon</Pill>
                </div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ padding: 12, borderRadius: 16, border: "1px solid var(--border)", background: "rgba(255,255,255,.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 950 }}>Your referral link</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>
                    {myReferralLink ? myReferralLink : "Wallet loading…"}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill>Referral reward: 20%</Pill>
                    {refStatus ? (
                      <Pill>
                        {refStatus === "set"
                          ? "Referral applied ✅"
                          : refStatus === "already"
                          ? "Referral locked"
                          : "Referral invalid"}
                      </Pill>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <MiniBtn disabled={!myReferralLink} onClick={() => myReferralLink && copyText(myReferralLink)}>Copy</MiniBtn>
                </div>
              </div>
            </div>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Referral rewards</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill>Total: {Number(myReferralRewardsSol || 0).toFixed(6)} SOL</Pill>
              <Pill>Rate: 20%</Pill>
            </div>

            <div style={{ height: 10 }} />
            <MiniBtn
              tone="good"
              disabled={oneClickW !== "" || Number(myReferralRewardsSol || 0) <= 0}
              onClick={() => oneClickWithdraw("REF")}
            >
              {oneClickW === "REF" ? "Withdrawing…" : "Withdraw (one click → main wallet)"}
            </MiniBtn>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Creator rewards</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Pill>Total: {Number(myRewards.totalSol || 0).toFixed(6)} SOL</Pill>
              <Pill>Coins: {Object.keys(myRewards.byCoin || {}).length}</Pill>
            </div>

            <div style={{ height: 10 }} />
            <MiniBtn
              tone="good"
              disabled={oneClickW !== "" || Number(myRewards.totalSol || 0) <= 0}
              onClick={() => oneClickWithdraw("CREATOR")}
            >
              {oneClickW === "CREATOR" ? "Withdrawing…" : "Withdraw (one click → main wallet)"}
            </MiniBtn>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>My holdings</div>
            <div className="miniScroll" style={{ maxHeight: 320, paddingRight: 6, display: "grid", gap: 10 }}>
              {holdingsEnriched.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 12 }}>No holdings yet.</div>
              ) : (
                holdingsEnriched.map((h) => (
                  <div
                    key={h.coinId}
                    style={{
                      padding: 12,
                      borderRadius: 18,
                      border: "1px solid var(--border)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.14)), var(--card2)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <CoinLogo c={h.coin || { symbol: "?" }} size={38} />
                      <div>
                        <div style={{ fontWeight: 950, lineHeight: 1.1 }}>
                          {h.coin?.name || "Unknown"}{" "}
                          <span style={{ color: "var(--muted)" }}>
                            ({h.coin?.symbol || "—"})
                          </span>
                        </div>
                        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
                          Last: {h.lastAt ? fmtTime(h.lastAt) : "—"}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 950 }}>{Number(h.amt || 0).toFixed(2)}</div>
                      <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
                        {h.supply > 0 ? `${h.pct.toFixed(2)}% of supply` : "supply —"}
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <MiniBtn
                          onClick={() => {
                            setSelectedCoinId(h.coinId);
                            setScreen("COIN");
                          }}
                          tone="warn"
                          style={{ padding: "8px 10px", borderRadius: 12 }}
                        >
                          Open
                        </MiniBtn>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Last transactions</div>
            <div className="miniScroll" style={{ maxHeight: 320, paddingRight: 6, display: "grid", gap: 10 }}>
              {myTxList.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 12 }}>No transactions yet.</div>
              ) : (
                myTxList.slice(0, 30).map((t) => {
                  const coin = coinsSorted.find((c) => c.id === t.coinId);
                  const side = String(t.side || "").toUpperCase();
                  return (
                    <div
                      key={t.id || `${t.coinId}-${t.t}`}
                      style={{
                        padding: 12,
                        borderRadius: 18,
                        border: "1px solid var(--border)",
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,.03), rgba(0,0,0,.14)), var(--card2)",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <CoinLogo c={coin || { symbol: "?" }} size={38} />
                        <div>
                          <div style={{ fontWeight: 950 }}>
                            {coin?.symbol || "—"}{" "}
                            <span style={{ color: "var(--muted)" }}>
                              {coin?.name ? `• ${coin.name}` : ""}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
                            {t.t ? fmtTime(t.t) : "—"}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <Pill tone={side === "SELL" ? "danger" : "good"}>
                          {side || "TX"}
                        </Pill>
                        <div style={{ marginTop: 8, fontWeight: 950 }}>
                          {Number(t.sol || 0).toFixed(4)} SOL
                        </div>
                        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
                          Fee: {Number(t.feeSol || 0).toFixed(6)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <div style={{ height: 12 }} />
          <GhostButton onClick={logout}>Logout</GhostButton>
        </ScreenShell>
      );
    }

    if (screen === "SETTINGS") {
      content = (
        <ScreenShell>
          <Title sub="Theme + Wallet backup" right={<MiniBtn onClick={() => setScreen("PROFILE")}>Back</MiniBtn>}>
            Settings
          </Title>

          <Card>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Theme</div>
            <div style={{ display: "grid", gap: 10 }}>
              <ThemeOption theme="neon" current={theme} setTheme={setTheme} label="Neon" />
              <ThemeOption theme="ocean" current={theme} setTheme={setTheme} label="Ocean" />
              <ThemeOption theme="rose" current={theme} setTheme={setTheme} label="Rose" />
              <ThemeOption theme="royal" current={theme} setTheme={setTheme} label="Royal" />
              <ThemeOption theme="sunset" current={theme} setTheme={setTheme} label="Sunset" />
              <ThemeOption theme="lightgreen" current={theme} setTheme={setTheme} label="Light Green" badge="New" />
            </div>
          </Card>

          <div style={{ height: 12 }} />

          <Card>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Wallet Backup</div>
            <div style={{ color: "var(--warn)", fontSize: 12, lineHeight: 1.5 }}>
              ⚠️ Warning: Apni private key / recovery phrase kisi ko mat dena. Backup sirf apne paas safe rakho.
            </div>
            <div style={{ height: 10 }} />
            <MiniBtn onClick={openPrivyBackup}>Open Backup</MiniBtn>
          </Card>

          <div style={{ height: 12 }} />
          <GhostButton onClick={logout}>Logout</GhostButton>
        </ScreenShell>
      );
    }
  }

  return (
    <>
      <ThemeStyles />
      {content}
      {ready && authenticated ? <BottomNav screen={screen} setScreen={setScreen} /> : null}
      <Toast msg={toast} />

      <Modal
        open={dwOpen}
        title={dwMode === "DEPOSIT" ? "Solana Deposit Address" : "Solana Withdraw"}
        onClose={() => setDwOpen(false)}
        onConfirm={async () => {
          if (dwMode === "DEPOSIT") {
            if (!solAddr) return;
            await copyText(solAddr);
            return;
          }
          const to = String(withdrawTo || "").trim();
          if (to.length < 20) return showToast("Paste valid address");

          const res = await apiPostTry(
            ["/api/withdraw", "/api/withdraw/manual", "/api/transfer", "/api/payout"],
            { wallet: solAddr, to, kind: "MANUAL" }
          );

          if (res?.ok) {
            showToast("Withdraw confirmed ✅");
            setDwOpen(false);
            await loadProfile();
            await refreshBalance();
          } else {
            showToast(res?.error || "Withdraw failed");
          }
        }}
        confirmText={dwMode === "DEPOSIT" ? "Copy address" : "Confirm"}
      >
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Network</div>
              <div style={{ fontWeight: 950, display: "flex", gap: 10, alignItems: "center" }}>
                <NetLogo chain="solana" /> Solana
              </div>
            </div>
            <Pill tone="good">{dwMode === "DEPOSIT" ? "Deposit" : "Withdraw"}</Pill>
          </div>

          <div style={{ height: 12 }} />

          {dwMode === "DEPOSIT" ? (
            <>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Address</div>
              <div
                style={{
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,.18)",
                  fontSize: 12,
                  wordBreak: "break-all",
                }}
              >
                {solAddr || "—"}
              </div>

              <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                Is address par SOL send karo. (Auto-copy ho chuka hai.)
              </div>
            </>
          ) : (
            <>
              <Input
                label="Withdraw to (destination address)"
                value={withdrawTo}
                onChange={setWithdrawTo}
                placeholder="Paste Solana address…"
              />
              <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                Manual withdraw: destination paste karo. (On-chain later)
              </div>
            </>
          )}
        </Card>
      </Modal>
    </>
  );
}
