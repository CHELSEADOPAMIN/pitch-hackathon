# Pinch Voice Shopping

> An AI-powered self-checkout layer for retailers, powered by Pinch Payments.

Pinch Voice Shopping turns a merchant's existing mobile experience into a
camera-first, hands-free checkout. Shoppers point their phone at a product,
manage their basket by voice, receive an exact quote, and confirm payment
through Pinch. The merchant immediately receives the paid order for exit or
pickup verification.

**[Download the Android APK](https://drive.google.com/file/d/1fzy8Tskd67ucy3uU0GUKSWjI-1-cCjeX/view?usp=sharing)**

## The problem

Traditional checkout creates queues, requires dedicated hardware, and forces
customers through repeated product searches and manual cart interactions.
Building a custom scan-and-pay system is also expensive for individual
retailers: they need product recognition, conversational UX, payment security,
order integrity, and a merchant verification workflow.

## The solution

Pinch Voice Shopping is designed as an embeddable B2B checkout capability
rather than another consumer marketplace. A retailer can bring its own brand,
catalogue, and customer relationship while this layer provides:

- camera-assisted product identification;
- realtime voice cart management;
- an authoritative server-side basket and exact payment quote;
- secure payer and payment-source setup through Pinch;
- explicit confirmation before a Pinch realtime payment; and
- an immediately searchable paid-order view for staff.

The hackathon PoC packages the shopper and merchant experiences into one
Android app so the complete flow can be demonstrated today. The product
direction is to offer the same capability as an SDK and API that merchants can
integrate into their existing apps.

## End-to-end experience

### Shopper

1. Sign in and register a payment card through Pinch.
2. Point the camera at a product and speak naturally, for example:
   - “Add this.”
   - “Remove the milk.”
   - “What is in my cart?”
3. Receive an exact total before checkout.
4. Explicitly confirm the quoted amount.
5. Complete the payment through the Pinch sandbox.

### Merchant

1. Receive the order immediately after a successful Pinch payment.
2. Search by the shopper's name.
3. Verify the paid items, total, time, and Pinch payment ID.
4. Release the order to the shopper.

For the PoC, staff verification uses the shopper's name. A production
integration would use a signed receipt, order identifier, exit gate, or
camera-assisted verification.

## What works today

- Android customer and merchant experiences
- Live phone-camera capture and optional M02 smart-glasses capture
- Smart-glasses microphone and speaker routing for hands-free use
- Realtime, interruptible voice interaction
- Product identification against a merchant catalogue
- Voice-based add, remove, cart review, quote, and checkout
- Real Pinch sandbox payer, payment source, and realtime payment calls
- Direct card tokenisation: raw card details do not pass through our server
- Exact quote and explicit confirmation before payment
- Idempotent order creation and protection against duplicate confirmation
- Searchable merchant view containing only successfully paid orders
- PostgreSQL-backed users, products, carts, payment sources, and orders

## How we use Pinch

Pinch is the payment and payer infrastructure at the centre of the checkout:

1. The first sign-in creates a Pinch sandbox payer.
2. Card details are sent directly from the device to Pinch `/test/tokens`.
3. Our server receives only the temporary token and attaches the resulting
   source to the payer.
4. Checkout produces an exact, short-lived server quote.
5. After explicit user confirmation, the server calls Pinch
   `payments/realtime`.
6. A paid merchant order is created with the Pinch payment ID.

There is no fake payment-success path in the demonstrated flow.

## Architecture

```text
Android phone or M02 glasses
            |
            v
OpenAI Realtime voice session
            |
            v
Single shopping_agent tool
            |
            v
GPT-5.6 Sol agent
            |
            v
Authoritative cart and checkout service
       |                    |
       v                    v
PostgreSQL          Pinch sandbox APIs
       |
       v
Merchant paid-order view
```

OpenAI Realtime handles the low-latency conversation and calls a single
`shopping_agent` tool. The server-side `gpt-5.6-sol` agent identifies the
requested action and reads or mutates the authoritative cart. Checkout always
returns an exact quote first and charges through Pinch only after explicit
confirmation.

## Product direction

The PoC validates the core payment and shopping loop. The next phases are:

- a merchant SDK, API, and white-label components;
- catalogue, pricing, and inventory synchronisation;
- signed receipts and automated exit verification;
- store-camera integration that matches observed items with paid orders; and
- fully automated low-friction stores where staff intervention is the
  exception rather than the default.

## Run locally

### Prerequisites

- Node.js `22.16.0` (`nvm use`)
- An Android development build; Expo Go is not supported because the app uses
  `react-native-webrtc`
- PostgreSQL or Supabase
- Pinch sandbox and OpenAI API credentials

Copy `.env.example` to `.env` and provide the required values. Never place a
Pinch secret or OpenAI key in an `EXPO_PUBLIC_*` variable. The Pinch
publishable key is the only Pinch credential embedded in the app.

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

Install dependencies, initialise the database, seed the demo merchant and
catalogue, and start the API and app:

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

The API listens on port `8787`. On a physical Android device, Metro's host
address is used automatically. Set `EXPO_PUBLIC_API_URL` when the API is
exposed at a different address.

Create or install the development APK, then start Metro with:

```bash
npx expo start --dev-client
```

Development and Preview builds enable the shopper/merchant switch and sign-out
control through:

```text
EXPO_PUBLIC_ENABLE_DEMO_CONTROLS=1
```

## Verification

```bash
npm run verify
RUN_DB_INTEGRATION=1 npm test -- tests/integration/database.test.ts
npx expo export --platform android
```

`npm run verify` runs strict TypeScript, ESLint, Vitest, and the production
server build. Checkout tests cover quote expiry, cart changes, declined
payments, retries, and concurrent confirmation so one quote cannot be charged
twice in the supported single-server process.

## Production-style server run

```bash
npm run server:build
npm run server:production
```

Example systemd and nginx configurations are available in `deploy/`. The
`/api/health` endpoint checks both PostgreSQL and Pinch sandbox authentication
and returns HTTP 503 with `status: "degraded"` when either dependency is
unavailable.

Create an Android development APK with:

```bash
npx eas-cli build --platform android --profile development
```

## Deliberate MVP boundaries

- Android only
- Username sign-in and the in-app staff/customer switch are demo conveniences
- The merchant and catalogue are seeded for the PoC
- Staff currently verify paid orders by shopper name
- No webhook, barcode flow, sideband channel, WebSocket, SSE, or app-side
  Supabase access
- Payment quote coordination is in-memory and single-process with a five-minute
  TTL
