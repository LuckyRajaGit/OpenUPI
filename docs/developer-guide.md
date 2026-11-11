# OpenUPI Gateway — Comprehensive Developer & Merchant Guide

A complete guide for integrating, deploying, and securing OpenUPI Gateway across all platforms.

---

## 1. Getting Started

### What is OpenUPI Gateway?
OpenUPI Gateway is an open-source, self-hosted UPI payments and checkout platform. Unlike closed proprietary payment aggregators that charge 1.5%–2% fees, OpenUPI allows merchants to collect UPI payments directly to their own bank Virtual Payment Address (VPA) with zero commission and instant settlement.

### How Does It Work?
1. **Merchant Server** calls `POST /api/v1/sessions` with amount, order ID, and merchant API key.
2. **OpenUPI Engine** generates a standardized NPCI UPI URI (`upi://pay?pa=...`) and crisp dynamic QR code.
3. **Customer Checkout** opens either as a desktop modal or mobile bottom drawer via `openupi.js`.
4. **Customer** scans the QR code or clicks an intent deep-link to launch GPay, PhonePe, Paytm, or BHIM.
5. **Bank NPCI Switch** processes the UPI transfer and dispatches an authoritative settlement webhook.
6. **OpenUPI Dispatcher** signs the event with HMAC-SHA256 and delivers it to the merchant's webhook endpoint.

### Self-Hosted Installation

#### Using Docker Compose (Recommended)
```bash
git clone https://github.com/openupi/openupi-gateway.git
cd openupi-gateway
docker compose up -d
```
Your gateway will be running on `http://localhost:3000`.

#### Using Node.js directly
```bash
npm install
npm run build
npm run start
```

### Your First Test Transaction
```bash
curl -X POST http://localhost:3000/api/v1/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer oup_test_8f294ba713cd4109b8" \
  -d '{
    "amount": 499.00,
    "orderId": "FIRST-TEST-001",
    "customerName": "Raja Bagdi",
    "method": "UPI_QR"
  }'
```

---

## 2. Platform Integration Guides

### A. Universal JavaScript SDK (`openupi.js`)
Add the single script tag to your web application:
```html
<script src="https://your-gateway.com/openupi.js" async></script>
```

#### Declarative HTML Attribute Integration
```html
<button
  data-openupi-checkout
  data-openupi-amount="499.00"
  data-openupi-order-id="ORD-101"
  data-openupi-name="Aarav Sharma"
>
  Pay ₹499 with UPI
</button>
```

#### Programmatic JavaScript Integration
```javascript
window.OpenUPI.open({
  amount: 499.00,
  orderId: "ORD-101",
  name: "Aarav Sharma",
  phone: "+91 98200 12345",
  onOpen: () => console.log("Checkout opened"),
  onSuccess: (data) => window.location.href = `/success?ref=${data.paymentId}`,
  onFailure: (err) => alert("Payment error: " + err.error),
  onClose: () => console.log("Checkout dismissed")
});
```

### B. PHP Website Integration
Use `curl` in PHP to create the session server-side, then open checkout:
```php
$payload = json_encode([
    'amount'  => 500.00,
    'orderId' => 'PHP-' . time()
]);
// See examples/php/checkout.php for full working script
```

### C. Node.js / Express Integration
```javascript
// See examples/nodejs/server.js for full working server
```

### D. React Integration
```tsx
// See examples/react/CheckoutButton.tsx for React component
```

### E. Next.js App Router Integration
```typescript
// See examples/nextjs/ for full API route and page example
```

### F. WordPress & WooCommerce
- **WordPress Shortcode**: Copy `examples/wordpress/openupi-shortcode.php` to your `wp-content/plugins/` folder and use `[openupi_checkout amount="499"]`.
- **WooCommerce**: Install the plugin from `examples/woocommerce/class-wc-gateway-openupi.php`. Navigate to **WooCommerce > Settings > Payments > OpenUPI Gateway** and enter your Gateway URL and API key.

---

## 3. Payment Lifecycle

```
[Customer Browser]           [Merchant Backend]          [OpenUPI Gateway]          [Bank NPCI Switch]
       │                             │                           │                          │
       │─── 1. Click Pay ───────────>│                           │                          │
       │                             │─── 2. POST /sessions ────>│                          │
       │                             │<── 3. Session & QR ───────│                          │
       │<── 4. Open openupi.js Modal─│                           │                          │
       │                                                         │                          │
       │─── 5. Scan QR via GPay / PhonePe / Paytm ───────────────┼─────────────────────────>│
       │                                                         │                          │
       │                                                         │<── 6. Bank Webhook ──────│
       │                                                         │    (Settlement Verified) │
       │                             │<── 7. POST /webhook ──────│                          │
       │                             │    (Signed HMAC-SHA256)   │                          │
       │                             │─── 8. 200 OK ────────────>│                          │
       │                                                         │                          │
       │<── 9. Status Polling returns 'PAID' ────────────────────│                          │
       │─── 10. Show Order Success Receipt ─────────────────────>│                          │
```

---

## 4. Security Best Practices

1. **Never Expose Merchant API Keys in Client Code**:
   Store `OPENUPI_API_KEY` strictly in backend environment variables. The client only needs the public session ID or `openupi.js`.
2. **Always Verify Webhook Signatures**:
   Never mark an order as paid without cryptographically verifying the `X-OpenUPI-Signature` header using `crypto.timingSafeEqual` with your `webhookSecret`.
3. **Enforce Idempotency**:
   Pass unique `Idempotency-Key` or `orderId` headers on session and refund operations to prevent accidental double charges.
4. **Respect Timestamp Windows**:
   Reject webhooks older than 300 seconds to protect against captured packet replay attacks.
5. **Use HTTPS / TLS 1.3**:
   Always run OpenUPI behind an SSL reverse proxy (Nginx, Caddy, Cloudflare) in production.

---

## 5. Troubleshooting Reference

- **Invalid API Key**: Ensure key begins with `oup_test_` or `oup_live_` and is passed as `Authorization: Bearer <key>`.
- **Payment Pending**: Some banks take 10-30 seconds to route IMPS credits. The polling worker continues for 300 seconds before timing out.
- **Webhook Not Received**: Check firewall / port-forwarding on your merchant endpoint. Use the in-app Webhook Dispatcher in **Developer Hub** to test connectivity.
- **Amount Tampering Error**: Do not re-use an existing order ID with an altered price. Create a fresh order ID for cart updates.
