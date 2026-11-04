import React, { useState } from 'react';
import { Home, Search, Plus, Users, UserCircle, Mic, Camera, PenLine, Upload, X } from 'lucide-react';

/**
 * IZA LIFE navigation: five permanent controls.
 *   IZA (home) · RECALL (search, memory, conversation) · ＋ (centre) · PEOPLE · ME
 * The ＋ opens exactly four actions: Talk, See, Write, Add.
 * Aqua is reserved for the ＋ button.
 */

export interface IzaLifeNavProps {
  onHome: () => void;
  onRecall: () => void;
  onPeople: () => void;
  onMe: () => void;
  onTalk: () => void;
  onSee: () => void;
  onAdd: () => void;
  onWrite: (text: string) => void;
}

type NavKey = 'home' | 'recall' | 'people' | 'me';

const AQUA = '#00D1C1';

export function IzaLifeNav({ onHome, onRecall, onPeople, onMe, onTalk, onSee, onAdd, onWrite }: IzaLifeNavProps) {
  const [plusOpen, setPlusOpen] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState<NavKey>('home');

  const go = (key: NavKey, fn: () => void) => {
    setActive(key);
    fn();
  };

  const runAction = (fn: () => void) => {
    setPlusOpen(false);
    fn();
  };

  const saveWrite = () => {
    const text = draft.trim();
    if (!text) return;
    onWrite(text);
    setDraft('');
    setWriteOpen(false);
  };

  const tabClass = (key: NavKey) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] tracking-widest ${
      active === key ? 'text-white' : 'text-slate-400'
    } hover:text-white transition-colors`;

  return (
    <>
      {/* ＋ action sheet: four actions only */}
      {plusOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => setPlusOpen(false)}>
          <div
            className="w-full max-w-md bg-neutral-900 border-t border-neutral-700 rounded-t-2xl p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-3">
              <ActionButton icon={<Mic className="w-5 h-5" />} label="TALK" onClick={() => runAction(onTalk)} />
              <ActionButton icon={<Camera className="w-5 h-5" />} label="SEE" onClick={() => runAction(onSee)} />
              <ActionButton
                icon={<PenLine className="w-5 h-5" />}
                label="WRITE"
                onClick={() => {
                  setPlusOpen(false);
                  setWriteOpen(true);
                }}
              />
              <ActionButton icon={<Upload className="w-5 h-5" />} label="ADD" onClick={() => runAction(onAdd)} />
            </div>
          </div>
        </div>
      )}

      {/* WRITE: quick note into the life record */}
      {writeOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => setWriteOpen(false)}>
          <div
            className="w-full max-w-md bg-neutral-900 border-t border-neutral-700 rounded-t-2xl p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs tracking-widest text-white">WRITE</span>
              <button onClick={() => setWriteOpen(false)} className="text-neutral-400 hover:text-white" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              autoFocus
              placeholder="What happened?"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-sm normal-case tracking-normal text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-400"
            />
            <button
              onClick={saveWrite}
              disabled={!draft.trim()}
              className="mt-3 w-full py-2 rounded-lg bg-neutral-100 text-neutral-900 text-xs tracking-widest disabled:opacity-40"
            >
              SAVE TO MOMENTS
            </button>
          </div>
        </div>
      )}

      {/* Five-control bar */}
      <nav className="shrink-0 border-t border-neutral-800 bg-neutral-950 flex items-end justify-around px-2 pb-[env(safe-area-inset-bottom)] z-30">
        <button className={tabClass('home')} onClick={() => go('home', onHome)}>
          <Home className="w-5 h-5" />
          <span>IZA</span>
        </button>
        <button className={tabClass('recall')} onClick={() => go('recall', onRecall)}>
          <Search className="w-5 h-5" />
          <span>RECALL</span>
        </button>

        {/* Centre ＋: the only aqua control */}
        <div className="flex-1 flex justify-center -mt-5">
          <button
            onClick={() => setPlusOpen(true)}
            aria-label="Add"
            className="w-14 h-14 rounded-full flex items-center justify-center text-neutral-950 shadow-lg"
            style={{ backgroundColor: AQUA }}
          >
            <Plus className="w-7 h-7" />
          </button>
        </div>

        <button className={tabClass('people')} onClick={() => go('people', onPeople)}>
          <Users className="w-5 h-5" />
          <span>PEOPLE</span>
        </button>
        <button className={tabClass('me')} onClick={() => go('me', onMe)}>
          <UserCircle className="w-5 h-5" />
          <span>ME</span>
        </button>
      </nav>
    </>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 py-3 rounded-xl bg-neutral-800 text-neutral-100 hover:bg-neutral-700 text-[10px] tracking-widest"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
