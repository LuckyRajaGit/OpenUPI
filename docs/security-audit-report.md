# OpenUPI Gateway — Security Audit & Remediation Report

**Date of Audit**: November 2026  
**Auditor**: OpenUPI Core Security Engineering  
**Scope**: Full Stack (Frontend SDK, Express Server, REST APIs, Rate Limiting, Storage Models, Webhooks, POS, COD)  
**Overall Status**: All Critical and High Severity Vulnerabilities Remediated and Verified  

---

## 1. Executive Summary

A comprehensive source code security audit of the OpenUPI Gateway self-hosted UPI checkout platform was performed. The audit reviewed authentication, authorization, session state machines, race conditions, webhook signing, rate limiting, and data exposure. 

All identified vulnerabilities have been remediated with defensive code controls, verified through automated security tests, and documented below.

---

## 2. Vulnerability Findings & Applied Remediation

### Finding SEC-01: Insecure Direct Object Reference (IDOR) & Broken Multi-Tenant Isolation
- **Severity**: **CRITICAL**
- **Affected File**: `server/routes/api.ts` (routes `/sessions/:id`, `/sessions/:id/refund`)
- **Risk Explanation**: In the initial prototype, sessions and transaction details lacked tenant boundary checks. An authenticated merchant or client could query or attempt refunds against another merchant account's payment session simply by guessing or supplying the target session ID.
- **Fix Applied**: 
  1. Updated `DatabaseStore` to partition sessions, COD orders, and refunds by `merchantId`.
  2. Implemented `requireMerchantAuth` middleware requiring valid Bearer API key.
  3. Added cross-tenant validation: if `session.merchantId !== caller.merchantId`, the request is halted with HTTP 403 Forbidden and logged as a security alert.
- **Test Performed**: Scenario 3 in `tests/security-tests.ts`: Merchant B attempts to refund Merchant A's transaction. Result: Rejected with HTTP 403.
- **Remaining Risks**: None. Scoping is enforced at the service and route layer.

---

### Finding SEC-02: Payment Amount Tampering
- **Severity**: **CRITICAL**
- **Affected File**: `server/services/qrService.ts` (`createPaymentSession`)
- **Risk Explanation**: A client could submit a session creation request for an existing order with a reduced amount (e.g. ₹1.00 instead of ₹1,000.00), resulting in an underpayment settlement.
- **Fix Applied**: Added strict order binding: when an order ID is first initialized, its amount is locked in the store. Subsequent session attempts verifying that order ID check `session.amount === cleanAmount`. If altered, the gateway halts with an `Amount Tampering Detected` error. Also enforced NPCI ₹1.00 min and ₹100,000.00 max limits.
- **Test Performed**: Scenario 1 in `tests/security-tests.ts`: Re-creating session with altered amount. Result: Correctly rejected.
- **Remaining Risks**: None.

---

### Finding SEC-03: Double-Spend Race Condition in Concurrent Payment Completion
- **Severity**: **HIGH**
- **Affected File**: `server/services/qrService.ts` (`markAsPaid`)
- **Risk Explanation**: If two simultaneous settlement requests (e.g. a simultaneous webhook arrival and mock simulation) arrived at the exact same millisecond, both threads could execute credit logic and dispatch duplicate webhook notifications.
- **Fix Applied**: Wrapped `markAsPaid` in an atomic distributed mutex lock via `redis.acquireLock('settle:<sessionId>', 10)`. If a parallel settlement is in progress, the second request is serialized. If already marked `PAID`, it idempotently returns the existing record without duplicate credit.
- **Test Performed**: Scenario 14 in `tests/security-tests.ts`: Two simultaneous parallel `markAsPaid` promises fired together. Result: Atomic lock serialized requests cleanly without duplicate settlement.
- **Remaining Risks**: None for self-hosted instances. For clustered multi-datacenter deployments, configure shared Redis cluster locks.

---

### Finding SEC-04: Webhook Replay Attacks & Signature Forgery
- **Severity**: **HIGH**
- **Affected File**: `server/services/webhookService.ts` (`verifyWebhookSignature`)
- **Risk Explanation**: Without timestamp tolerance windows and deduplication, an adversary eavesdropping on webhook network traffic could replay captured webhooks to re-trigger order fulfillment.
- **Fix Applied**: 
  1. Implemented standard timestamped signatures: `t=<timestamp>,v1=<hmac_sha256>`.
  2. Enforced 300-second (5 minute) maximum timestamp tolerance window.
  3. Integrated `redis.checkWebhookNonce(eventId)` deduplication cache.
  4. Used `crypto.timingSafeEqual` to prevent timing attacks on signature strings.
- **Test Performed**: Scenarios 7, 8, and 9 in `tests/security-tests.ts`. Result: Forged signatures, replayed timestamps, and duplicate event IDs all rejected.
- **Remaining Risks**: Ensure merchant servers maintain accurate NTP clock synchronization.

---

### Finding SEC-05: Missing Rate Limiting on SMS OTP Challenges
- **Severity**: **MEDIUM**
- **Affected File**: `server/routes/api.ts` (`/api/v1/auth/customer-phone/challenge`)
- **Risk Explanation**: An automated attacker could flood the SMS challenge endpoint, incurring cellular carrier SMS charges or causing denial of service.
- **Fix Applied**: Implemented sliding-window rate limiting middleware backed by `server/services/redisService.ts`. The OTP endpoint is capped at 5 challenges per minute per identifier.
- **Test Performed**: Verified sliding window rate limiter returns HTTP 429 when threshold exceeded.
- **Remaining Risks**: In production, configure Cloudflare or WAF IP reputation filters in front of the application.

---

### Finding SEC-06: Sensitive Credential Exposure in Application Logs
- **Severity**: **MEDIUM**
- **Affected File**: `server.ts` & `server/services/loggerService.ts`
- **Risk Explanation**: Logging raw request bodies or headers could inadvertently write merchant API keys, customer phone numbers, or passwords to log files.
- **Fix Applied**: Replaced raw `console.log` with centralized `loggerService.ts`. Added recursive data sanitization stripping API keys, bearer tokens, passwords, OTPs, PINs, and card CVVs before writing logs.
- **Test Performed**: Checked log inspection output; all sensitive keys are replaced with `[REDACTED_SENSITIVE_CREDENTIAL]`.
- **Remaining Risks**: None.

---

### Finding SEC-07: Insecure CORS & Missing Security Headers
- **Severity**: **LOW**
- **Affected File**: `server.ts`
- **Risk Explanation**: Default express configurations lacked standard browser defense-in-depth headers, leaving the app open to MIME-type sniffing and clickjacking.
- **Fix Applied**: Added headers:
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - Dynamic CORS header handling with allowed methods and headers.
- **Test Performed**: Inspected response headers in curl: all headers present.
- **Remaining Risks**: None.

---

## 3. Security Checklist for Future Releases

Every future release of OpenUPI Gateway must pass this verification checklist before deployment:

- [ ] Run `npm run test:security` and ensure 14/14 scenarios pass.
- [ ] Run `npm run test:integration` and ensure 8/8 tests pass.
- [ ] Run `npm run typecheck` to confirm zero TypeScript compilation errors.
- [ ] Verify that no API secrets or webhook keys appear in `/dist` or client bundles.
- [ ] Verify that public status endpoints (`/api/v1/sessions/:id/status`) expose only status and amount.
- [ ] Confirm that all database mutations across orders and refunds are scoped by `merchantId`.
- [ ] Verify that all webhook dispatchers send valid HMAC-SHA256 signatures with timestamp `t=`.
- [ ] Confirm that rate limiting limits remain enforced on OTP and session endpoints.
- [ ] Check dependency vulnerabilities with `npm audit`.
