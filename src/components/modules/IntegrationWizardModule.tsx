import React, { useState } from 'react';
import {
  Code2,
  CheckCircle2,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Zap,
  Globe,
  ShoppingBag,
  Layers,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

export type PlatformId =
  | 'html'
  | 'php'
  | 'nodejs'
  | 'react'
  | 'nextjs'
  | 'wordpress'
  | 'woocommerce'
  | 'rest';

interface PlatformMeta {
  id: PlatformId;
  name: string;
  category: string;
  icon: string;
  setupTime: string;
}

const PLATFORMS: PlatformMeta[] = [
  { id: 'html', name: 'Custom HTML', category: 'Frontend Only', icon: '🌐', setupTime: '2 mins' },
  { id: 'php', name: 'PHP Website', category: 'Backend / CMS', icon: '🐘', setupTime: '5 mins' },
  { id: 'nodejs', name: 'Node.js / Express', category: 'Backend Server', icon: '🟢', setupTime: '5 mins' },
  { id: 'react', name: 'React SPA', category: 'Frontend Framework', icon: '⚛️', setupTime: '3 mins' },
  { id: 'nextjs', name: 'Next.js (App Router)', category: 'Full Stack', icon: '▲', setupTime: '4 mins' },
  { id: 'wordpress', name: 'WordPress', category: 'CMS Shortcode', icon: '📝', setupTime: '3 mins' },
  { id: 'woocommerce', name: 'WooCommerce', category: 'E-Commerce Plugin', icon: '🛍️', setupTime: '5 mins' },
  { id: 'rest', name: 'Other REST API', category: 'Custom Stack', icon: '⚡', setupTime: '5 mins' },
];

export const IntegrationWizardModule: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>('woocommerce');
  const [currentStep, setCurrentStep] = useState(1);
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:3000');
  const [testApiKey] = useState('oup_test_8f294ba713cd4109b8');
  const [webhookSecret] = useState('whsec_a891f7c239401829e1');
  const [merchantWebhookUrl, setMerchantWebhookUrl] = useState('https://mystore.example.com/api/openupi/webhook');
  const [copiedCode, setCopiedCode] = useState(false);
  const [testPaymentStatus, setTestPaymentStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [testWebhookStatus, setTestWebhookStatus] = useState<'idle' | 'running' | 'verified' | 'failed'>('idle');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSimulateTestPayment = async () => {
    setTestPaymentStatus('running');
    try {
      const res = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 499.0,
          orderId: 'WIZARD-TEST-' + Date.now().toString().slice(-4),
          method: 'UPI_QR',
        }),
      });
      const data = await res.json();
      if (data && data.session) {
        // Auto-settle mock payment
        await fetch(`/api/v1/sessions/${data.session.id}/simulate-pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        setTestPaymentStatus('success');
      }
    } catch {
      setTestPaymentStatus('failed');
    }
  };

  const handleVerifyWebhook = async () => {
    setTestWebhookStatus('running');
    try {
      const res = await fetch('/api/v1/developer/webhooks/test-dispatch', { method: 'POST' });
      const data = await res.json();
      if (data && data.success) {
        setTestWebhookStatus('verified');
      }
    } catch {
      setTestWebhookStatus('failed');
    }
  };

  // Integration Status Logic
  const getIntegrationStatus = () => {
    if (testPaymentStatus === 'success' && testWebhookStatus === 'verified') {
      return {
        label: 'Test Successful · Live Activation Pending',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        note: 'All integration tests verified. Complete authorized provider onboarding to enable live bank settlement.',
      };
    }
    if (testPaymentStatus === 'success' || testWebhookStatus === 'verified') {
      return {
        label: 'Testing In Progress',
        badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        note: 'Complete Step 7 (Test Payment) and Step 8 (Webhook Verification) to confirm integration.',
      };
    }
    return {
      label: 'Configuration Incomplete',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      note: 'Follow the 9 steps below to connect your store with OpenUPI Gateway.',
    };
  };

  const status = getIntegrationStatus();

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                Merchant Onboarding
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Step-by-Step Integration Wizard</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Integrate OpenUPI into Your Website
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Connect your website or e-commerce store to collect direct UPI payments with zero transaction fees. Select your platform below to get tailored installation commands, copyable code, and testing tools.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold px-3 py-1 rounded-lg border ${status.badgeClass}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Step 1: Platform Selection Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span>Step 1: Select Your Website Platform</span>
          <span className="text-slate-500">Selected: {PLATFORMS.find((p) => p.id === selectedPlatform)?.name}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PLATFORMS.map((plat) => {
            const isSelected = selectedPlatform === plat.id;
            return (
              <button
                key={plat.id}
                onClick={() => {
                  setSelectedPlatform(plat.id);
                  if (currentStep < 2) setCurrentStep(2);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-sky-500/10 border-sky-500/40 shadow-sm'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{plat.icon}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{plat.setupTime}</span>
                </div>
                <div className="font-bold text-xs text-white">{plat.name}</div>
                <div className="text-[10px] text-slate-400">{plat.category}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 9-Step Guided Workflow */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            Integration Setup Steps ({PLATFORMS.find((p) => p.id === selectedPlatform)?.name})
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <span>Step {currentStep} of 9</span>
          </div>
        </div>

        {/* Step 2: Test API Keys */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">2</span>
              Generate or Select Test API Keys
            </span>
            <span className="text-[11px] text-emerald-400">Sandbox Active</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-500 uppercase">Merchant API Key (Secret)</div>
              <div className="font-mono text-xs text-sky-400 mt-0.5 truncate select-all">{testApiKey}</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-500 uppercase">Webhook Signing Secret</div>
              <div className="font-mono text-xs text-purple-400 mt-0.5 truncate select-all">{webhookSecret}</div>
            </div>
          </div>
        </div>

        {/* Step 3: Gateway URL Configuration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">3</span>
              Configure Self-Hosted Gateway URL
            </span>
          </div>
          <div className="pl-7">
            <input
              type="text"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              className="w-full sm:w-96 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              The public endpoint where your OpenUPI Gateway is hosted. In production, use your custom verified domain (e.g. <code>https://pay.mybrand.in</code>).
            </p>
          </div>
        </div>

        {/* Step 4 & 5: Installation Commands & Copyable Code */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">4 & 5</span>
              Installation & Integration Code
            </span>
            <button
              onClick={() => copyToClipboard(getPlatformCode(selectedPlatform, gatewayUrl, testApiKey))}
              className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code Snippet'}</span>
            </button>
          </div>

          <div className="pl-7">
            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed max-h-80">
              {getPlatformCode(selectedPlatform, gatewayUrl, testApiKey)}
            </pre>
          </div>
        </div>

        {/* Step 6: Webhook Endpoint Configuration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">6</span>
              Configure Webhook Endpoint on Your Server
            </span>
          </div>
          <div className="pl-7 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={merchantWebhookUrl}
                onChange={(e) => setMerchantWebhookUrl(e.target.value)}
                placeholder="https://yourstore.com/api/webhook"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
              <button
                onClick={handleVerifyWebhook}
                className="px-3.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
              >
                Send Test Webhook
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              OpenUPI delivers HMAC-SHA256 signed events with header <code>X-OpenUPI-Signature</code> and timestamp <code>t=</code> for replay prevention.
            </p>
          </div>
        </div>

        {/* Step 7 & 8: Interactive Test Verification */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">7 & 8</span>
              Run Test Transaction & Verify Webhook Delivery
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">7. Test Payment Session</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  testPaymentStatus === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {testPaymentStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dispatches a simulated ₹499 payment to verify session creation and polling resolution.
              </p>
              <button
                onClick={handleSimulateTestPayment}
                disabled={testPaymentStatus === 'running'}
                className="w-full py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded text-xs font-semibold transition-colors"
              >
                {testPaymentStatus === 'running' ? 'Simulating...' : 'Run Test Payment (₹499)'}
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">8. Webhook Signature Check</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  testWebhookStatus === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {testWebhookStatus.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dispatches a test signed payload to verify your HMAC-SHA256 signature algorithm.
              </p>
              <button
                onClick={handleVerifyWebhook}
                disabled={testWebhookStatus === 'running'}
                className="w-full py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded text-xs font-semibold transition-colors"
              >
                {testWebhookStatus === 'running' ? 'Verifying...' : 'Verify Webhook Delivery'}
              </button>
            </div>
          </div>
        </div>

        {/* Step 9: Live Activation Checklist */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs font-semibold text-white">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[11px] font-bold">9</span>
              Production Activation Requirements
            </span>
          </div>
          <div className="pl-7 bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-slate-300">
                HTTPS/TLS 1.3 enforced on your gateway custom domain.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-slate-300">
                Private API key stored strictly in backend server environment variables.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-slate-300">
                <strong>Authorised Provider Requirement:</strong> Live mode remains inactive until verified bank credentials (NPCI/Bank VPA) are connected.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function getPlatformCode(platform: PlatformId, gatewayUrl: string, apiKey: string): string {
  switch (platform) {
    case 'html':
      return `<!-- 1. Include OpenUPI Universal SDK -->
<script src="${gatewayUrl}/openupi.js" async></script>

<!-- 2. Declarative Pay Button with Data Attributes -->
<button
  data-openupi-checkout
  data-openupi-amount="650.00"
  data-openupi-order-id="ORD-101"
  data-openupi-name="Aarav Sharma"
  data-openupi-success-callback="onSuccess"
>
  Pay ₹650 with UPI
</button>

<script>
  function onSuccess(detail) {
    alert("Payment Settled! Transaction Ref: " + detail.paymentId);
  }
</script>`;

    case 'woocommerce':
      return `// 1. Copy plugin class to:
// wp-content/plugins/openupi-woocommerce/class-wc-gateway-openupi.php
// (See working file in examples/woocommerce/class-wc-gateway-openupi.php)

// 2. Configure in WordPress Admin:
// WooCommerce > Settings > Payments > OpenUPI Gateway:
// - Gateway URL: ${gatewayUrl}
// - API Key: ${apiKey}
// - Webhook Secret: whsec_...

// 3. Supported Features:
// - Instant Dynamic QR & Mobile Intent
// - WooCommerce automated refunds from order screen
// - Signature-verified webhook settlement`;

    case 'nodejs':
      return `// Node.js Express Backend Payment Creation
const express = require('express');
const app = express();

app.post('/api/create-payment', async (req, res) => {
  const response = await fetch('${gatewayUrl}/api/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.OPENUPI_API_KEY,
      'Idempotency-Key': req.body.orderId
    },
    body: JSON.stringify({
      amount: req.body.amount,
      orderId: req.body.orderId,
      customerName: req.body.name,
      method: 'UPI_QR'
    })
  });
  const data = await response.json();
  res.json(data);
});`;

    case 'nextjs':
      return `// app/api/checkout/route.ts (Next.js App Router)
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { amount, orderId, name } = await req.json();
  const res = await fetch('${gatewayUrl}/api/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.OPENUPI_API_KEY,
      'Idempotency-Key': orderId
    },
    body: JSON.stringify({ amount, orderId, customerName: name, method: 'UPI_QR' })
  });
  const data = await res.json();
  return NextResponse.json(data);
}`;

    case 'react':
      return `// React Checkout Button Component
export function UPIPayButton({ amount, orderId, name }) {
  const handlePay = () => {
    window.OpenUPI.open({
      amount,
      orderId,
      name,
      onSuccess: (data) => window.location.href = '/success?ref=' + data.paymentId,
      onFailure: (err) => alert('Payment failed: ' + err.error)
    });
  };

  return (
    <button onClick={handlePay} className="btn-upi">
      Pay ₹{amount} with UPI
    </button>
  );
}`;

    case 'php':
      return `<?php
// PHP cURL session creation (See examples/php/checkout.php)
$ch = curl_init('${gatewayUrl}/api/v1/sessions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'amount'  => 500.00,
    'orderId' => 'PHP-' . time(),
    'method'  => 'UPI_QR'
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . getenv('OPENUPI_API_KEY')
]);
$res = curl_exec($ch);
$session = json_decode($res, true)['session'];
?>`;

    case 'wordpress':
      return `// WordPress Shortcode Integration
// Paste in functions.php or plugin:
// (See working file in examples/wordpress/openupi-shortcode.php)
// Use in any post or page:
// [openupi_checkout amount="499" order_id="WP-101" text="Pay with UPI"]`;

    default:
      return `# Standard REST API Integration:
# 1. Create Session:
POST ${gatewayUrl}/api/v1/sessions
Headers:
  Authorization: Bearer ${apiKey}
  Content-Type: application/json
Body:
  { "amount": 499.00, "orderId": "ORD-101", "method": "UPI_QR" }

# 2. Poll Status:
GET ${gatewayUrl}/api/v1/sessions/{sessionId}/status`;
  }
}
