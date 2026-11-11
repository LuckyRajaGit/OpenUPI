import React, { useState } from 'react';
import { Code2, Play, CheckCircle2, Copy, Check, Terminal, ExternalLink, Smartphone, Monitor } from 'lucide-react';
import { CheckoutModal } from '../CheckoutModal.tsx';
import { PaymentSession } from '../../types/index.ts';

export const UniversalSdkModule: React.FC = () => {
  const [amount, setAmount] = useState('499.00');
  const [orderId, setOrderId] = useState('ORD-SDK-' + Math.floor(1000 + Math.random() * 9000));
  const [customerName, setCustomerName] = useState('Ananya Sen');
  const [customerPhone, setCustomerPhone] = useState('+91 98300 12345');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile_drawer'>('desktop');
  const [activeSession, setActiveSession] = useState<{
    session: PaymentSession;
    intents: any;
  } | null>(null);

  const [eventLogs, setEventLogs] = useState<Array<{ time: string; event: string; detail: string }>>([
    { time: '17:40:02', event: 'SDK_INITIALIZED', detail: 'window.OpenUPI ready at /openupi.js' },
  ]);

  const [copied, setCopied] = useState(false);

  const logEvent = (event: string, detail: string) => {
    const time = new Date().toLocaleTimeString();
    setEventLogs((prev) => [{ time, event, detail }, ...prev.slice(0, 15)]);
  };

  const handleLaunchProgrammatic = async () => {
    logEvent('onOpen', `Invoking OpenUPI.open({ amount: ${amount}, orderId: "${orderId}" })`);
    try {
      const res = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          orderId,
          customerName,
          customerPhone,
          method: 'UPI_QR',
        }),
      });
      const data = await res.json();
      if (data && data.session) {
        setActiveSession(data);
        if (data.session.status === 'QUEUED') {
          logEvent('onQueueWait', `Queue slot reserved at position #${data.session.queuePosition}`);
        }
      }
    } catch (err: any) {
      logEvent('onFailure', err.message);
    }
  };

  const handleLaunchDataAttr = () => {
    logEvent('HTML_DATA_TRIGGER', `Click captured on [data-openupi-checkout] element`);
    handleLaunchProgrammatic();
  };

  const copySnippet = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const programmaticSnippet = `// 1. Programmatic JavaScript Integration
window.OpenUPI.open({
  amount: ${amount},
  orderId: "${orderId}",
  name: "${customerName}",
  phone: "${customerPhone}",
  onOpen: () => console.log("Checkout opened"),
  onSuccess: (data) => console.log("Payment settled", data.paymentId),
  onFailure: (err) => console.error("Payment failed", err),
  onClose: () => console.log("Checkout dismissed"),
  onQueueWait: (pos) => console.log("Waiting in queue #", pos)
});`;

  const htmlDataAttrSnippet = `<!-- 2. Zero-JS HTML Data Attribute Integration -->
<button
  data-openupi-checkout
  data-openupi-amount="${amount}"
  data-openupi-order-id="${orderId}"
  data-openupi-name="${customerName}"
  data-openupi-phone="${customerPhone}"
  class="btn-upi-pay"
>
  Pay ₹${amount} with UPI
</button>
<script src="/openupi.js" async></script>`;

  return (
    <div className="space-y-6">
      {/* Module Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                Module 01
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Universal JavaScript SDK</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              openupi.js — Universal Checkout Engine
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Zero-dependency client library deployable via pure HTML data attributes or programmatic JavaScript. Automatically serves desktop center modals and mobile bottom sheets with real-time polling.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/openupi.js"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              <span>View Raw openupi.js</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Launcher */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-sky-400" />
              Interactive SDK Trigger
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Payment Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-mono text-slate-500">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Merchant Order ID
                </label>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Viewport Form Factor Switcher */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Checkout Form Factor Preview
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                      previewMode === 'desktop'
                        ? 'bg-slate-800 text-sky-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop Modal</span>
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile_drawer')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                      previewMode === 'mobile_drawer'
                        ? 'bg-slate-800 text-sky-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile Drawer</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={handleLaunchProgrammatic}
                  className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-sky-600/20"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Launch via Programmatic JS (OpenUPI.open)</span>
                </button>

                <button
                  onClick={handleLaunchDataAttr}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Code2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Simulate HTML [data-openupi-checkout] Click</span>
                </button>
              </div>
            </div>
          </div>

          {/* Callback Event Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Live Callback Event Stream
              </h3>
              <button
                onClick={() => setEventLogs([])}
                className="text-[11px] text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] space-y-1.5 max-h-48 overflow-y-auto">
              {eventLogs.length === 0 ? (
                <div className="text-slate-600">No events yet. Trigger checkout above to observe.</div>
              ) : (
                eventLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-slate-600 shrink-0">{log.time}</span>
                    <span className="text-sky-400 font-semibold shrink-0">{log.event}:</span>
                    <span className="text-slate-300 break-all">{log.detail}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Integration Code Snippets */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Code2 className="w-4 h-4 text-sky-400" />
                Integration Code Snippets
              </h3>
              <button
                onClick={() => copySnippet(programmaticSnippet)}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy JS'}</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Method A: Programmatic JavaScript Call</span>
                  <span className="text-[11px] text-sky-400">Recommended for SPAs</span>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                  {programmaticSnippet}
                </pre>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Method B: Declarative HTML Data Attributes</span>
                  <span className="text-[11px] text-amber-400">Zero JavaScript required</span>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
                  {htmlDataAttrSnippet}
                </pre>
              </div>
            </div>

            {/* Feature Checklist */}
            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Responsive Desktop Modal</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Mobile Bottom Drawer Sheet</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Automatic 2s Polling Worker</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>DOM Mutation Observer auto-bind</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Render Checkout Modal if active */}
      {activeSession && (
        <CheckoutModal
          session={activeSession.session}
          intents={activeSession.intents}
          mode={previewMode}
          onClose={() => {
            logEvent('onClose', 'Modal dismissed by user');
            setActiveSession(null);
          }}
          onSuccess={(settled) => {
            logEvent('onSuccess', `Payment confirmed for ${settled.id} (₹${settled.amount})`);
          }}
        />
      )}
    </div>
  );
};
