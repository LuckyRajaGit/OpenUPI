import React, { useState, useEffect } from 'react';
import { QrCode, Clock, RefreshCw, CheckCircle2, AlertCircle, Smartphone, ExternalLink, Zap } from 'lucide-react';
import { PaymentSession } from '../../types/index.ts';

export const DynamicQrModule: React.FC = () => {
  const [sessions, setSessions] = useState<PaymentSession[]>([]);
  const [activeSession, setActiveSession] = useState<PaymentSession | null>(null);
  const [intents, setIntents] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [newAmount, setNewAmount] = useState('750.00');
  const [newOrderId, setNewOrderId] = useState('ORD-QR-' + Math.floor(1000 + Math.random() * 9000));
  const [countdown, setCountdown] = useState(300);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/v1/sessions');
      const data = await res.json();
      if (data && data.sessions) {
        setSessions(data.sessions);
        if (!activeSession && data.sessions.length > 0) {
          setActiveSession(data.sessions[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for active session
  useEffect(() => {
    if (!activeSession) return;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.round((activeSession.expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const handleGenerateQr = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(newAmount),
          orderId: newOrderId,
          method: 'UPI_QR',
        }),
      });
      const data = await res.json();
      if (data && data.session) {
        setActiveSession(data.session);
        setIntents(data.intents);
        setNewOrderId('ORD-QR-' + Math.floor(1000 + Math.random() * 9000));
        fetchSessions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePayment = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}/simulate-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'UPI_PROVIDER_TEST' }),
      });
      const data = await res.json();
      if (data && data.session) {
        setActiveSession(data.session);
        fetchSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Module 02
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Dynamic QR & Mobile Intent</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Dynamic NPCI UPI QR & Intent Engine
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Generates standardized NPCI-compliant UPI payment URIs with dynamic transaction references, automated time-bound expiration timers, and direct mobile intent handoffs for Google Pay, PhonePe, Paytm, and BHIM.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Generator & Preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <QrCode className="w-4 h-4 text-sky-400" />
              Generate Dynamic QR
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">₹</span>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Order ID
                </label>
                <input
                  type="text"
                  value={newOrderId}
                  onChange={(e) => setNewOrderId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                onClick={handleGenerateQr}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-sky-600/20 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                <span>Generate Dynamic QR Code</span>
              </button>
            </div>
          </div>

          {/* Active QR Visualizer */}
          {activeSession && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Active Session Preview</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                  activeSession.status === 'PAID'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : activeSession.status === 'EXPIRED'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {activeSession.status}
                </span>
              </div>

              <div className="p-4 bg-white rounded-xl text-center space-y-3">
                <img
                  src={activeSession.qrDataUrl}
                  alt="Dynamic QR Code"
                  className="w-48 h-48 mx-auto object-contain"
                />
                <div className="text-slate-900 font-bold font-mono text-lg">
                  ₹{activeSession.amount.toFixed(2)}
                </div>
              </div>

              {/* Expiration Countdown */}
              {activeSession.status !== 'PAID' && (
                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    QR Expiration Timer:
                  </span>
                  <span className="font-mono font-bold text-white">
                    {countdown > 0 ? timeFormatted : 'Expired'}
                  </span>
                </div>
              )}

              {/* Mobile Deep-Link Intents */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">NPCI UPI URI:</div>
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-[11px] text-sky-400 break-all select-all">
                  {activeSession.upiUri}
                </div>
              </div>

              {/* Mock Settlement Action */}
              {activeSession.status !== 'PAID' && countdown > 0 && (
                <button
                  onClick={() => handleSimulatePayment(activeSession.id)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Simulate Bank Webhook Settlement</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Payment Sessions Ledger */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Live Payment Session Tracking
              </h3>
              <button
                onClick={fetchSessions}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Created</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-sans">
                        No payment sessions generated yet. Use the generator on the left.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((sess) => {
                      const isSelected = activeSession?.id === sess.id;
                      return (
                        <tr
                          key={sess.id}
                          onClick={() => setActiveSession(sess)}
                          className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                            isSelected ? 'bg-slate-800/60' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-white font-medium">
                            {sess.orderId}
                          </td>
                          <td className="py-2.5 px-3 text-sky-400 font-bold">
                            ₹{sess.amount.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className={`text-[11px] font-semibold ${
                              sess.status === 'PAID'
                                ? 'text-emerald-400'
                                : sess.status === 'EXPIRED'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}>
                              {sess.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-sans text-[11px]">
                            {new Date(sess.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-sans">
                            {sess.status !== 'PAID' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSimulatePayment(sess.id);
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium rounded border border-slate-700 transition-colors"
                              >
                                Settle
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-400">Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
