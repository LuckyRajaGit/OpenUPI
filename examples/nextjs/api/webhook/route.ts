import { NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.OPENUPI_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get('x-openupi-signature');

    if (!sigHeader) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    let timestamp: number | null = null;
    let receivedSig: string | null = null;

    sigHeader.split(',').forEach((part) => {
      const [k, v] = part.trim().split('=');
      if (k === 't') timestamp = parseInt(v, 10);
      if (k === 'v1') receivedSig = v;
    });

    // Replay attack check (300s window)
    const now = Math.floor(Date.now() / 1000);
    if (timestamp && Math.abs(now - timestamp) > 300) {
      return NextResponse.json({ error: 'Timestamp tolerance exceeded' }, { status: 400 });
    }

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const isValid = receivedSig && crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(expectedSig));
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    if (event.event === 'payment.success') {
      // Complete order in your DB
      console.log(`Order ${event.orderId} verified successfully via webhook.`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
