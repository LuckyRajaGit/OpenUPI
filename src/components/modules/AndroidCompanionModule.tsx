import React, { useState, useEffect } from 'react';
import { Smartphone, BatteryCharging, Wifi, ShieldAlert, Cpu, CheckCircle2, AlertTriangle, Plus, RefreshCw, Key, FileCode } from 'lucide-react';
import { AndroidDevice, CompanionObservation } from '../../types/index.ts';

export const AndroidCompanionModule: React.FC = () => {
  const [devices, setDevices] = useState<AndroidDevice[]>([]);
  const [observations, setObservations] = useState<CompanionObservation[]>([]);
  const [blueprint, setBlueprint] = useState<any>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('Samsung Galaxy S24 (Counter 1)');
  const [newDeviceModel, setNewDeviceModel] = useState('SM-S921B (Android 14)');
  const [isSimulatingObs, setIsSimulatingObs] = useState(false);
  const [simAmount, setSimAmount] = useState('1499.00');
  const [simSender, setSimSender] = useState('AXISBK-UPI');

  const fetchData = async () => {
    try {
      const [resD, resO, resB] = await Promise.all([
        fetch('/api/v1/companion/devices'),
        fetch('/api/v1/companion/observations'),
        fetch('/api/v1/companion/blueprint'),
      ]);
      const dataD = await resD.json();
      const dataO = await resO.json();
      const dataB = await resB.json();
      if (dataD && dataD.devices) setDevices(dataD.devices);
      if (dataO && dataO.observations) setObservations(dataO.observations);
      if (dataB) setBlueprint(dataB);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEnrollDevice = async () => {
    try {
      await fetch('/api/v1/companion/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceName: newDeviceName,
          model: newDeviceModel,
        }),
      });
      setShowEnrollModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateObservation = async () => {
    if (devices.length === 0) return;
    setIsSimulatingObs(true);
    try {
      await fetch('/api/v1/companion/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: devices[0].deviceId,
          rawSender: simSender,
          detectedAmount: parseFloat(simAmount),
          referenceId: 'UPI' + Date.now().toString().slice(-8),
          signature: 'hmac_sha256_' + Date.now(),
        }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSimulatingObs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                Module 05
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400">Android Companion Node</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Android Companion Node Architecture & Telemetry
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Enrolls dedicated Android hardware nodes for physical retail counters. Listens for incoming bank notifications, signs observation payloads with hardware keys, and reports battery/network health.
            </p>
          </div>
          <button
            onClick={() => setShowEnrollModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors shrink-0 shadow-sm shadow-sky-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enroll New Android Node</span>
          </button>
        </div>
      </div>

      {/* Strict Settlement Separation Warning Card */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-xs">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-slate-300">
          <span className="font-bold text-amber-300 block">
            Critical Invariant: Observations Must Never Independently Confirm Bank Settlement
          </span>
          <p className="leading-relaxed text-[11px] text-slate-400">
            Companion device observations capture local notifications to provide merchants with instant visual cues. However, local push notifications are subject to spoofing, race conditions, or device malware. The OpenUPI Core Engine treats observations strictly as <code>OBSERVED_UNVERIFIED</code> telemetry. Final settlement requires reconciliation with bank webhooks or official settlement statements.
          </p>
        </div>
      </div>

      {/* Enrolled Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((device) => (
          <div
            key={device.deviceId}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{device.deviceName}</h4>
                  <div className="text-[11px] text-slate-400">{device.model}</div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {device.status}
              </span>
            </div>

            {/* Hardware Health Metrics */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <BatteryCharging className="w-3 h-3 text-emerald-400" /> Battery
                </div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {device.batteryPercent}% {device.isCharging ? '(Charging)' : ''}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-sky-400" /> Temperature
                </div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {device.batteryTempC}°C
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-amber-400" /> Link
                </div>
                <div className="font-mono font-bold text-white mt-0.5">
                  {device.networkType}
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-500 truncate flex items-center justify-between">
              <span>Node ID: {device.deviceId}</span>
              <span>{device.firmwareVersion}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Simulation & Signed Observation Stream */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-400" />
              Simulate Inbound Push Capture
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Bank Sender ID
                </label>
                <select
                  value={simSender}
                  onChange={(e) => setSimSender(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="AXISBK-UPI">AXISBK-UPI</option>
                  <option value="HDFCBK-UPI">HDFCBK-UPI</option>
                  <option value="SBIPAY-UPI">SBIPAY-UPI</option>
                  <option value="ICICIB-UPI">ICICIB-UPI</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Captured Amount (INR)
                </label>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleSimulateObservation}
              disabled={isSimulatingObs || devices.length === 0}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isSimulatingObs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5 text-sky-400" />}
              <span>Emit Signed Observation from Node</span>
            </button>
          </div>

          {/* Signed Observation Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Signed Observation Audit Log
              </h3>
              <button onClick={fetchData} className="text-xs text-sky-400 hover:text-sky-300">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {observations.map((obs) => (
                <div
                  key={obs.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sky-400 font-semibold">{obs.rawSender}</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {obs.settlementStatus}
                    </span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-white font-bold">₹{obs.detectedAmount.toFixed(2)}</span>
                    <span className="text-slate-400 text-[11px]">{obs.referenceId}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    Signature: {obs.signature} (Verified: {obs.signatureValid ? 'Yes' : 'No'})
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Kotlin Architecture Blueprint */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">
                Kotlin Companion Architecture Blueprint
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Reference implementation using Android's native <code>NotificationListenerService</code> with hardware key signing:
            </p>

            {blueprint && (
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-96 leading-relaxed">
                {blueprint.serviceKotlinCode}
              </pre>
            )}
          </div>
        </div>
      </div>

      {/* Device Enrollment Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Enroll Android Hardware Node</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Device Label</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Hardware Model</label>
                <input
                  type="text"
                  value={newDeviceModel}
                  onChange={(e) => setNewDeviceModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollDevice}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg"
              >
                Enroll Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
