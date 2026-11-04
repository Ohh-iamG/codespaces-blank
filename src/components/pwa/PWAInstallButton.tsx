import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X, Check, ArrowRight } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';

export function PWAInstallButton() {
  const { canInstall, isInstalled, isIOS, hasPrompt, triggerInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  // If already running in standalone PWA mode, suppress install button completely
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
        <Smartphone className="w-3.5 h-3.5" />
        <span className="font-mono">NATIVE SHELL ACTIVE</span>
      </div>
    );
  }

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else if (hasPrompt) {
      const ok = await triggerInstall();
      if (ok) {
        setInstalledSuccess(true);
      }
    } else {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 hover:border-cyan-400 transition-all shadow-sm rounded-lg active:scale-95 cursor-pointer"
        title="Install IZA Sovereign Shell on Phone / Desktop"
      >
        <Download className="w-3.5 h-3.5 text-cyan-400" />
        <span>INSTALL NATIVE SHELL</span>
      </button>

      {/* iOS Safari & General Add to Home Screen Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl text-slate-100 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">
                    Install IZA Native Shell
                  </h3>
                  <p className="text-[11px] text-slate-400">Add to your device home screen</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <p className="text-slate-300 leading-relaxed">
                IZA behaves like a native phone application without needing an App Store download. Enjoy full-screen biometric views, offline caching, and lock-screen push alerts.
              </p>

              <div className="space-y-2.5 bg-slate-950/70 p-3.5 rounded-lg border border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-5 h-5 bg-cyan-500/20 text-cyan-400 font-bold rounded text-[11px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="text-slate-200 font-medium">In your browser menu</span>
                    <p className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                      Tap the <Share2 className="w-3.5 h-3.5 text-cyan-400 inline" /> Share button (iOS Safari) or the <span className="text-cyan-400">⋮</span> Menu (Chrome/Android).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-5 h-5 bg-cyan-500/20 text-cyan-400 font-bold rounded text-[11px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="text-slate-200 font-medium">Select "Add to Home Screen"</span>
                    <p className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                      Scroll down in the action sheet and tap <PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" /> <strong className="text-emerald-400">Add to Home Screen</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-5 h-5 bg-cyan-500/20 text-cyan-400 font-bold rounded text-[11px] shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="text-slate-200 font-medium">Confirm & Launch</span>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Tap <strong className="text-cyan-400">Add</strong> in the top right. Launch IZA directly from your home screen as a standalone sovereign shell.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500">Standalone App • Zero Telemetry</span>
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg transition"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
