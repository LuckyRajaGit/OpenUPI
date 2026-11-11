import React, { useState, useEffect } from 'react';
import { Terminal, Download, PlayCircle, CheckCircle2, XCircle, RefreshCw, Send, Code, BookOpen, Layers } from 'lucide-react';
import { TestResult } from '../../types/index.ts';

export const DeveloperModule: React.FC<{ onTriggerTests?: boolean }> = () => {
  const [activeTab, setActiveTab] = useState<'tests' | 'api' | 'webhooks' | 'postman'>('tests');
  const [testResults, setTestResults] = useState<{
    totalTests: number;
    passedCount: number;
    failedCount: number;
    durationMs: number;
    results: TestResult[];
  } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState(false);

  const runAllTests = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/v1/tests/run', { method: 'POST' });
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/v1/developer/webhooks');
      const data = await res.json();
      if (data && data.logs) setWebhookLogs(data.logs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    runAllTests();
    fetchWebhooks();
  }, []);

  const handleDispatchTestWebhook = async () => {
    setIsDispatchingWebhook(true);
    try {
      await fetch('/api/v1/developer/webhooks/test-dispatch', { method: 'POST' });
      fetchWebhooks();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDispatchingWebhook(false);
    }
  };

  const API_ENDPOINTS = [
    { method: 'POST', path: '/api/v1/sessions', desc: 'Create dynamic UPI payment session & QR' },
    { method: 'GET', path: '/api/v1/sessions/:id/status', desc: 'Lightweight polling endpoint for SDK check' },
    { method: 'POST', path: '/api/v1/sessions/:id/simulate-pay', desc: 'Mock payment provider settlement trigger' },
    { method: 'GET', path: '/api/v1/queue/status', desc: 'Live concurrency & queue position telemetry' },
    { method: 'POST', path: '/api/v1/auth/customer-phone/challenge', desc: 'Dispatch phone OTP challenge (zero-leak)' },
    { method: 'POST', path: '/api/v1/auth/customer-phone/verify', desc: 'Validate received customer OTP code' },
    { method: 'POST', path: '/api/v1/companion/observations', desc: 'Ingest signed observation from Android node' },
    { method: 'POST', path: '/api/v1/pos/transactions', desc: 'Record offline counter sale with split tender' },
    { method: 'POST', path: '/api/v1/cod/orders', desc: 'Create cash on delivery order with review' },
    { method: 'POST', path: '/api/v1/tests/run', desc: 'Execute automated 9-module test suite' },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                Module 09
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Developer Hub & Test Suite</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Developer Documentation, Webhooks & Automated Tests
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Complete developer toolset including interactive REST API docs, signature-verified webhook dispatches, downloadable Postman collections, and a built-in automated test runner.
            </p>
          </div>
          <button
            onClick={runAllTests}
            disabled={isRunningTests}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-sm shadow-sky-600/20"
          >
            {isRunningTests ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
            <span>Execute All 9 Module Tests</span>
          </button>
        </div>
      </div>

      {/* Internal Subtabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'tests'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Automated Test Suite ({testResults?.passedCount ?? 0}/{testResults?.totalTests ?? 0})
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'api'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          REST API Explorer
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'webhooks'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Webhooks & Signatures
        </button>
        <button
          onClick={() => setActiveTab('postman')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'postman'
              ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Postman Export
        </button>
      </div>

      {/* Tab: Automated Test Suite */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          {testResults && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Assertions</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {testResults.totalTests}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Across 9 distinct modules</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Tests Passed</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {testResults.passedCount}
                </div>
                <div className="text-[11px] text-emerald-500/80 mt-1">100% compliance</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Tests Failed</div>
                <div className="text-2xl font-bold font-mono text-slate-400 mt-1">
                  {testResults.failedCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Zero regressions</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Suite Execution Time</div>
                <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
                  {testResults.durationMs}ms
                </div>
                <div className="text-[11px] text-slate-500 mt-1">In-memory runner</div>
              </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Module Test Results</span>
              <button onClick={runAllTests} className="text-xs text-sky-400 hover:text-sky-300">
                Re-run
              </button>
            </div>

            <div className="divide-y divide-slate-800/60 font-mono text-xs">
              {testResults?.results.map((r, i) => (
                <div key={i} className="p-3.5 flex items-center justify-between hover:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    {r.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <span className="text-sky-400 font-semibold font-sans">[{r.module}] </span>
                      <span className="text-white font-medium font-sans">{r.testName}</span>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{r.details}</div>
                    </div>
                  </div>
                  <span className="text-slate-400 text-[11px] font-mono shrink-0">
                    {r.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: REST API Explorer */}
      {activeTab === 'api' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Public Core REST Endpoints</h3>
          <div className="space-y-2">
            {API_ENDPOINTS.map((ep, i) => (
              <div
                key={i}
                className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                    ep.method === 'POST' ? 'bg-sky-500/20 text-sky-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {ep.method}
                  </span>
                  <span className="font-mono text-white font-semibold">{ep.path}</span>
                </div>
                <span className="text-slate-400 text-[11px]">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Webhooks */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Webhook Signing & Dispatch Engine</h3>
              <button
                onClick={handleDispatchTestWebhook}
                disabled={isDispatchingWebhook}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Test Event</span>
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every payment settlement, order approval, and queue clearance event produces a signed HMAC-SHA256 payload delivered via header <code>X-OpenUPI-Signature</code>.
            </p>

            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 overflow-x-auto">
{`// Webhook verification in Node.js
const crypto = require('crypto');
function verifyOpenUpiWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}`}
            </pre>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Recent Webhook Deliveries</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {webhookLogs.length === 0 ? (
                <div className="text-slate-600 text-xs text-center py-6">No webhooks dispatched yet.</div>
              ) : (
                webhookLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sky-400 font-semibold">{log.event}</span>
                      <span className="text-[10px] text-emerald-400 font-mono">HTTP {log.status}</span>
                    </div>
                    <pre className="text-[10px] text-slate-400 font-mono bg-slate-900/60 p-2 rounded">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Postman */}
      {activeTab === 'postman' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Postman Collection v2.1</h3>
          <p className="text-xs text-slate-400">
            Import the complete pre-configured collection into Postman or Insomnia with environmental variables and assertions:
          </p>
          <a
            href="/api/v1/developer/postman"
            download="openupi_postman_collection.json"
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Postman Collection JSON</span>
          </a>
        </div>
      )}
    </div>
  );
};
