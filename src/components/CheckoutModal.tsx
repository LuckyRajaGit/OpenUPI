import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, Smartphone, Shield, ArrowUpRight } from 'lucide-react';
import { PaymentSession } from '../types/index.ts';

interface CheckoutModalProps {
  session: PaymentSession;
  intents: {
    genericUpi: string;
    gpay: string;
    phonepe: string;
    paytm: string;
    bhim: string;
  };
  mode?: 'desktop' | 'mobile_drawer';
  primaryColor?: string;
  merchantName?: string;
  onClose: () => void;
  onSuccess: (session: PaymentSession) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  session: initialSession,
  intents,
  mode = 'desktop',
  primaryColor = '#0284c7',
  merchantName = 'Acme Retail & Tech Ltd',
  onClose,
  onSuccess,
}) => {
  const [session, setSession] = useState<PaymentSession>(initialSession);
  const [isSimulating, setIsSimulating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);

  // Poll status from server
  useEffect(() => {
    const timer = setInterval(() => {
      fetch(`/api/v1/sessions/${session.id}/status`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.session) {
            setSession((prev) => ({ ...prev, ...data.session }));
            if (data.session.status === 'PAID') {
              clearInterval(timer);
              onSuccess(data.session);
            }
          }
        })
        .catch(() => {});
    }, 1500);

    return () => clearInterval(timer);
  }, [session.id, onSuccess]);

  // Expiration countdown
  useEffect(() => {
    const countdown = setInterval(() => {
      const remaining = Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(countdown);
      }
    }, 1000);

    return () => clearInterval(countdown);
  }, [session.expiresAt]);

  const handleSimulatePayment = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/v1/sessions/${session.id}/simulate-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'UPI_SIMULATED' }),
      });
      const data = await res.json();
      if (data && data.session) {
        setSession(data.session);
        onSuccess(data.session);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulating(false);
    }
  };

  const isMobileDrawer = mode === 'mobile_drawer';
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-white text-slate-900 shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col ${
          isMobileDrawer
            ? 'w-full max-w-md rounded-t-2xl mt-auto max-h-[90vh]'
            : 'w-full max-w-md rounded-xl max-h-[92vh]'
        }`}
      >
        {/* Mobile handle indicator */}
        {isMobileDrawer && (
          <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 shrink-0" />
        )}

        {/* Top Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow"
              style={{ backgroundColor: primaryColor }}
            >
              U
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">{merchantName}</div>
              <div className="text-[11px] text-slate-400">Order #{session.orderId}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Payable</div>
              <div className="text-base font-bold font-mono text-sky-400">
                ₹{session.amount.toFixed(2)}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* High Concurrency Queue Warning */}
        {session.status === 'QUEUED' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-amber-800 shrink-0">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Payment Queue: You are #{session.queuePosition || 1} in line. QR activates automatically when your slot opens.
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {session.status === 'PAID' ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Payment Verified!</h3>
              <p className="text-xs text-slate-500">
                ₹{session.amount.toFixed(2)} settled directly to {merchantName}.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Session ID:</span>
                  <span className="text-slate-900 font-semibold">{session.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid At:</span>
                  <span className="text-slate-900">
                    {session.paidAt ? new Date(session.paidAt).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors mt-2"
              >
                Close Receipt
              </button>
            </div>
          ) : timeLeft === 0 ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">QR Code Expired</h3>
              <p className="text-xs text-slate-500">
                This transaction timed out for security. Please initiate a new payment.
              </p>
              <button
                onClick={onClose}
                className="w-full py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {/* Dynamic QR Presentation */}
              <div className="flex flex-col items-center">
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm relative group">
                  <img
                    src={session.qrDataUrl}
                    alt="UPI Payment QR"
                    className="w-48 h-48 block mx-auto object-contain"
                  />
                  {session.status === 'QUEUED' && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center rounded-xl">
                      <Clock className="w-6 h-6 text-amber-500 mb-1 animate-spin" />
                      <div className="text-xs font-bold text-slate-800">Queue Position #{session.queuePosition}</div>
                      <div className="text-[11px] text-slate-500">Holding slot reservation...</div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3 text-xs text-slate-600 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Expires in:</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {formattedTime}
                  </span>
                </div>
              </div>

              {/* Mobile App Intent Launcher */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Or Tap to Pay on Mobile
                  </span>
                  <span className="text-[11px] text-sky-600 font-medium flex items-center gap-0.5">
                    UPI Intent <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <a
                    href={intents.gpay}
                    className="flex flex-col items-center justify-center py-2 px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-blue-600 mb-1" />
                    <span>GPay</span>
                  </a>
                  <a
                    href={intents.phonepe}
                    className="flex flex-col items-center justify-center py-2 px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-purple-600 mb-1" />
                    <span>PhonePe</span>
                  </a>
                  <a
                    href={intents.paytm}
                    className="flex flex-col items-center justify-center py-2 px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-cyan-600 mb-1" />
                    <span>Paytm</span>
                  </a>
                  <a
                    href={intents.bhim}
                    className="flex flex-col items-center justify-center py-2 px-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 mb-1" />
                    <span>BHIM</span>
                  </a>
                </div>
              </div>

              {/* Mock Settlement Action for Sandbox */}
              <div className="pt-2">
                <button
                  onClick={handleSimulatePayment}
                  disabled={isSimulating || session.status === 'QUEUED'}
                  className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSimulating ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Bank Ledger...</span>
                    </>
                  ) : (
                    <span>Simulate Customer App Payment</span>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                <Shield className="w-3 h-3 text-emerald-600" />
                <span>Zero-Fee Self-Hosted OpenUPI Network</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
