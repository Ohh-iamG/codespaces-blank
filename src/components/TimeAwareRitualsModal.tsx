import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  Moon, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Flame, 
  Pill, 
  CloudSun, 
  Compass, 
  HeartPulse, 
  Lock, 
  ArrowRight, 
  X, 
  Loader2,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface TimeAwareRitualsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReanchorContext?: (prompt: string) => void;
  onCompleteRitual?: () => void;
}

export function TimeAwareRitualsModal({
  isOpen,
  onClose,
  onReanchorContext,
  onCompleteRitual
}: TimeAwareRitualsModalProps) {
  const [pulseData, setPulseData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'morning' | 'evening'>('morning');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [doseConfirmed, setDoseConfirmed] = useState(false);
  const [completedFocus, setCompletedFocus] = useState<number[]>([]);
  const [eveningNotes, setEveningNotes] = useState('');
  const [closureSuccess, setClosureSuccess] = useState<string | null>(null);

  const fetchPulse = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/rituals/pulse');
      const data = await res.json();
      setPulseData(data);
      if (data.phase === 'evening') {
        setActiveTab('evening');
      } else {
        setActiveTab('morning');
      }
      setDoseConfirmed(data.medicationStatus?.confirmed || false);
    } catch (err) {
      console.warn('Failed to load ritual pulse:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPulse();
      setClosureSuccess(null);
    }
  }, [isOpen]);

  const toggleFocusItem = (idx: number) => {
    setCompletedFocus((prev) => 
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleCompleteRitual = async (phase: 'morning' | 'evening') => {
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/rituals/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          notes: phase === 'evening' ? eveningNotes : `3 Focus Items Reviewed (${completedFocus.length}/3 locked in). Medication verified.`,
          focusCompleted: completedFocus,
        })
      });
      if (res.ok) {
        setClosureSuccess(phase === 'evening' 
          ? 'Evening Wind-Down complete: Mental loops cleared and vault sealed overnight.' 
          : 'Morning Pulse active: Operational day launched with sovereign clarity.');
        if (onCompleteRitual) onCompleteRitual();
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      console.error('Error completing ritual:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 font-mono text-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${activeTab === 'morning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'}`}>
              {activeTab === 'morning' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>TIME-AWARE RITUALS & TEMPORAL SAFETY</span>
                <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 uppercase">
                  {pulseData?.phase || 'ACTIVE'} PHASE
                </span>
              </div>
              <div className="text-[10px] text-slate-400 normal-case font-sans">
                Predictable daily boundaries: Morning priority pulse & Evening mental loop closure.
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-2 gap-2">
          <button
            onClick={() => setActiveTab('morning')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${
              activeTab === 'morning'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-400" />
            <span>1. MORNING PULSE (PRIORITY LAUNCH)</span>
          </button>

          <button
            onClick={() => setActiveTab('evening')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${
              activeTab === 'evening'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>2. EVENING WIND-DOWN (LOOP CLEAR)</span>
          </button>
        </div>

        {/* Notice alert */}
        {closureSuccess && (
          <div className="p-3 bg-emerald-950 border-b border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{closureSuccess}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-300">
          
          {/* Sanctuary Re-anchoring Prompt */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2 relative overflow-hidden">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>THE SANCTUARY ATMOSPHERE (CONTINUOUS RELATIONAL THREAD)</span>
            </div>
            <p className="text-slate-200 text-xs font-sans leading-relaxed">
              &ldquo;{pulseData?.lastAnchorPrompt || 'We left off at the Caterpillar grader hydraulic inspection—ready to pick it back up or reset?'}&rdquo;
            </p>
            {onReanchorContext && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    onReanchorContext(pulseData?.lastAnchorPrompt || 'Resume previous conversation topic');
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-[11px] uppercase transition cursor-pointer flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>PICK IT BACK UP</span>
                </button>
                <button
                  onClick={() => {
                    onReanchorContext('Starting a clean operational day.');
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] uppercase transition cursor-pointer"
                >
                  CLEAN SLATE
                </button>
              </div>
            )}
          </div>

          {activeTab === 'morning' ? (
            /* MORNING PULSE VIEW */
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* 3 Key Priority Checkpoints */}
              <div className="space-y-2">
                <div className="text-amber-400 font-bold text-xs uppercase flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>3 KEY OPERATIONAL FOCUS ITEMS</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {completedFocus.length}/3 Confirmed
                  </span>
                </div>

                <div className="space-y-2">
                  {(pulseData?.focusItems || [
                    'Inspect CAT-140M Grader Hydraulic manifold seals before shift start',
                    'Review 13-share veto governance proposal on creative canvas',
                    'Confirm Metformin 500mg dose check-in & hydration baseline'
                  ]).map((item: string, idx: number) => {
                    const isChecked = completedFocus.includes(idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleFocusItem(idx)}
                        className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition select-none ${
                          isChecked 
                            ? 'bg-amber-950/20 border-amber-500/50 text-amber-200' 
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-600'
                        }`}>
                          {isChecked && <CheckCircle2 className="w-3 h-3 text-slate-950" />}
                        </div>
                        <span className="font-sans text-xs leading-normal">{item}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Medication Protocol & Biophysical Vitals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <Pill className="w-4 h-4" />
                    <span>CARER VAULT: DOSE CHECK</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans">
                    {pulseData?.medicationStatus?.scheduledDose || 'Metformin 500mg (Morning with water)'}
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer pt-1 select-none">
                    <input
                      type="checkbox"
                      checked={doseConfirmed}
                      onChange={(e) => setDoseConfirmed(e.target.checked)}
                      className="accent-rose-500 w-3.5 h-3.5 rounded"
                    />
                    <span className="text-slate-300">Logged & confirmed taken with water</span>
                  </label>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                    <CloudSun className="w-4 h-4" />
                    <span>FIELD CONDITIONS (WA SITE 7)</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans">
                    {pulseData?.siteConditions?.weather || '23°C Clear • UV Index 4'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Road Status: {pulseData?.siteConditions?.haulRoadStatus || 'Operational & Dust-Suppressed'}
                  </div>
                </div>
              </div>

              {/* Launch Day Button */}
              <button
                onClick={() => handleCompleteRitual('morning')}
                disabled={submitting}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <Flame className="w-4 h-4 text-slate-950" />}
                <span>LOCK IN FOCUS & LAUNCH MORNING SHIFT</span>
              </button>
            </div>
          ) : (
            /* EVENING WIND-DOWN VIEW */
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Mental Loop Brain Dump */}
              <div className="space-y-2">
                <div className="text-indigo-400 font-bold text-xs uppercase flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span>CLEAR MENTAL LOOPS (BRAIN DUMP & TRIAGE)</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                  Dump lingering thoughts, loose ends, or reflections so your mind can rest. IZA will organize and anchor them safely in your Personal Sanctuary.
                </p>
                <textarea
                  rows={4}
                  value={eveningNotes}
                  onChange={(e) => setEveningNotes(e.target.value)}
                  placeholder="e.g. Need to order replacement O-rings for grader valve 4B on Monday; dinner with Sam went well..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans text-xs"
                />
              </div>

              {/* Overnight Security Reassurance */}
              <div className="p-4 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs uppercase">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <span>OVERNIGHT SOVEREIGN SEAL</span>
                </div>
                <div className="text-[11px] text-slate-400 font-sans space-y-1">
                  <p>• All memories encrypted with local keys; zero public AI scraping.</p>
                  <p>• Autonomous background threads monitor machinery alerts without waking you.</p>
                  <p>• Tomorrow&apos;s Morning Pulse will be ready at 06:00 AM.</p>
                </div>
              </div>

              {/* Lock Vault & Rest Button */}
              <button
                onClick={() => handleCompleteRitual('evening')}
                disabled={submitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>CLEAR MENTAL LOOPS & SEAL VAULT OVERNIGHT</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
