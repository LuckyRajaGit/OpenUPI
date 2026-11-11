import React from 'react';
import { ShieldAlert, Globe, ShoppingBag, Terminal } from 'lucide-react';

interface NavbarProps {
  onOpenStore: () => void;
  onRunSecurityTests: () => void;
  onOpenWizard: () => void;
  mockMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenStore,
  onRunSecurityTests,
  onOpenWizard,
  mockMode,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-950 text-slate-100 sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-bold text-white shadow-sm shadow-sky-600/30">
          U
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            OpenUPI Gateway
          </span>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            Self-Hosted UPI Platform
          </span>
        </div>
      </div>

      {/* Zone 2: Clean single-line navigation indicators */}
      <nav className="hidden lg:flex items-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Gateway Core: Active
        </span>
        <span className="text-slate-700">·</span>
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {mockMode ? 'Mock Sandbox Mode' : 'Live Provider Connected'}
        </span>
        <span className="text-slate-700">·</span>
        <span className="font-mono text-slate-400 whitespace-nowrap">
          SDK: /openupi.js
        </span>
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenWizard}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg transition-colors whitespace-nowrap"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          Integration Wizard
        </button>
        <button
          onClick={onOpenStore}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
          Demo Store
        </button>
        <button
          onClick={onRunSecurityTests}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm shadow-rose-600/30 transition-colors whitespace-nowrap"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Run Security Tests
        </button>
      </div>
    </header>
  );
};
