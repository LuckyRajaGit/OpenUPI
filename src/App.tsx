/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { ModuleSwitcher, ModuleKey } from './components/ModuleSwitcher.tsx';
import { UniversalSdkModule } from './components/modules/UniversalSdkModule.tsx';
import { DynamicQrModule } from './components/modules/DynamicQrModule.tsx';
import { PaymentQueueModule } from './components/modules/PaymentQueueModule.tsx';
import { AuthModule } from './components/modules/AuthModule.tsx';
import { AndroidCompanionModule } from './components/modules/AndroidCompanionModule.tsx';
import { CODModule } from './components/modules/CODModule.tsx';
import { POSModule } from './components/modules/POSModule.tsx';
import { WhiteLabelModule } from './components/modules/WhiteLabelModule.tsx';
import { DeveloperModule } from './components/modules/DeveloperModule.tsx';
import { SampleStoreModal } from './components/SampleStoreModal.tsx';

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('sdk');
  const [showStoreModal, setShowStoreModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-sky-500/30 selection:text-sky-200">
      {/* 3-Zone Top Bar Contract */}
      <Navbar
        onOpenStore={() => setShowStoreModal(true)}
        onRunTests={() => setActiveModule('developer')}
        mockMode={true}
      />

      {/* 9-Module Horizontal Segmented Switcher */}
      <ModuleSwitcher
        activeModule={activeModule}
        onChange={(mod) => setActiveModule(mod)}
      />

      {/* Main Viewport Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeModule === 'sdk' && <UniversalSdkModule />}
        {activeModule === 'qr' && <DynamicQrModule />}
        {activeModule === 'queue' && <PaymentQueueModule />}
        {activeModule === 'auth' && <AuthModule />}
        {activeModule === 'companion' && <AndroidCompanionModule />}
        {activeModule === 'cod' && <CODModule />}
        {activeModule === 'pos' && <POSModule />}
        {activeModule === 'whitelabel' && <WhiteLabelModule />}
        {activeModule === 'developer' && <DeveloperModule />}
      </main>

      {/* Demo Merchant Store Modal */}
      {showStoreModal && (
        <SampleStoreModal onClose={() => setShowStoreModal(false)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">OpenUPI Gateway</span>
            <span>·</span>
            <span>Self-Hosted Sovereign UPI Checkout Platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>NPCI UPI 2.0 Spec Compliant</span>
            <span>·</span>
            <span>Mock Engine Active</span>
            <span>·</span>
            <span>Port 3000 Full-Stack</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
