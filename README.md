# SONAR — behavioral security for Solana

SONAR is a hackathon project that interrupts impulsive transaction signing
with a forced cooldown and an AI voice agent that talks the user through
the specific risks.

> Existing crypto security tools fail because users ignore warnings.
> SONAR focuses on psychology instead of only detection.

## Pipeline

```
Frontend (demo dApp)
  ↓  POST /risk { wallet, transaction, type, scenario }
Wallet Interceptor      → validate payload
Transaction Simulator   → mock scenarios for MVP (Helius later)
Heuristic Scorer        → score 0..100 + findings
Cooldown Manager        → in-memory, gates /confirm
ElevenLabs Voice (TTS)  → narrates the risk during cooldown
Frontend Intervention UI
```

## Quick start

```sh
# 1. Install
cd backend
npm install

# 2. Configure (only one key required)
cp ../.env.example ../.env
# then edit .env and paste your ELEVENLABS_API_KEY

# 3. Run
npm run dev
```

Open `http://localhost:3000`. The frontend is served by Fastify static
from `/frontend`.

## Demo flow

1. (Optional) Click **Connect Wallet** — connects Phantom for an authentic
   wallet address. Skipping this still works; SONAR uses a placeholder.
2. Click any of the four scenario buttons:
   - **Drainer** — large SOL transfer to an unverified program
   - **Unlimited approval** — token approval with no limit
   - **Fake token** — receives an impersonation token
   - **Safe** — passes through with no warning
3. On a risky scenario, the **Intervention overlay** takes over:
   - Findings displayed by severity
   - ElevenLabs TTS narration auto-plays
   - Cooldown timer counts down before "Sign anyway" unlocks
   - "Cancel" is always available
4. Cancel = SONAR did its job. Confirm = transaction would be signed.

## Architecture decisions

| Decision | Choice | Why |
|---|---|---|
| Stack | Node + TypeScript + Fastify | First-class Solana SDKs, fast hackathon iteration |
| Risk engine | Mocked scenarios | Detection isn't the moat — the *intervention UX* is. Real Helius integration is post-hackathon. |
| Voice | ElevenLabs TTS | Plug-and-play (just an API key). `VoiceProvider` interface lets us drop in Conversational AI later without changing the risk engine. |
| Wallet integration | Phantom via `window.solana`; signing mocked | Demonstrates the flow without making the demo brittle on devnet RPC issues. |

## What's mocked vs real

- **Real**: full backend pipeline, scoring, cooldown, ElevenLabs TTS, frontend UX
- **Mocked**: transaction simulation (canned scenarios), final transaction signing

## Out of scope (per Part 2 of the spec)

ML scoring, reputation network, decentralized consensus, mobile app, social
graph, cross-chain intelligence, DAO/governance.

## File map

```
backend/
├── src/
│   ├── server.ts                   Fastify app
│   ├── config.ts                   env validation (zod)
│   ├── types.ts                    shared types
│   ├── routes/
│   │   ├── risk.ts                 POST /risk — pipeline orchestrator
│   │   ├── confirm.ts              POST /confirm — gates post-cooldown
│   │   └── voice.ts                GET /voice/:sessionId — audio stream
│   └── modules/
│       ├── interceptor.ts          payload validation
│       ├── simulator.ts            mock simulator (Helius later)
│       ├── scenarios.ts            canned demo scenarios
│       ├── scorer.ts               heuristic rules
│       ├── cooldown.ts             session map
│       └── voice.ts                VoiceProvider + TTSVoiceProvider
└── package.json

frontend/
├── index.html                      static page
├── style.css                       dark theme + intervention overlay
└── app.js                          fetches /risk, runs cooldown, plays audio
```
