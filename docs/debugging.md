# OpenUPI Gateway — Debugging & Diagnostics Guide

This guide covers operational debugging, structured request tracing, error monitoring, and failure recovery across the OpenUPI Gateway self-hosted environment.

---

## 1. Request Tracing & Correlation IDs

Every inbound HTTP request to OpenUPI Gateway is automatically assigned an end-to-end correlation ID:

- **HTTP Header**: `X-Request-Id: req_8f19a0bc42`
- **Application Context**: Accessible on Express `req.requestId`
- **Error Payloads**: Included in every JSON error response:

```json
{
  "error": "Payment session not found",
  "requestId": "req_8f19a0bc42"
}
```

When diagnosing customer issues, ask the merchant or customer for the `requestId` shown in the receipt or API response, then filter structured application logs using that identifier.

---

## 2. Structured Logging System

All gateway events are emitted via `server/services/loggerService.ts` with structured ISO-8601 timestamps, severity levels, module namespaces, and automated credential sanitization.

### Log Levels
- `INFO`: Normal lifecycle events (session creation, settlement, webhook dispatch).
- `WARN`: Security alerts, rate limit breaches, cross-merchant IDOR rejections, failed card swipes.
- `ERROR`: Unhandled exceptions, bank communication timeouts, database write failures.

### Sensitive Data Redaction
The logger automatically redacts sensitive keywords:
- Passwords & UPI PINs
- Merchant API keys & Webhook secrets (masked to prefix and last 4 chars)
- Plain OTP codes
- Customer credit card numbers & CVVs
- Bank account details

---

## 3. Subsystem Health Diagnostics

Access the real-time system health endpoint:

```bash
curl -X GET http://localhost:3000/api/v1/debug/health
```

### Health Response Schema:
- **Application**: Uptime seconds, active concurrent sessions, memory consumption, Node.js runtime.
- **Database**: Connection status, record counts across sessions, COD orders, POS receipts.
- **Redis Cache**: Memory usage, latency (ms), active lock count, rate-limit keys.
- **Workers**: Queue watchdog state, background webhook retry dispatcher.
- **Payment Provider**: NPCI UPI Switch connection, circuit breaker state (`CLOSED` / `OPEN`).

---

## 4. Recovering from Failed Operations

### A. Diagnosing Failed Payments
Query the failed payment log:
```bash
curl -X GET http://localhost:3000/api/v1/debug/failed-payments
```
Common reasons:
1. `Amount Tampering Detected`: The client tried to alter order amount after initialization.
2. `Exceeds NPCI UPI limit`: Transaction amount was greater than ₹100,000.00.
3. `Duplicate transaction`: An existing settled session already exists for this `orderId`.

### B. Diagnosing & Retrying Failed Webhooks
Query webhook logs:
```bash
curl -X GET http://localhost:3000/api/v1/developer/webhooks
```
If a merchant's server returned 5xx or timed out, the event is retained in `db.failedWebhooks` and can be retried with the original timestamped payload and valid HMAC signature.
