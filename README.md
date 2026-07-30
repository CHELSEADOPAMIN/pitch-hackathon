# Pinch Voice Shopping

Android-only hackathon MVP for hands-free shopping. A customer speaks naturally
while viewing a live camera finder, and the app captures a frame when product
context is needed. OpenAI
Realtime calls the single `shopping_agent` tool, and the server uses a
`gpt-5.6-sol` agent to read or mutate the authoritative cart. Checkout always
returns an exact quote first and charges through Pinch sandbox only after explicit
confirmation.

## Prerequisites

- Node.js `22.16.0` (`nvm use`)
- An Android development build; Expo Go is not supported because the app uses
  `react-native-webrtc`
- A Postgres/Supabase database with the five tables managed by
  `server/db/schema.ts`
- Pinch sandbox and OpenAI API credentials

Copy `.env.example` to `.env` and provide the required values. Never place a Pinch
secret or OpenAI key in an `EXPO_PUBLIC_*` variable. The Pinch publishable key is
the only Pinch credential embedded in the app.

For the final Android build, keep the complete server and client configuration in
`.env`, then run:

```bash
npm run final:env:check
npm run final:prebuild
npm run final:android
```

The final-build wrapper validates every server value, maps
`PINCH_PUBLISHABLE_KEY` to `EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY`, and injects only
the public API URL and publishable key into the APK. It fails before compilation
if the environment is incomplete or the client and server Pinch keys differ.

All Pinch credentials must use sandbox prefixes and
`PINCH_API_BASE_URL=https://api.getpinch.com.au/test`. Set `DATABASE_SCHEMA` to
the schema used by the deployment. It defaults to `public`; the isolated Codex
test deployment uses `codex_voice`.

## Run locally

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

The API listens on port `8787`. On a physical Android device, Metro's host address
is used automatically; set `EXPO_PUBLIC_API_URL` when the API is exposed at a
different address.

Create or install the development APK, then start Metro with:

```bash
npx expo start --dev-client
```

The first login creates the real Pinch sandbox payer. If the account has no saved
source, the native card form validates the number, expiry, and CVC locally, then
sends card data directly to Pinch `/test/tokens`; the server receives only the
temporary token. Development and Preview builds enable a visible shopper/merchant
switch and sign-out control through `EXPO_PUBLIC_ENABLE_DEMO_CONTROLS=1`.

## Verification

```bash
npm run verify
RUN_DB_INTEGRATION=1 npm test -- tests/integration/database.test.ts
npx expo export --platform android
```

`npm run verify` runs strict TypeScript, ESLint, and Vitest. The checkout tests
cover quote expiry, cart changes, declined payments, retries, and concurrent
confirmation so one quote cannot be charged twice in the supported single-server
process.

## Production-style server run

Build the server and run the compiled JavaScript:

```bash
npm run server:build
npm run server:production
```

Example systemd and nginx configurations are in `deploy/`. Copy and edit them for
the target host rather than using the example domain or paths verbatim. The
`/api/health` endpoint checks both PostgreSQL and Pinch sandbox authentication; it
returns HTTP 503 with `status: "degraded"` when either dependency is unavailable.

Create the Android development APK with:

```bash
npx eas-cli build --platform android --profile development
```

## Deliberate MVP boundaries

- Android only
- Username login and the staff/customer switch are development conveniences
- Product catalog and merchant are seeded
- No fake payment success, QR/barcode flow, webhook, sideband channel, WebSocket,
  SSE, or app-side Supabase access
- Payment quote coordination is in-memory and single-process with a five-minute
  TTL. Within that process, an approved payment is cached until its idempotent
  order write succeeds, so a retry does not charge the quote twice.
