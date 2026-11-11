import React, { useState, useEffect } from 'react';
import { Palette, Globe, CheckCircle2, ShieldCheck, RefreshCw, Eye, Sparkles } from 'lucide-react';
import { MerchantConfig } from '../../types/index.ts';

const PRESET_COLORS = [
  { name: 'Sky Tech', hex: '#0284c7' },
  { name: 'Emerald Pay', hex: '#059669' },
  { name: 'Royal Indigo', hex: '#4f46e5' },
  { name: 'Amber Glow', hex: '#d97706' },
  { name: 'Crimson Edge', hex: '#e11d48' },
  { name: 'Midnight Violet', hex: '#7c3aed' },
];

export const WhiteLabelModule: React.FC = () => {
  const [config, setConfig] = useState<MerchantConfig | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#0284c7');
  const [merchantName, setMerchantName] = useState('Acme Retail & Tech Ltd');
  const [logoUrl, setLogoUrl] = useState('');
  const [supportEmail, setSupportEmail] = useState('payments@acmeretail.in');
  const [supportPhone, setSupportPhone] = useState('+91 80 4920 1200');
  const [customDomain, setCustomDomain] = useState('pay.acmeretail.in');
  const [domainStatus, setDomainStatus] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingDomain, setIsVerifyingDomain] = useState(false);

  const fetchBranding = async () => {
    try {
      const res = await fetch('/api/v1/white-label');
      const data = await res.json();
      if (data && data.config) {
        setConfig(data.config);
        setPrimaryColor(data.config.primaryColor);
        setMerchantName(data.config.name);
        setLogoUrl(data.config.logoUrl || '');
        setSupportEmail(data.config.supportEmail);
        setSupportPhone(data.config.supportPhone);
        setCustomDomain(data.config.customDomain);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const handleSaveBranding = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/v1/white-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryColor,
          name: merchantName,
          logoUrl,
          supportEmail,
          supportPhone,
        }),
      });
      const data = await res.json();
      if (data && data.config) {
        setConfig(data.config);
        // Apply CSS variable to root document dynamically
        document.documentElement.style.setProperty('--oup-primary', primaryColor);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    setIsVerifyingDomain(true);
    try {
      const res = await fetch('/api/v1/white-label/verify-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: customDomain }),
      });
      const data = await res.json();
      setDomainStatus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifyingDomain(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Module 08
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">White-Label Customization</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            White-Label Branding & Custom Domain Routing
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Eliminates external gateway branding. Customize checkout colors, logos, support contacts, and custom domain CNAME records for 100% brand sovereignty.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Branding Controls */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-sky-400" />
              Brand Theme & Appearance
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Primary Brand Colour
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-8 rounded bg-transparent border border-slate-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setPrimaryColor(c.hex)}
                        title={c.name}
                        className={`w-6 h-6 rounded-full border ${
                          primaryColor === c.hex ? 'border-white scale-110' : 'border-transparent'
                        } transition-transform`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Merchant Trading Name
                </label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Support Phone
                  </label>
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveBranding}
                disabled={isSaving}
                className="w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Save White-Label Tokens</span>
              </button>
            </div>
          </div>

          {/* Custom Domain Routing */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" />
              Custom Domain & SSL Mapping
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Custom Checkout Hostname
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                    placeholder="e.g. checkout.brand.com"
                  />
                  <button
                    onClick={handleVerifyDomain}
                    disabled={isVerifyingDomain}
                    className="px-3.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
                  >
                    {isVerifyingDomain ? 'Validating...' : 'Verify DNS'}
                  </button>
                </div>
              </div>

              {domainStatus && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white font-semibold">{domainStatus.domain}</span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      SSL {domainStatus.sslStatus}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    CNAME Target: <span className="text-sky-400">{domainStatus.cnameTarget}</span>
                  </div>
                  <div className="text-[11px] text-emerald-400">{domainStatus.message}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Real-time Live Checkout Preview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                Live White-Label Modal Preview
              </h3>
              <span className="text-[11px] text-slate-500">Real-time render</span>
            </div>

            {/* Mocked Checkout Box rendered with customized brand tokens */}
            <div className="max-w-sm mx-auto bg-white rounded-xl overflow-hidden shadow-2xl border border-slate-200">
              {/* Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center font-bold text-white text-xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    U
                  </div>
                  <div>
                    <div className="text-xs font-bold">{merchantName}</div>
                    <div className="text-[10px] text-slate-400">Direct Checkout</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">Total</div>
                  <div className="text-xs font-mono font-bold text-sky-400">₹499.00</div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3 text-center">
                <div className="w-36 h-36 bg-slate-100 rounded-lg border border-slate-200 mx-auto flex items-center justify-center text-slate-400 text-xs">
                  [Dynamic QR]
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  Scan & Pay with any UPI app
                </div>
                <button
                  className="w-full py-2 rounded text-white text-xs font-semibold shadow"
                  style={{ backgroundColor: primaryColor }}
                >
                  Pay ₹499 with UPI
                </button>
                <div className="text-[10px] text-slate-400 pt-1">
                  Need help? Contact {supportEmail}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
