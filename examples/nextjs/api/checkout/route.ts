import { NextResponse } from 'next/server';

const GATEWAY_URL = process.env.OPENUPI_GATEWAY_URL || 'http://localhost:3000';
const API_KEY = process.env.OPENUPI_API_KEY!;

export async function POST(req: Request) {
  try {
    const { amount, orderId, name, phone } = await req.json();

    const response = await fetch(`${GATEWAY_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
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
      return NextResponse.json({ error: data.error }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
