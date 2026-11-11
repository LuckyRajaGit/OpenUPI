# OpenUPI Gateway — Self-Hosted UPI Checkout Platform

OpenUPI Gateway is an open, modular, self-hosted UPI payments and checkout platform. This expansion delivers all 9 production-grade subsystems: Universal JavaScript SDK (`openupi.js`), Dynamic QR Engine, Database-Backed Concurrency Payment Queue, Multi-Tier Auth & OTP Verification, Android Companion Device Architecture, COD Order Lifecycle, Offline POS & Cash Counter Terminal, White-Label Customization Engine, and an interactive Developer Experience suite with API docs, sample merchant store, and automated test runners.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during clarification and will govern the system architecture and user interface:

- **Confirmed Decision 1 (Hub & Layout)**: A unified merchant command center featuring a high-efficiency module switcher that seamlessly moves between live payment testing, cashier POS, Android companion monitoring, COD operations, and developer sandboxes.
- **Confirmed Decision 2 (Design & Theme)**: Modern fintech aesthetic (`Plus Jakarta Sans` / `JetBrains Mono` tabular figures, slate-900 canvas, refined neutral borderlines, zero-pill metadata discipline) with real-time white-label CSS token live-reloading.
- **Confirmed Decision 3 (Backend Architecture)**: Full-stack Node.js Express server running concurrently with Vite, exposing real REST API endpoints (`/api/v1/...`), serving standalone `openupi.js` SDK bundle, powering live queue processing, webhooks, and mock UPI provider adapters.

---

## 1. Overview & Core Concept

OpenUPI Gateway enables merchants, developers, and platform operators to accept UPI payments directly with zero intermediary lock-in while maintaining complete control over checkout flows, security, and hardware integrations.

- **Target Audience / Persona**: Merchants seeking low-fee direct UPI collections, retail operators needing combined UPI/Cash/Card POS counters, mobile and web developers embedding UPI checkout into apps, and store managers supervising COD delivery and companion device health.
- **Key Value**: A self-contained, sovereign payment platform with mock-first safety, dynamic intent generation, tamper-resistant Android companion telemetry, and white-label checkout customization.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Merchant Command & Navigation**: 
   - Left-rail navigation switcher with 9 distinct operational workspaces:
     - **Checkout & SDK Sandbox**: Live preview of desktop modal vs. mobile bottom drawer, testing HTML `data-openupi-*` attributes and programmatic `OpenUPI.open()` JavaScript calls.
     - **Dynamic QR Studio**: Real-time provider-generated QR generator with session expiration timers, mobile deep-link intent links (GPay, PhonePe, Paytm, BHIM), and webhook emission.
     - **Payment Concurrency Queue**: Visual live queue monitor showing real-time slot availability, pending sessions, queue position, duplicate transaction safeguards, and safe timeout expirations.
     - **Merchant & Customer Authentication**: Merchant API key manager, session token generator, and privacy-safe customer SMS/OTP phone verification simulator where secrets are kept strictly server-side.
     - **Android Companion Node**: Enrollment hub for Android nodes, device health metrics (battery, charging, network latency), cryptographic public key storage, and signed observation logs (clearly decoupled from bank settlement).
     - **COD Operations**: Order creation, address verification, merchant approval workflow, transit status updates, and COD reconciliation reports.
     - **Offline POS & Cash Counter**: High-speed cashier interface for physical retail, supporting split tender (Cash, UPI QR, external Card EDC terminal), receipt generation, and daily drawer reconciliation.
     - **White-Label Customizer**: Live visual theme builder adjusting brand logo, brand colors (`--primary`, `--primary-hover`), support email/phone, custom domain mapping, and instant modal preview.
     - **Developer Experience**: OpenAPI/REST documentation, SDK integration guides, webhook payload visualizer, downloadable Postman collection JSON, and interactive end-to-end unit/integration test runner.

2. **Customer Checkout Experience**:
   - Desktop view: Accessible modal with focus trapping, clean typography, payment method tabs, dynamic QR with countdown timer, and instant polling settlement.
   - Mobile view: Native-feeling bottom sheet drawer with direct deep-link intent buttons launching UPI apps with one tap.

### Visual Identity & Theme
- **Dominant Neutral Canvas**: Crisp dark slate canvas (`#0b0f19` and `#111827`) paired with clean light-mode capability, conforming to WCAG AA contrast standards.
- **Structural Surfaces**: Subtle 1px borders (`border-slate-800`), flat cards with single-elevation depth, no pill wrappers for metadata, and tabular figures for amounts (`₹1,499.00`).
- **Typography**: `Plus Jakarta Sans` for clean geometric headings and navigation, `Inter`/`system-ui` for readable form controls, and `JetBrains Mono` for payment references, transaction IDs, hashes, and API payloads.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Modular Service Architecture with In-Memory / File-Backed Persistent Store**:
  - *Chosen Approach*: Implement a structured, typed repository and service pattern in `server/` with persistent JSON/in-memory adapters and unified REST routing.
  - *Why*: Provides near-zero cold-start latency, requires zero external database daemon setup, runs effortlessly in containerized sandboxes, and allows instant reset and deterministic test fixtures.
- **Decision 2: Universal SDK Distribution via `/openupi.js`**:
  - *Chosen Approach*: The Express backend serves a standalone, zero-dependency browser script (`/openupi.js`) that attaches `window.OpenUPI` and auto-binds to `[data-openupi-checkout]` buttons.
  - *Why*: Merchants can integrate either by adding `<script src="/openupi.js"></script>` and HTML data attributes or via standard npm/modern ES module imports.
- **Decision 3: Android Companion Signed Observations Boundary**:
  - *Chosen Approach*: Enforce strict security separation where companion events are labeled "Notification Observed" signed with HMAC/Ed25519 signatures, explicitly isolated from "Bank Settlement Confirmed".
  - *Why*: SMS/notification listeners on companion Android devices are susceptible to spoofing; bank confirmation requires verified webhooks or direct bank server queries.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OpenUPI Gateway Platform                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
     ┌─────────────────────────────────┴─────────────────────────────────┐
     ▼                                                                   ▼
┌───────────────────────────┐                       ┌─────────────────────────┐
│     Client Web Portal     │                       │   Universal JS SDK      │
│  (React 19 + Tailwind v4) │                       │     (openupi.js)        │
│                           │                       │                         │
│ • Module Switcher Hub     │                       │ • Auto HTML Data-Bind   │
│ • POS Cashier Dashboard   │                       │ • Desktop Modal Flow    │
│ • Dynamic QR Studio       │                       │ • Mobile Drawer Flow    │
│ • Companion Node Manager  │                       │ • Polling & Callbacks   │
│ • White-Label Live Editor │                       │ • Zero-Dependency       │
│ • Developer API & Tests   │                       │                         │
└─────────────┬─────────────┘                       └────────────┬────────────┘
              │                                                  │
              │ REST / SSE                                       │ REST API
              ▼                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Express Full-Stack Server (/api/v1)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ • Auth & Phone OTP Service (HMAC Tokens, Secret Masking)                   │
│ • Payment Queue Engine (Atomic Concurrency Slots, Timeout Watchdog)         │
│ • Dynamic QR & Intent Provider Engine (NPCI spec, VPA validation)          │
│ • Android Node Cryptography Service (Key Enrollment, Telemetry Logger)     │
│ • Cash on Delivery (COD) Lifecycle & Approval Machine                      │
│ • POS Engine (Cash Register, Card EDC Terminal Mock, Tender Balancing)     │
│ • White-Label Configurator (CSS Variable Generator, Domain Resolver)       │
│ • Webhook Dispatcher & Developer Sandbox Service                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       In-Memory / File Database Store                       │
│  • Merchants • Sessions • Queue • Devices • Orders • POS Records • Webhooks │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Specifications & Services

1. **Universal JavaScript SDK (`openupi.js`)**:
   - Served at `/openupi.js`. Exposes `window.OpenUPI.configure({...})` and `window.OpenUPI.open({...})`.
   - Automatic DOM scanner queries `[data-openupi-amount]`, `[data-openupi-order-id]`, etc., and binds checkout triggers.
   - Emits structured events: `onOpen`, `onSuccess`, `onFailure`, `onClose`, and `onQueueWait`.
2. **Dynamic QR & Intent**:
   - Builds standard NPCI UPI payload: `upi://pay?pa={vpa}&pn={name}&am={amount}&tr={ref}&tn={note}&cu=INR`.
   - Real-time countdown timer (e.g. 5 minutes) with automatic expiration and re-issue.
   - Intent links for Google Pay (`gpay://`), PhonePe (`phonepe://`), Paytm (`paytmmp://`), and BHIM.
3. **Payment Queue**:
   - Concurrency manager limiting parallel in-flight payment sessions (configurable, e.g., 5 concurrent slots).
   - Real-time queue position notification (`position: 2 of 5 in line`).
   - Duplicate idempotency keys prevent double debits.
4. **Authentication & Safe Verification**:
   - API key authentication with Bearer tokens (`oup_live_...`, `oup_test_...`).
   - Customer phone verification API generating 6-digit OTP stored in encrypted server state; frontend receives only session verification token, never raw OTP.
5. **Android Companion**:
   - Device enrollment with device ID, hardware fingerprint, and ECDSA/HMAC secret.
   - Device health heartbeat monitoring (battery %, power plugged, battery temp, network type).
   - Signed observation ingest endpoint verifying payload signature before appending to device log.
6. **COD Manager**:
   - Order intake with phone & address verification.
   - Status transitions: `PENDING_MERCHANT_APPROVAL` -> `APPROVED` -> `DISPATCHED` -> `DELIVERED` / `REJECTED`.
   - COD reconciliation report generator.
7. **Offline POS & Cash Counter**:
   - Multi-tender split calculation (e.g., ₹500 in Cash, ₹500 in UPI).
   - Card terminal simulator (Paring, swipe/chip prompt, authorization code response).
   - Cash drawer cash-in/cash-out balance tracking and end-of-shift Z-Report.
8. **White-Label Customization**:
   - Dynamic merchant theme generator outputting CSS variables (`--oup-primary`, `--oup-radius`, `--oup-font`).
   - Support contact details and custom domain preview.
9. **Developer Experience & Test Suite**:
   - Interactive API reference with "Run in Sandbox" buttons.
   - Built-in test runner executing automated test suites across all 9 modules with visual pass/fail badges.
   - Sample merchant shop demo ("Chai & Co. Store") with 1-click test checkout.
