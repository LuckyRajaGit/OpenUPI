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
  | 'developer';

interface ModuleSwitcherProps {
  activeModule: ModuleKey;
  onChange: (key: ModuleKey) => void;
}

const MODULES: { id: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'sdk', label: '1. JS SDK (openupi.js)', icon: Code2 },
  { id: 'qr', label: '2. Dynamic QR', icon: QrCode },
  { id: 'queue', label: '3. Payment Queue', icon: Layers },
  { id: 'auth', label: '4. Auth & Phone OTP', icon: KeyRound },
  { id: 'companion', label: '5. Android Companion', icon: Smartphone },
  { id: 'cod', label: '6. COD Operations', icon: Truck },
  { id: 'pos', label: '7. Offline POS', icon: CreditCard },
  { id: 'whitelabel', label: '8. White-Label', icon: Palette },
  { id: 'developer', label: '9. Developer & Tests', icon: Terminal },
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
            return (
              <button
                key={mod.id}
                onClick={() => onChange(mod.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
