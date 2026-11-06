import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Trash2, 
  CreditCard, 
  RotateCcw, 
  CheckCircle2, 
  Lock, 
  X, 
  Sparkles, 
  UserCheck, 
  FileText, 
  Smartphone,
  ExternalLink,
  Loader2,
  AlertOctagon,
  Apple
} from 'lucide-react';
import { purchases, SubscriptionState } from '../lib/purchases';
import { signInWithGoogle, signInWithApple, signInAsDemoReviewer, logOut } from '../lib/firebase';
import { apiFetch } from '../lib/api';

interface SettingsPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUserChange: (user: any) => void;
  onDataPurged: () => void;
  onOpenDisclaimer: () => void;
}

export function SettingsPrivacyModal({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  onDataPurged,
  onOpenDisclaimer
}: SettingsPrivacyModalProps) {
  const [subState, setSubState] = useState<SubscriptionState | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      purchases.initialize().then(() => {
        purchases.getSubscriptionStatus(currentUser?.email).then(setSubState);
      });
      setConfirmPurge(false);
      setStatusNotice(null);
    }
  }, [isOpen, currentUser]);

  const handlePurchase = async (pkgId: string) => {
    setIsPurchasing(true);
    setStatusNotice(null);
    try {
      const ok = await purchases.purchasePro(pkgId);
      if (ok) {
        setStatusNotice('Sovereign Pro subscription activated successfully!');
        const updated = await purchases.getSubscriptionStatus(currentUser?.email);
        setSubState(updated);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setStatusNotice(null);
    try {
      const ok = await purchases.restore();
      if (ok) {
        setStatusNotice('Purchases successfully restored.');
        const updated = await purchases.getSubscriptionStatus(currentUser?.email);
        setSubState(updated);
      } else {
        setStatusNotice('No previous subscriptions found for this account.');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDemoReviewerLogin = async () => {
    const demoUser = signInAsDemoReviewer();
    onUserChange(demoUser);
    setStatusNotice('Logged in as Store Reviewer (test-reviewer@earthi.ltd). All Pro features unlocked.');
    const updated = await purchases.getSubscriptionStatus(demoUser.email);
    setSubState(updated);
  };

  const handlePurgeAccount = async () => {
    setIsPurging(true);
    setStatusNotice(null);
    try {
      const res = await apiFetch('/api/user/purge', { method: 'DELETE' });
      if (!res.ok) throw new Error('Account purge failed');
      
      // Clear client storage
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        try {
          window.localStorage.clear();
        } catch (_) {}
      }
      try {
        if (typeof window !== 'undefined' && 'indexedDB' in window) {
          const dbs = await window.indexedDB.databases?.();
          if (dbs) {
            dbs.forEach((db) => {
              if (db.name && typeof window !== 'undefined' && 'indexedDB' in window) {
                window.indexedDB.deleteDatabase(db.name);
              }
            });
          }
        }
      } catch (_) {}

      await logOut().catch(() => {});
      onUserChange(null);
      setStatusNotice('Account and cryptographic vaults completely purged.');
      onDataPurged();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatusNotice(`Purge error: ${err.message}`);
    } finally {
      setIsPurging(false);
      setConfirmPurge(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 font-mono">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5 text-slate-100 font-bold text-sm tracking-wide">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>SETTINGS & STORE COMPLIANCE</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice Bar */}
        {statusNotice && (
          <div className="px-4 py-2 bg-cyan-950/70 border-b border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Body content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          
          {/* Section 1: In-App Subscriptions (RevenueCat) */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                <CreditCard className="w-4 h-4" />
                <span>IN-APP STORE BILLING (REVENUECAT)</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                subState?.isPro 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {subState?.isPro ? 'PRO SOVEREIGN ACTIVE' : 'FREE TIER'}
              </span>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Apple & Google Store requirement: Live duplex voice link (24kHz), real-time camera inspection, and cloud vector embeddings.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="font-bold text-slate-200">SOVEREIGN MONTHLY</div>
                  <div className="text-cyan-400 text-sm font-bold mt-1">$9.99 / month</div>
                  <div className="text-[10px] text-slate-500 mt-1 font-sans">Full Gemini 3.8 Live duplex speech & camera vision.</div>
                </div>
                <button
                  onClick={() => handlePurchase('$rc_monthly')}
                  disabled={isPurchasing || subState?.isPro}
                  className="mt-3 w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-[11px] uppercase rounded transition cursor-pointer"
                >
                  {subState?.isPro ? 'CURRENT PLAN' : isPurchasing ? 'PROCESSING...' : 'SUBSCRIBE'}
                </button>
              </div>

              <div className="p-3 bg-slate-900 border border-cyan-500/40 rounded-lg flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-cyan-500 text-slate-950 text-[9px] font-bold px-2 py-0.5 rounded-bl">
                  SAVE 25%
                </div>
                <div>
                  <div className="font-bold text-slate-200">SOVEREIGN ANNUAL</div>
                  <div className="text-cyan-400 text-sm font-bold mt-1">$89.99 / year</div>
                  <div className="text-[10px] text-slate-500 mt-1 font-sans">Priority compute tokens + unlimited video turns.</div>
                </div>
                <button
                  onClick={() => handlePurchase('$rc_annual')}
                  disabled={isPurchasing || subState?.isPro}
                  className="mt-3 w-full py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-[11px] uppercase rounded transition cursor-pointer"
                >
                  {subState?.isPro ? 'CURRENT PLAN' : isPurchasing ? 'PROCESSING...' : 'SUBSCRIBE ANNUAL'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className="text-slate-400 hover:text-slate-200 underline flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                <span>RESTORE STORE PURCHASES</span>
              </button>
              <span className="text-[10px] text-slate-500">Auto-renewable subscriptions</span>
            </div>
          </div>

          {/* Section 2: Store Reviewer Credentials (Demo Access) */}
          <div className="space-y-2 bg-blue-950/30 p-4 rounded-xl border border-blue-500/30">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase">
              <UserCheck className="w-4 h-4" />
              <span>APP STORE REVIEWER ACCESS (EARTHI)</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Apple & Google review requirement: Pre-configured reviewer account with sample machinery photos, dosage records, and full access.
            </p>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-blue-300 font-mono">test-reviewer@earthi.ltd</span>
              <button
                onClick={handleDemoReviewerLogin}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold text-[11px] uppercase transition cursor-pointer"
              >
                LOG IN AS REVIEWER
              </button>
            </div>
          </div>

          {/* Section 3: Authentication (Mandatory Sign in with Apple) */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="text-slate-200 font-bold text-xs uppercase flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span>AUTHENTICATION (GUIDELINE 4.8)</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Sign in with Apple is required on iOS devices when third-party sign-in is offered.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={async () => {
                  const user = await signInWithApple();
                  if (user) onUserChange(user);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-slate-100 text-black font-semibold text-xs rounded-lg shadow transition cursor-pointer font-sans"
              >
                <Apple className="w-4 h-4 fill-current" />
                <span>Sign in with Apple</span>
              </button>

              <button
                onClick={async () => {
                  const user = await signInWithGoogle();
                  if (user) onUserChange(user);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg border border-slate-700 transition cursor-pointer font-sans"
              >
                <span>Sign in with Google</span>
              </button>
            </div>
          </div>

          {/* Section 4: Health Disclaimer & Store Links */}
          <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-lg border border-slate-800">
            <div>
              <div className="font-bold text-slate-200 text-xs">MEDICAL DISCLAIMER</div>
              <div className="text-[11px] text-slate-500 font-sans">Guideline 1.4: Non-diagnostic organization assistant.</div>
            </div>
            <button
              onClick={onOpenDisclaimer}
              className="px-2.5 py-1 text-amber-400 hover:text-amber-300 border border-amber-500/40 rounded text-[11px] cursor-pointer"
            >
              VIEW TEXT
            </button>
          </div>

          {/* Section 5: Account Deletion (Store Requirement) */}
          <div className="p-4 bg-red-950/30 rounded-xl border border-red-500/40 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase">
              <AlertOctagon className="w-4 h-4" />
              <span>DELETE ACCOUNT & PURGE VAULT (GUIDELINE 5.1.1)</span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Mandatory store rule: Permanently delete your account, biometric telemetry, voice turns, photos, and encryption keys from Cloud SQL.
            </p>

            {!confirmPurge ? (
              <button
                onClick={() => setConfirmPurge(true)}
                className="w-full py-2 bg-red-950 hover:bg-red-900 border border-red-600 text-red-200 font-bold rounded-lg text-xs tracking-wider transition cursor-pointer"
              >
                PURGE SOVEREIGN ACCOUNT & ALL MEMORIES
              </button>
            ) : (
              <div className="p-3 bg-red-950/80 border border-red-500 rounded-lg space-y-2">
                <div className="text-red-300 font-bold text-[11px] flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
                  <span>ARE YOU SURE? THIS CANNOT BE UNDONE.</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handlePurgeAccount}
                    disabled={isPurging}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    {isPurging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>YES, PURGE EVERYTHING</span>
                  </button>
                  <button
                    onClick={() => setConfirmPurge(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs transition cursor-pointer"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
