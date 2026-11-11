/**
 * OpenUPI Gateway - Node.js / Express Integration Example
 */

const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

const OPENUPI_URL = process.env.OPENUPI_GATEWAY_URL || 'http://localhost:3000';
const OPENUPI_KEY = process.env.OPENUPI_API_KEY || 'oup_test_8f294ba713cd4109b8';
const WEBHOOK_SECRET = process.env.OPENUPI_WEBHOOK_SECRET || 'whsec_a891f7c239401829e1';

// Capture raw body buffer for accurate webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

// 1. Create Payment Session Endpoint
app.post('/api/checkout', async (req, res) => {
  try {
    const { amount, orderId, name, phone } = req.body;

    const response = await fetch(`${OPENUPI_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENUPI_KEY}`,
        'Idempotency-Key': orderId,
      },
      body: JSON.stringify({
        amount: Number(amount),
        orderId,
        customerName: name,
        customerPhone: phone,
        method: 'UPI_QR',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Verified Webhook Ingest Endpoint
app.post('/api/webhook', (req, res) => {
  const sigHeader = req.headers['x-openupi-signature'];
  if (!sigHeader || !req.rawBody) {
    return res.status(400).json({ error: 'Missing signature or payload' });
  }

  // Parse t=<timestamp>,v1=<signature>
  let timestamp = null;
  let receivedSig = null;
  sigHeader.split(',').forEach((part) => {
    const [k, v] = part.trim().split('=');
    if (k === 't') timestamp = parseInt(v, 10);
    if (k === 'v1') receivedSig = v;
  });

  // Replay Attack Tolerance Check (300 seconds)
  const now = Math.floor(Date.now() / 1000);
  if (timestamp && Math.abs(now - timestamp) > 300) {
    return res.status(400).json({ error: 'Webhook timestamp tolerance exceeded' });
  }

  // Timing-safe HMAC verification
  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${req.rawBody}`)
    .digest('hex');

  const isValid = receivedSig && crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig));
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body;
  console.log(`[MERCHANT_STORE] Verified Webhook: ${event.event} for Order #${event.orderId}`);

  if (event.event === 'payment.success') {
    // Fulfill order, update database
    console.log(`Order ${event.orderId} marked PAID. Amount: ₹${event.amount}`);
  }

  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Merchant store server running on port ${PORT}`);
});
