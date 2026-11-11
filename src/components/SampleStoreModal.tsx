import React, { useState } from 'react';
import { ShoppingBag, X, Check, ShieldCheck, ArrowRight, Star } from 'lucide-react';
import { CheckoutModal } from './CheckoutModal.tsx';
import { PaymentSession } from '../types/index.ts';

interface SampleStoreModalProps {
  onClose: () => void;
}

const STORE_PRODUCTS = [
  {
    id: 'prod_1',
    name: 'Estate Darjeeling First Flush (100g)',
    category: 'Single Origin Tea',
    price: 499,
    rating: 4.9,
    description: 'Floral, Muscatel notes harvested from high-elevation Himalayan foothills.',
  },
  {
    id: 'prod_2',
    name: 'Handcrafted Clay Kulhad Set (Pack of 4)',
    category: 'Artisan Pottery',
    price: 349,
    rating: 4.8,
    description: 'Natural terracotta cups crafted by master artisans in Varanasi.',
  },
  {
    id: 'prod_3',
    name: 'Wild Forest Honey with Raw Cardamom (350g)',
    category: 'Organic Preserves',
    price: 599,
    rating: 5.0,
    description: 'Cold-extracted raw multi-flora forest honey infused with green cardamom.',
  },
];

export const SampleStoreModal: React.FC<SampleStoreModalProps> = ({ onClose }) => {
  const [cart, setCart] = useState<{ [id: string]: number }>({ prod_1: 1 });
  const [checkoutSession, setCheckoutSession] = useState<{
    session: PaymentSession;
    intents: any;
  } | null>(null);
  const [orderComplete, setOrderComplete] = useState<PaymentSession | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const totalAmount = Object.entries(cart).reduce((sum, [id, qty]) => {
    const prod = STORE_PRODUCTS.find((p) => p.id === id);
    return sum + (prod ? prod.price * qty : 0);
  }, 0);

  const handleTriggerCheckout = async () => {
    if (totalAmount <= 0) return;
    setIsCheckingOut(true);
    try {
      const orderId = 'ORD-STORE-' + Math.floor(1000 + Math.random() * 9000);
      const res = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          orderId,
          customerName: 'Aarav Patel',
          customerPhone: '+91 98200 44123',
          method: 'UPI_QR',
        }),
      });
      const data = await res.json();
      if (data && data.session) {
        setCheckoutSession(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              ☕
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight">
                Chai & Craft Artisans
              </div>
              <div className="text-[11px] text-slate-400">
                Sample Merchant Storefront (OpenUPI SDK Powered)
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {orderComplete ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Order Confirmed!</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Thank you! Payment of ₹{orderComplete.amount.toFixed(2)} for Order #{orderComplete.orderId} was settled via direct UPI.
              </p>
              <button
                onClick={() => {
                  setOrderComplete(null);
                  setCheckoutSession(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg mt-2"
              >
                Back to Store
              </button>
            </div>
          ) : (
            <>
              {/* Product Catalog */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Featured Artisan Products
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STORE_PRODUCTS.map((prod) => {
                    const inCart = (cart[prod.id] || 0) > 0;
                    return (
                      <div
                        key={prod.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="text-[10px] text-amber-400 font-medium">{prod.category}</div>
                          <div className="text-xs font-bold text-white mt-0.5 line-clamp-1">{prod.name}</div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {prod.description}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                          <span className="font-mono text-xs font-bold text-sky-400">₹{prod.price}</span>
                          <button
                            onClick={() =>
                              setCart((prev) => ({
                                ...prev,
                                [prod.id]: (prev[prod.id] || 0) + 1,
                              }))
                            }
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                              inCart
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {inCart ? `Added (${cart[prod.id]})` : '+ Add'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cart Summary & Direct UPI Checkout */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Total Payable:</div>
                    <div className="text-lg font-bold font-mono text-white">
                      ₹{totalAmount.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleTriggerCheckout}
                    disabled={totalAmount <= 0 || isCheckingOut}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-sm shadow-sky-600/30 transition-colors disabled:opacity-50"
                  >
                    <span>Pay with OpenUPI</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protected by OpenUPI Zero-Intermediary Direct Settlement</span>
              </div>
            </>
          )}
        </div>
      </div>

      {checkoutSession && (
        <CheckoutModal
          session={checkoutSession.session}
          intents={checkoutSession.intents}
          onClose={() => setCheckoutSession(null)}
          onSuccess={(settled) => {
            setOrderComplete(settled);
            setCart({});
          }}
        />
      )}
    </div>
  );
};
