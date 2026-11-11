import React, { useState, useEffect } from 'react';
import { Layers, ShieldAlert, Clock, Sliders, CheckCircle2, AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { QueueStatus, PaymentSession } from '../../types/index.ts';

export const PaymentQueueModule: React.FC = () => {
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    totalInQueue: 0,
    activeProcessing: 0,
    maxConcurrency: 3,
    availableSlots: 3,
    averageWaitTimeMs: 0,
  });

  const [sessions, setSessions] = useState<PaymentSession[]>([]);
  const [maxConcurrency, setMaxConcurrency] = useState(3);
  const [timeoutSeconds, setTimeoutSeconds] = useState(300);
  const [dupOrderId, setDupOrderId] = useState('ORD-QUE-DUP-1');
  const [dupResult, setDupResult] = useState<string | null>(null);
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  const fetchQueueData = async () => {
    try {
      const [resQ, resS] = await Promise.all([
        fetch('/api/v1/queue/status'),
        fetch('/api/v1/sessions'),
      ]);
      const dataQ = await resQ.json();
      const dataS = await resS.json();
      if (dataQ) {
        setQueueStatus(dataQ);
        setMaxConcurrency(dataQ.maxConcurrency);
      }
      if (dataS && dataS.sessions) {
        setSessions(dataS.sessions);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(fetchQueueData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateConfig = async () => {
    setIsUpdatingConfig(true);
    try {
      await fetch('/api/v1/queue/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxConcurrentPayments: maxConcurrency,
          paymentTimeoutSeconds: timeoutSeconds,
        }),
      });
      await fetchQueueData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  const handleSpawnTestSessions = async (count: number) => {
    for (let i = 0; i < count; i++) {
      const orderId = 'BATCH-' + Date.now().toString().slice(-4) + '-' + (i + 1);
      await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 299 + i * 50,
          orderId,
          method: 'UPI_QR',
        }),
      });
    }
    fetchQueueData();
  };

  const handleTestDuplicatePrevention = async () => {
    setDupResult('Testing idempotency check...');
    try {
      // First submission
      const res1 = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 500,
          orderId: dupOrderId,
          idempotencyKey: 'IDEMP_' + dupOrderId,
          method: 'UPI_QR',
        }),
      });
      const data1 = await res1.json();

      // Second identical submission immediately
      const res2 = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 500,
          orderId: dupOrderId,
          idempotencyKey: 'IDEMP_' + dupOrderId,
          method: 'UPI_QR',
        }),
      });
      const data2 = await res2.json();

      if (data2.isDuplicateReuse) {
        setDupResult(
          `Protected! Second submission was identified as duplicate. Reused existing session (${data2.session.id}) without creating parallel duplicate charge.`
        );
      } else {
        setDupResult(`Created session ${data2.session?.id}. Re-click to trigger duplicate protection.`);
      }
      fetchQueueData();
    } catch (err: any) {
      setDupResult('Error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
              Module 03
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400">Payment Queue Engine</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Database-Backed Payment Concurrency Queue
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Protects merchant UPI VPA endpoints against flood limits and race conditions. Implements atomic slot reservations, live position notifications, idempotency shields against duplicate charges, and automatic timeout recovery.
          </p>
        </div>
      </div>

      {/* Real-Time Queue Telemetry Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Active Processing</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {queueStatus.activeProcessing} / {queueStatus.maxConcurrency}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Concurrency slots filled</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Waiting In Queue</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {queueStatus.totalInQueue}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Sessions holding in buffer</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Available Slots</div>
          <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
            {queueStatus.availableSlots}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Immediate checkout bandwidth</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Est. Queue Latency</div>
          <div className="text-2xl font-bold font-mono text-slate-200 mt-1">
            {Math.round(queueStatus.averageWaitTimeMs / 1000)}s
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Safe processing throttle</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Concurrency Settings & Load Injector */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              Queue Limits Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Max Concurrent Active Payments:</span>
                  <span className="font-mono text-white font-bold">{maxConcurrency} slots</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={maxConcurrency}
                  onChange={(e) => setMaxConcurrency(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1 font-mono">
                  <span>1 (Strict throttle)</span>
                  <span>5 (Standard)</span>
                  <span>10 (High capacity)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Safe Payment Timeout (Seconds)
                </label>
                <input
                  type="number"
                  value={timeoutSeconds}
                  onChange={(e) => setTimeoutSeconds(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Watchdog marks stale sessions as EXPIRED and automatically admits next customer in queue.
                </p>
              </div>

              <button
                onClick={handleUpdateConfig}
                disabled={isUpdatingConfig}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isUpdatingConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>Apply Queue Limits</span>
              </button>
            </div>
          </div>

          {/* Traffic Spawner */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-400" />
              Traffic Burst Simulator
            </h3>
            <p className="text-xs text-slate-400">
              Instantly dispatch parallel checkout requests to witness automatic queueing when concurrency limits are breached.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleSpawnTestSessions(3)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              >
                +3 Parallel Sessions
              </button>
              <button
                onClick={() => handleSpawnTestSessions(5)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
              >
                +5 Parallel Sessions
              </button>
            </div>
          </div>

          {/* Duplicate Prevention Guard */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Duplicate Payment Prevention Guard
            </h3>
            <p className="text-xs text-slate-400">
              Simulates double-click / duplicate order submission with idempotency token validation.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={dupOrderId}
                onChange={(e) => setDupOrderId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
              />
              <button
                onClick={handleTestDuplicatePrevention}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Test Duplicate Lock
              </button>
            </div>
            {dupResult && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 font-mono">
                {dupResult}
              </div>
            )}
          </div>
        </div>

        {/* Live Queue Pipeline Visualizer */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                Live Pipeline State
              </h3>
              <button
                onClick={fetchQueueData}
                className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {/* Active Slots Grid */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>Active Slots ({queueStatus.activeProcessing} / {queueStatus.maxConcurrency})</span>
                <span className="text-[11px] text-emerald-400">Processing live</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: queueStatus.maxConcurrency }).map((_, i) => {
                  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE');
                  const sessionInSlot = activeSessions[i];
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border text-xs ${
                        sessionInSlot
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : 'bg-slate-950 border-slate-800 border-dashed text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-400">Slot #{i + 1}</span>
                        {sessionInSlot && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      {sessionInSlot ? (
                        <div className="space-y-1">
                          <div className="font-mono text-white font-bold truncate">
                            {sessionInSlot.orderId}
                          </div>
                          <div className="text-emerald-400 font-mono font-semibold">
                            ₹{sessionInSlot.amount.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-center text-slate-600 font-mono text-[11px]">
                          Available
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Waiting Buffer */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
                <span>Waiting Queue Buffer</span>
                <span className="text-[11px] text-amber-400 font-mono">
                  {queueStatus.totalInQueue} sessions waiting
                </span>
              </div>
              <div className="space-y-2">
                {sessions.filter((s) => s.status === 'QUEUED').length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs bg-slate-950 border border-slate-800/80 rounded-lg">
                    No sessions waiting in queue. All incoming payments process with zero wait.
                  </div>
                ) : (
                  sessions
                    .filter((s) => s.status === 'QUEUED')
                    .map((qs) => (
                      <div
                        key={qs.id}
                        className="flex items-center justify-between p-3 bg-slate-950 border border-amber-500/20 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
                            #{qs.queuePosition || 1}
                          </div>
                          <div>
                            <div className="font-mono text-white font-medium">{qs.orderId}</div>
                            <div className="text-[11px] text-slate-500">ID: {qs.id}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sky-400 font-bold">
                            ₹{qs.amount.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-amber-400">Waiting for slot</div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
