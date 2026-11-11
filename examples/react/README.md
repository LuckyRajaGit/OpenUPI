# React Integration Guide for OpenUPI Gateway

### 1. Add SDK script to `public/index.html`
```html
<script src="https://your-openupi-gateway.com/openupi.js" async></script>
```

### 2. Import and render the component
```tsx
import { OpenUpiCheckoutButton } from './CheckoutButton';

export function CartPage() {
  return (
    <OpenUpiCheckoutButton
      amount={499.00}
      orderId="ORD-REACT-101"
      name="Pooja Sharma"
      onSuccess={(paymentId) => {
        window.location.href = `/order-confirmed?ref=${paymentId}`;
      }}
      onFailure={(error) => {
        alert("Payment error: " + error);
      }}
    />
  );
}
```
*Note: Never place your Merchant API Key in React components or browser code. Keep your API key in your server-side proxy.*
