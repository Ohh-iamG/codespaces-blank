import React from 'react';
import { ShieldAlert, Check, X, AlertTriangle, HeartPulse } from 'lucide-react';

interface MedicalDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

function safeStorage(): Storage | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function MedicalDisclaimerModal({ isOpen, onClose, onAccept }: MedicalDisclaimerModalProps) {
  if (!isOpen) return null;

  const handleAcknowledge = () => {
    const storage = safeStorage();
    if (storage) {
      try {
        storage.setItem('iza_disclaimer_accepted', 'true');
      } catch {
        // Ignore storage write failures in restricted browser contexts.
      }
    }
    if (onAccept) onAccept();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 font-mono">
      <div className="bg-slate-900 border border-amber-500/50 rounded-xl w-full max-w-lg flex flex-col shadow-[0_0_40px_rgba(245,158,11,0.2)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm tracking-wide">
            <HeartPulse className="w-5 h-5" />
            <span>HEALTH & SAFETY DISCLAIMER (GUIDELINE 1.4)</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs leading-relaxed text-slate-300 font-sans">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/40 rounded-lg text-amber-200 font-medium">
            &ldquo;IZA is a personal memory companion and organization assistant. It does not provide medical diagnosis, treatment, or emergency services.&rdquo;
          </div>

          <div className="space-y-2 text-slate-400 text-[11px]">
            <p>
              • <strong>Biophysical & Medication Logging</strong>: Features for tracking dosages, heart rate, and stress index are strictly for personal memory organization and routine tracking.
            </p>
            <p>
              • <strong>No Medical Advice</strong>: Always consult qualified healthcare professionals for medical advice, diagnoses, or prescriptions. In case of an emergency, immediately call local emergency services.
            </p>
            <p>
              • <strong>Sovereign Privacy</strong>: All recorded health logs are client-encrypted and stored securely in your private cloud vault.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-3 font-mono">
          <button
            onClick={handleAcknowledge}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-lg shadow-md transition cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>I UNDERSTAND & AGREE</span>
          </button>
        </div>
      </div>
    </div>
  );
}
