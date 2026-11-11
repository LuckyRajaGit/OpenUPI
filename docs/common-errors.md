# OpenUPI Gateway — Common Errors & Troubleshooting

A troubleshooting reference for developers, merchants, and platform operators encountering common runtime, API, and checkout integration errors.

---

## 1. Authentication & API Errors

### Error: `401 Unauthorized: Missing Authorization header`
- **Cause**: The API call did not provide the `Authorization` header, or provided an empty string.
- **Resolution**:
  ```http
  Authorization: Bearer oup_test_8f294ba713cd4109b8
  ```
  Ensure the header is set server-side in your backend, never exposed in client-side HTML or React code.

### Error: `403 Forbidden: Cross-merchant access attempt`
- **Cause**: Your API key belongs to Merchant B, but the requested session or refund belongs to Merchant A (IDOR protection).
- **Resolution**: Verify that the session ID was created under the same merchant account that is issuing the refund or query.

---

## 2. Checkout & Payment Session Errors

### Error: `400 Bad Request: Amount Tampering Detected`
- **Cause**: The client submitted a payment creation request with an order ID that was already initialized with a different amount.
- **Resolution**: Once an `orderId` is created, its amount is strictly immutable in OpenUPI. Generate a new unique order ID (e.g. `ORD-101-RETRY`) if the cart contents or prices change.

### Error: `429 Too Many Requests: Rate limit exceeded`
- **Cause**: More than 60 session creation requests per minute from a single IP, or more than 5 OTP requests per minute for the same phone number.
- **Resolution**: Check the response headers `X-RateLimit-Reset` and back off client requests. In high-traffic scenarios, configure custom limits via `server/services/redisService.ts`.

### Error: `409 Conflict: Concurrent refund operation in progress`
- **Cause**: Two simultaneous refund requests were dispatched using the same `Idempotency-Key`.
- **Resolution**: Wait 2-3 seconds and inspect the existing refund state. OpenUPI's distributed mutex prevents duplicate debits.

---

## 3. Webhook Integration Errors

### Error: `Invalid signature: HMAC hash mismatch`
- **Cause**:
  1. The webhook payload was parsed or formatted before computing the HMAC hash (e.g. JSON re-serialization altered whitespace or key order).
  2. The webhook secret in your environment does not match `whsec_...` configured in OpenUPI Gateway.
- **Resolution**: Always verify against the raw, unmodified request body buffer (`req.body` as raw string).

### Error: `Webhook timestamp rejected: exceeds tolerance window of 300s`
- **Cause**: An incoming webhook's timestamp is more than 5 minutes old (Replay Attack Prevention).
- **Resolution**: Ensure system clocks on both the gateway and your merchant server are synced via NTP.

---

## 4. Docker & Self-Hosted Infrastructure Errors

### Error: `Redis connection error / Connection refused`
- **Cause**: Redis container is not running or network alias is misconfigured.
- **Resolution**: Check `docker-compose ps` to ensure `openupi_redis` is running on port 6379. Note that OpenUPI Gateway automatically falls back to its embedded in-memory Redis engine if an external Redis node is unreachable.

### Error: `Port 3000 already in use`
- **Cause**: Another process is occupying port 3000.
- **Resolution**: Stop the existing process (`lsof -i :3000` -> `kill -9 <PID>`) or set `PORT=3001` in `.env`.
