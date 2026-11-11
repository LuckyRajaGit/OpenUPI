import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Database,
  Cpu,
  RefreshCw,
  AlertOctagon,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Zap,
} from 'lucide-react';
import { SystemHealthState } from '../../types/index.ts';

export const DebuggingModule: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthState | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [failedPayments, setFailedPayments] = useState<any[]>([]);
  const [failedWebhooks, setFailedWebhooks] = useState<any[]>([]);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDebugData = async () => {
    setIsRefreshing(true);
    try {
      const [resH, resL, resFP, resFW] = await Promise.all([
        fetch('/api/v1/debug/health'),
        fetch('/api/v1/debug/logs?limit=100'),
        fetch('/api/v1/debug/failed-payments'),
        fetch('/api/v1/debug/failed-webhooks'),
      ]);

      const dataH = await resH.json();
      const dataL = await resL.json();
      const dataFP = await resFP.json();
      const dataFW = await resFW.json();

      if (dataH) setHealth(dataH);
      if (dataL && dataL.logs) setLogs(dataL.logs);
      if (dataFP && dataFP.failures) setFailedPayments(dataFP.failures);
      if (dataFW && dataFW.failures) setFailedWebhooks(dataFW.failures);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
    const interval = setInterval(fetchDebugData, 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = selectedLogLevel === 'ALL' || log.level === selectedLogLevel;
    const matchesSearch =
      !searchQuery ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.requestId && log.requestId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                System Diagnostics
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Error Monitoring & Telemetry</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Developer Debugging & Error Monitoring Dashboard
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Provides real-time visibility into runtime health, database consistency, Redis cache, queue workers, bank provider status, correlation request IDs, and structured application logs.
            </p>
          </div>
          <button
            onClick={fetchDebugData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>
      </div>

      {/* Subsystem Health Cards Grid */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Gateway Core</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="font-mono text-base font-bold text-white">{health.application.status}</div>
            <div className="text-[10px] text-slate-500 font-mono">
              Up {Math.floor(health.application.uptimeSeconds / 60)}m · Node {health.application.nodeVersion}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Database Store</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="font-mono text-base font-bold text-white">{health.database.status}</div>
            <div className="text-[10px] text-slate-500 font-mono">
              {health.database.totalRecords} records · Integrity OK
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Redis Cache</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="font-mono text-base font-bold text-white">{health.redis.status}</div>
            <div className="text-[10px] text-slate-500 font-mono">
              {health.redis.latencyMs}ms latency · {health.redis.totalKeys} keys
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Queue Watchdog</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="font-mono text-base font-bold text-white">{health.workers.queueWatchdog}</div>
            <div className="text-[10px] text-slate-500 font-mono">Slot watchdog active</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">UPI Sandbox</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="font-mono text-base font-bold text-white">{health.paymentProvider.status}</div>
            <div className="text-[10px] text-slate-500 font-mono">Circuit: Closed</div>
          </div>
        </div>
      )}

      {/* Structured Log Viewer with Search & Correlation Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Structured Application Event Logs</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Level Filter Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-semibold">
              {['ALL', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLogLevel(lvl)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    selectedLogLevel === lvl
                      ? 'bg-slate-800 text-sky-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search message or Request ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs font-mono text-white focus:outline-none w-48 sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Log Stream Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs max-h-96 overflow-y-auto divide-y divide-slate-850">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-600">No logs found matching filter criteria.</div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-2.5 hover:bg-slate-900/60 transition-colors flex items-start gap-3">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                    log.level === 'ERROR'
                      ? 'bg-rose-500/20 text-rose-400'
                      : log.level === 'WARN'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {log.level}
                </span>

                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-slate-500 text-[11px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="text-sky-400 font-semibold">[{log.module}]</span>
                    <span className="text-slate-200 font-sans text-xs">{log.message}</span>
                  </div>

                  {log.requestId && (
                    <div className="text-[11px] text-slate-500">
                      Correlation ID: <span className="text-slate-400">{log.requestId}</span>
                    </div>
                  )}

                  {log.context && Object.keys(log.context).length > 0 && (
                    <pre className="text-[10px] text-slate-400 bg-slate-900/40 p-1.5 rounded border border-slate-850 overflow-x-auto">
                      {JSON.stringify(log.context, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Failed Operations Monitoring Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failed Payment Requests */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              Failed Payment Requests
            </h4>
            <span className="text-xs text-slate-500 font-mono">{failedPayments.length} logged</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {failedPayments.length === 0 ? (
              <div className="text-xs text-slate-600 text-center py-6 bg-slate-950 rounded-lg border border-slate-800/60">
                Zero payment failures recorded.
              </div>
            ) : (
              failedPayments.map((fp) => (
                <div key={fp.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-white font-semibold">{fp.orderId}</span>
                    <span className="text-rose-400 font-bold">₹{fp.amount?.toFixed(2)}</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">{fp.reason}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Failed Webhook Deliveries */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-400" />
              Failed Webhook Deliveries
            </h4>
            <span className="text-xs text-slate-500 font-mono">{failedWebhooks.length} logged</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {failedWebhooks.length === 0 ? (
              <div className="text-xs text-slate-600 text-center py-6 bg-slate-950 rounded-lg border border-slate-800/60">
                Zero webhook delivery failures recorded.
              </div>
            ) : (
              failedWebhooks.map((fw) => (
                <div key={fw.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-amber-400 font-semibold">{fw.event}</span>
                    <span className="text-[10px] text-slate-500">Retry #{fw.retryCount}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] truncate">{fw.url}</div>
                  <div className="text-rose-400 text-[10px]">{fw.error}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
