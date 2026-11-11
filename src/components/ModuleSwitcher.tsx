import React from 'react';
import {
  Code2,
  QrCode,
  Layers,
  KeyRound,
  Smartphone,
  Truck,
  CreditCard,
  Palette,
  Terminal,
  Globe,
  ShieldAlert,
  Activity,
} from 'lucide-react';

export type ModuleKey =
  | 'sdk'
  | 'qr'
  | 'queue'
  | 'auth'
  | 'companion'
  | 'cod'
  | 'pos'
  | 'whitelabel'
  | 'developer'
  | 'wizard'
  | 'security'
  | 'debugging';

interface ModuleSwitcherProps {
  activeModule: ModuleKey;
  onChange: (key: ModuleKey) => void;
}

const MODULES: { id: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'wizard', label: 'Website Integration Wizard', icon: Globe },
  { id: 'security', label: 'Payment Security (14 Tests)', icon: ShieldAlert },
  { id: 'debugging', label: 'Diagnostics & Logs', icon: Activity },
  { id: 'sdk', label: '1. JS SDK (openupi.js)', icon: Code2 },
  { id: 'qr', label: '2. Dynamic QR', icon: QrCode },
  { id: 'queue', label: '3. Payment Queue', icon: Layers },
  { id: 'auth', label: '4. Auth & Phone OTP', icon: KeyRound },
  { id: 'companion', label: '5. Android Companion', icon: Smartphone },
  { id: 'cod', label: '6. COD Operations', icon: Truck },
  { id: 'pos', label: '7. Offline POS', icon: CreditCard },
  { id: 'whitelabel', label: '8. White-Label', icon: Palette },
  { id: 'developer', label: '9. Developer Hub', icon: Terminal },
];

export const ModuleSwitcher: React.FC<ModuleSwitcherProps> = ({
  activeModule,
  onChange,
}) => {
  return (
    <div className="w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-[57px] z-30">
      <div className="max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 py-2.5 min-w-max">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;
            const isHighlight = mod.id === 'wizard' || mod.id === 'security' || mod.id === 'debugging';

            return (
              <button
                key={mod.id}
                onClick={() => onChange(mod.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                    : isHighlight
                    ? 'text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive
                      ? 'text-sky-400'
                      : mod.id === 'security'
                      ? 'text-rose-400'
                      : mod.id === 'wizard'
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
