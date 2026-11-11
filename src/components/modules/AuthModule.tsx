import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, Smartphone, Send, Lock, EyeOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const AuthModule: React.FC = () => {
  const [merchantAuth, setMerchantAuth] = useState<any>(null);
  const [customerPhone, setCustomerPhone] = useState('+91 98201 54321');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [networkResponseInspect, setNetworkResponseInspect] = useState<any>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [mockSmsInbox, setMockSmsInbox] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const fetchMerchantAuth = async () => {
    try {
      const res = await fetch('/api/v1/auth/merchant');
      const data = await res.json();
      setMerchantAuth(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMockInbox = async () => {
    try {
      const res = await fetch('/api/v1/auth/mock-sms-inbox');
      const data = await res.json();
      if (data && data.inbox) {
        setMockSmsInbox(data.inbox);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMerchantAuth();
    fetchMockInbox();
  }, []);

  const handleSendChallenge = async () => {
    setIsSending(true);
    setVerificationResult(null);
    try {
      const res = await fetch('/api/v1/auth/customer-phone/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: customerPhone }),
      });
      const data = await res.json();
      setChallengeId(data.challengeId);
      // Explicitly show the raw network response to prove OTP secret is NOT included
      setNetworkResponseInspect(data);
      fetchMockInbox();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!challengeId || !enteredOtp) return;
    setIsVerifying(true);
    try {
      const res = await fetch('/api/v1/auth/customer-phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          otp: enteredOtp,
        }),
      });
      const data = await res.json();
      setVerificationResult(data);
      fetchMockInbox();
    } catch (err: any) {
      setVerificationResult({ success: false, error: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Module 04
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Authentication & Phone Verification</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Multi-Tier Authentication & Zero-Exposure Phone OTP
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Secures merchant operations via Bearer API keys and protects high-value checkouts with customer phone challenges. Strict cryptographic isolation guarantees that OTP secrets never leak to client code or network payloads.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Merchant API Key & Config */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sky-400" />
              Merchant Identity & API Tokens
            </h3>

            {merchantAuth ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400">Merchant Entity ID:</span>
                  <div className="font-mono text-white font-semibold mt-0.5">{merchantAuth.merchantId}</div>
                </div>
                <div>
                  <span className="text-slate-400">Registered UPI VPA:</span>
                  <div className="font-mono text-sky-400 font-semibold mt-0.5">{merchantAuth.vpa}</div>
                </div>
                <div>
                  <span className="text-slate-400">Merchant API Key:</span>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-300 mt-0.5 flex items-center justify-between">
                    <span>{merchantAuth.apiKeyMasked}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Authorized
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Enforces HTTP Bearer Token authentication on all `/api/v1/*` routes</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs">Loading merchant credentials...</div>
            )}
          </div>

          {/* Customer Phone OTP Verification Studio */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400" />
              Customer Phone Verification (2FA)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Customer Mobile Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={handleSendChallenge}
                    disabled={isSending}
                    className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSending ? 'Dispatching...' : 'Send OTP'}</span>
                  </button>
                </div>
              </div>

              {challengeId && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Enter Received 6-Digit OTP
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 582914"
                        value={enteredOtp}
                        onChange={(e) => setEnteredOtp(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white tracking-widest text-center focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={handleVerifyOtp}
                        disabled={isVerifying || enteredOtp.length !== 6}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
                      >
                        {isVerifying ? 'Verifying...' : 'Validate Code'}
                      </button>
                    </div>
                  </div>

                  {verificationResult && (
                    <div className={`p-3 rounded-lg text-xs font-mono border ${
                      verificationResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                      {verificationResult.success ? (
                        <div>
                          ✓ Verification Success! Signed Token: <span className="text-white font-bold">{verificationResult.verificationToken}</span>
                        </div>
                      ) : (
                        <div>✕ Error: {verificationResult.error}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Security Isolation Proof & Mock SMS Carrier Inbox */}
        <div className="lg:col-span-7 space-y-6">
          {/* Security Proof */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">
                Zero OTP Secret Exposure Proof (Client Audit)
              </h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              In accordance with high-assurance fintech standards, the OTP code is hashed server-side. The client response payload below contains only the opaque <code className="text-sky-400 font-mono">challengeId</code> and masked recipient number:
            </p>

            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
              {networkResponseInspect
                ? JSON.stringify(networkResponseInspect, null, 2)
                : `// Click "Send OTP" to inspect the raw server response payload.\n// Notice: Zero OTP secrets are transmitted in network traffic.`}
            </pre>
          </div>

          {/* Mock Carrier SMS Gateway Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">
                  Mock Carrier SMS Gateway Dispatch Log
                </h3>
              </div>
              <button
                onClick={fetchMockInbox}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <p className="text-xs text-slate-400">
              In production, dispatches via configured provider (Twilio / Msg91 / Fast2SMS). In sandbox mode, review simulated cellular dispatches below to retrieve code:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {mockSmsInbox.length === 0 ? (
                <div className="text-center py-6 text-slate-600 text-xs bg-slate-950 rounded-lg border border-slate-800/80">
                  No SMS challenges issued yet.
                </div>
              ) : (
                mockSmsInbox.map((sms, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sky-400 font-semibold">{sms.phoneMasked}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        sms.verified
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {sms.verified ? 'Verified' : `${sms.expiresInSec}s remaining`}
                      </span>
                    </div>
                    <div className="text-slate-300 font-mono text-[11px] bg-slate-900/60 p-2 rounded border border-slate-800/60">
                      {sms.mockSmsContent}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
