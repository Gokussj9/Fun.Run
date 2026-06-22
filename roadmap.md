# Fun.Run — Real Platform Roadmap
### Maqsad: pump.fun-jaisa REAL, SOLVENT, SAFE Solana meme launchpad

> Is roadmap ka asool: **har withdrawable balance real SOL se backed ho, aur users ka paisa bug aane par bhi safe rahe.**
> Claude Code: is file ko reference rakho. Ek waqt mein ek step — pehle PLAN, phir diff, phir review, phir apply. Money code pe hamesha review (auto-accept nahi). Har bara step pehle **Solana devnet** pe test, phir mainnet.

---

## Bunyaadi Usool (har step pe yaad rakhna)
1. **No phantom balance** — jo balance withdraw ho sakta hai wo real SOL se 1:1 backed ho.
2. **Airdrop ≠ real SOL** — 700k RUN airdrop alag (`run_tokens`), SOL ke tor pe withdrawable NAHI.
3. **Real SOL movement** — har buy/sell pe real SOL waqai move ho, sirf DB number nahi.
4. **Solvency hamesha** — total withdrawable obligations ≤ total real SOL held.
5. **Self-custodial direction** — aakhir mein users apne funds khud control karein (Privy), taake platform unke funds hold hi na kare.
6. **No single point of failure** — funds ek hi wallet mein pool mat karo.

---

## Current State (jahan abhi hain)
- Wallets: **custodial** (encrypted mnemonics DB mein) — risk.
- Trading: **virtual** (vSol=30, real SOL ≈ 0) — profits unbacked.
- `run_balance`: real deposits + 700k airdrop + virtual profits sab mile hue — **insolvent**.
- Withdraw: treasury se (empty) — **broken**.
- Security hardening: **done** ✅ (atomic claims, withdraw idempotency, kill switch, limits, startup reconciliation, secrets fail-fast).

---

## PHASE 0 — Foran Safety (abhi, sabse pehle)
*Maqsad: system ko solvent + safe banana. Koi launch nahi jab tak trading real na ho.*

- [ ] **0.1** Withdrawals OFF rakho (`WITHDRAWALS_ENABLED=0`) jab tak Phase 1 mukammal na ho.
- [ ] **0.2** 700k RUN airdrop ko `run_balance` se ALAG karo → naya `run_tokens` field. `run_tokens` SOL ke tor pe withdrawable NAHI, frontend ke mutabiq locked till 2027.
- [ ] **0.3** Existing users ki **migration**: current `run_balance` ko alag karo → (a) real SOL (deposits + claimed rewards) (b) `run_tokens` (airdrop + referral RUN bonus). Backup table + DB transaction + **dry-run review** ke saath. Real SOL ka sabse reliable source = **on-chain custodial wallet balance**.
- [ ] **0.4** 3000 users ko launch MAT karo jab tak Phase 1 + devnet testing complete na ho.

---

## PHASE 1 — Trading ko REAL banao (abhi custodial rahega — sabse bara kaam)
*Maqsad: har trade pe real SOL move ho, har balance backed ho. Yahi solvency deta hai.*

- [ ] **1.1** Har coin ka apna **real reserve** (per-coin SOL reserve account) — jahan us coin ka real SOL jama ho.
- [ ] **1.2 Buy:** user ke wallet se **real SOL → coin reserve** (real on-chain transfer). Bonding curve math (virtual reserves sirf pricing ke liye, jaise pump.fun) se tokens calculate.
- [ ] **1.3 Sell:** user ke tokens → curve; **coin reserve se real SOL → user** (real transfer).
- [ ] **1.4 Fees:** real SOL mein (40% owner / 40% creator / 20% referral), real transfer/accrual ke saath.
- [ ] **1.5 Create coin:** real SOL fee + SPL token mint.
- [ ] **1.6 Withdraw:** user ke **apne wallet** se (jahan ab real SOL hai). Dual gate: `run_balance` entitlement + on-chain balance. **Treasury pool nahi.**
- [ ] **1.7 Solvency monitor job:** periodic check — total withdrawable balance vs total real SOL. Mismatch pe alert + auto kill-switch.

---

## PHASE 2 — Self-custodial (Privy embedded) — pump.fun ka asal model
*Maqsad: platform logon ke funds hold hi na kare. Jo paisa tumhare paas hai hi nahi, wo bug/hack se nahi jaa sakta.*

- [ ] **2.1** Privy embedded **self-custodial** wallets enable karo (Privy already use ho raha hai).
- [ ] **2.2** Naye users → Privy self-custodial wallet (DB mein encrypted mnemonic nahi).
- [ ] **2.3** Trades user ke apne wallet se sign hon (Privy signing).
- [ ] **2.4** Existing custodial users ke liye migration path (apne wallet mein move/export).
- [ ] **2.5** `ENCRYPTION_KEY` / mnemonic storage phase out.

---

## PHASE 3 — Graduation (jab coin bara ho)
- [ ] **3.1** Threshold pe coin ki liquidity real DEX (Raydium/Orca) pe migrate, real LP ke saath.
- [ ] **3.2** Graduated coins curve se DEX trading pe shift.

---

## Cross-cutting (har phase ke saath chalega)
- **Devnet first:** har change pehle Solana **devnet** pe test, phir mainnet.
- **Audit logs:** har real SOL movement immutably log (`audit_logs`).
- **Soft launch:** chhoti limits se shuru, monitor, phir barhao.
- **No fund pooling:** ek single wallet mein sab funds mat rakho.

---

## Ahem Faisla (Phase 1 vs seedha Phase 2)
Do raaste hain — apni capacity ke hisaab se chuno:
- **Raasta 1 (pragmatic):** pehle Phase 1 (real trading, custodial) → solvency jaldi → phir Phase 2 (self-custodial). Asaan-incremental, par Phase 1 ka kuch kaam baad mein replace hoga.
- **Raasta 2 (final, zyada kaam):** seedha self-custodial + on-chain bonding curve (pump.fun ka asal). Zyada mushkil (Solana program / Anchor, Privy signing) aur ehtiyaat ke saath audit, lekin end-state. Interim throwaway kaam nahi.

> Solo dev ke liye aam tor pe **Raasta 1** zyada realistic hai — par faisla tumhara.

---

## Kaam ka Tareeqa (Claude Code ke liye)
1. Is roadmap ko CLAUDE.md / memory mein reference rakho.
2. **Ek step at a time** — PLAN → diff → review → apply.
3. **Money/fund code pe hamesha manual review** (kabhi "allow all edits" nahi).
4. Har bara step: **devnet test → confirm → mainnet**.
5. Har phase ke aakhir mein **solvency check**: total withdrawable ≤ total real SOL.

---

## Status Tracker

| Step | Status | Notes |
|------|--------|-------|
| **0.1** WITHDRAWALS_ENABLED=0 | ✅ Done | Set in Railway env |
| **Phase 0.5** Frontend RUN card fix | ✅ Done | runTokens from DB, referral bonus → Phase 2 |
| **0.2** run_tokens field alag karo | ✅ Done | `run_tokens numeric NOT NULL DEFAULT 0` — verified in Neon |
| **0.3** Migration (run_balance split) | ✅ Done | run_balance=0.00191 SOL, run_tokens=6.3M — backup: profiles_backup_phase03 |
| **0.4** Launch hold | ✅ Done | SIGNUP_AIRDROP_RUN=300k, run_balance default=0, run_tokens in INSERT |
| **1.1** Per-coin real reserve | ⏳ Pending | |
| **1.2** Real buy (SOL transfer) | ⏳ Pending | |
| **1.3** Real sell (SOL transfer) | ✅ Done (devnet) | |
| **1.4** Real fees | ⏳ Pending | |
| **1.5** Create coin (real fee) | ⏳ Pending | |
| **1.6** Withdraw from own wallet | ⏳ Pending | |
| **1.7** Solvency monitor | ⏳ Pending | |
| **2.1** Privy self-custodial | ⏳ Pending | |
| **2.2** New users → Privy wallet | ⏳ Pending | |
| **2.3** Privy signing for trades | ⏳ Pending | |
| **2.4** Custodial migration path | ⏳ Pending | |
| **2.5** ENCRYPTION_KEY phase out | ⏳ Pending | |
| **3.1** DEX graduation | ⏳ Pending | |
| **3.2** Curve → DEX shift | ⏳ Pending | |
