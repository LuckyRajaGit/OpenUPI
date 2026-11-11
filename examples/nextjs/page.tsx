'use client';

import React, { useState } from 'react';
import Script from 'next/script';

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const orderId = 'NEXT-ORD-' + Date.now();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 1299.00,
          orderId,
          name: 'Kavita Rao',
          phone: '+91 98300 54321',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Open Checkout Modal
      (window as any).OpenUPI.open({
        amount: data.session.amount,
        orderId: data.session.orderId,
        onSuccess: (result: any) => {
          window.location.href = `/success?ref=${result.paymentId}`;
        },
        onFailure: (err: any) => {
          alert('Payment Failed: ' + err.error);
        },
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '60px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <Script src={`${process.env.NEXT_PUBLIC_OPENUPI_URL || 'http://localhost:3000'}/openupi.js`} />
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '30px' }}>
        <h2>Premium Wireless Mechanical Keyboard</h2>
        <p style={{ color: '#64748b' }}>Custom hot-swappable switches with RGB backlight.</p>
        <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '20px 0' }}>₹1,299.00</div>
        <button
          onClick={handleCheckout}
          disabled={loading}
          style={{
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          {loading ? 'Processing...' : 'Pay with UPI'}
        </button>
      </div>
    </div>
  );
}
