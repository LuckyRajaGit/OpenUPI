import React, { useState } from 'react';

declare global {
  interface Window {
    OpenUPI?: {
      open: (options: any) => void;
    };
  }
}

interface CheckoutButtonProps {
  amount: number;
  orderId: string;
  name: string;
  phone?: string;
  onSuccess: (paymentId: string) => void;
  onFailure: (error: string) => void;
}

export const OpenUpiCheckoutButton: React.FC<CheckoutButtonProps> = ({
  amount,
  orderId,
  name,
  phone,
  onSuccess,
  onFailure,
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (!window.OpenUPI) {
      alert("OpenUPI SDK script not loaded. Add <script src='https://your-gateway/openupi.js'></script> to index.html");
      return;
    }

    setLoading(true);

    window.OpenUPI.open({
      amount,
      orderId,
      name,
      phone,
      onOpen: () => setLoading(false),
      onSuccess: (data: any) => onSuccess(data.paymentId),
      onFailure: (err: any) => {
        setLoading(false);
        onFailure(err.error);
      },
      onClose: () => setLoading(false),
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        backgroundColor: '#0284c7',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
      }}
    >
      {loading ? 'Initializing UPI...' : `Pay ₹${amount.toFixed(2)} with UPI`}
    </button>
  );
};
