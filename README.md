# Pinch Voice Shopping

Android-only hackathon MVP for hands-free shopping. A customer speaks naturally,
the app can capture a hidden camera frame when product context is needed, OpenAI
Realtime calls the single `shopping_agent` tool, and the server uses a
`gpt-5.6-terra` agent to read or mutate the authoritative cart. Checkout always
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
source, the native card form sends card data directly to Pinch `/test/tokens`; the
server receives only the temporary token. The role switch in the app is a
development-only convenience for viewing the customer and staff flows.

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
- Payment quote coordination is intentionally in-memory and single-process with a
  five-minute TTL
