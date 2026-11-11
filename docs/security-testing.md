# OpenUPI Gateway — Automated Security Testing Guide

This document describes the automated security verification suite, the 14 financial attack vectors covered, and instructions for integrating security gates into CI/CD pipelines.

---

## 1. Running Test Commands

Execute tests using npm scripts:

```bash
# Run complete test suite (Payment Security + Integration)
npm run test

# Run 14 Payment Security Scenarios specifically
npm run test:security

# Run Core API Integration Tests
npm run test:integration

# Type check TypeScript definitions
npm run typecheck

# Run linter
npm run lint

# Production build test
npm run build
```

---

## 2. 14 Payment Security Scenarios Explained

| # | Attack / Failure Scenario | Defense Mechanism & Expected Behavior |
|---|---|---|
| **1** | Customer changes payment amount in browser | Immutable order binding: If an existing `orderId` is called with a mismatched amount, the gateway halts with an `Amount Tampering Detected` error. Amounts $< ₹1$ or $> ₹100,000$ are rejected. |
| **2** | Customer modifies order ID to invalid string | Input validation restricts order IDs to 2–64 alphanumeric characters. Whitespace or empty strings are rejected. |
| **3** | Customer/Merchant accesses another merchant's record (IDOR) | Strict multi-tenant account isolation: Queries and refunds enforce `session.merchantId === caller.merchantId`. Cross-account requests return HTTP 403 Forbidden. |
| **4** | Customer opens a fake payment success URL | Sovereign ledger integrity: Browser navigation never updates ledger records. Only authoritative webhook confirmations from the bank switch can settle a payment. |
| **5** | Customer refreshes checkout repeatedly | Idempotent session reuse: The existing session is returned without allocating redundant queue slots or creating duplicate debit sessions. |
| **6** | Duplicate payment submission | Idempotency lock: The `Idempotency-Key` or `orderId` is cached; subsequent duplicate calls return the existing session. |
| **7** | Duplicate webhook is delivered | Deduplication cache: Every webhook delivery is tagged with a unique event ID. Re-deliveries are acknowledged but not re-credited. |
| **8** | Webhook arrives with forged signature | Cryptographic verification: Payloads are verified using `crypto.timingSafeEqual` with HMAC-SHA256. Forged signatures fail immediately. |
| **9** | Replay of old captured webhook | Timestamp tolerance window: Webhooks older than 300 seconds (5 minutes) are rejected to prevent replay attacks. |
| **10** | Payment provider returns failed status | Strict state machine: The session transitions to `FAILED`. Concurrency queue slot is released safely. It is never marked `PAID`. |
| **11** | Payment status changes unexpectedly | Invalid state transition block: Sessions in terminal states (`EXPIRED`, `CANCELLED`, `FAILED`) cannot transition to `PAID`. |
| **12** | Unauthorized refund request | Authentication guard: Public endpoints cannot issue refunds. Only authenticated merchants with valid Bearer tokens can refund settled sessions. |
| **13** | Merchant API key exposure in frontend | Zero-leak audit: Public checkout polling endpoints (`/status`) expose only status, order ID, and amount. Private secrets, OTP codes, and webhook secrets are excluded. |
| **14** | Simultaneous payment completion race condition | Distributed mutex lock: Parallel settlement requests are atomically locked via Redis/in-memory lock (`settle:<sessionId>`). One settles; the second safely detects already-settled state without duplicate webhooks or double credits. |

---

## 3. Continuous Integration (CI/CD) Pipeline Integration

In GitHub Actions or GitLab CI, include the test command in your test workflow:

```yaml
name: Security & Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:security
      - run: npm run test:integration
      - run: npm run build
```
