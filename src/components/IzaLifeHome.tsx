import React from 'react';

/**
 * IZA LIFE home: the Pulse card and the recent Moments feed.
 * Pulse slots: Now · Today · Next · Attention · Continue.
 * Slots with no data are hidden rather than filled with placeholders.
 */

export interface HomeMemory {
  id: number;
  type: string;
  content: string;
  time: string;
  capturedAt?: string;
}

export interface HomePulse {
  summary: string;
  priorities: string[];
}

export interface IzaLifeHomeProps {
  now: Date;
  memories: HomeMemory[];
  pulse: HomePulse | null;
  feedLimit?: number;
}

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function momentTime(m: HomeMemory): Date | null {
  if (!m.capturedAt) return null;
  const d = new Date(m.capturedAt);
  return isNaN(d.getTime()) ? null : d;
}

export function IzaLifeHome({ now, memories, pulse, feedLimit = 10 }: IzaLifeHomeProps) {
  const todayCount = memories.filter((m) => {
    const t = momentTime(m);
    return t !== null && isSameDay(t, now);
  }).length;

  const latest = memories[0];
  const feed = memories.slice(0, feedLimit);
  const attention = pulse?.priorities ?? [];

  return (
    <section className="bg-neutral-950 text-neutral-100 border-b border-neutral-800 px-4 py-5 normal-case tracking-normal font-sans">
      {/* Pulse card */}
      <div className="max-w-2xl mx-auto rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] tracking-widest text-neutral-400 uppercase">Now</div>
            <div className="text-xl text-white mt-1">{greeting(now)}</div>
          </div>
          <div className="text-sm text-neutral-400">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stat label="Today" value={`${todayCount} ${todayCount === 1 ? 'moment' : 'moments'}`} />
          <Stat label="Total" value={`${memories.length} kept`} />
        </div>

        {pulse?.summary && (
          <p className="text-sm text-neutral-300 mt-4 leading-relaxed">{pulse.summary}</p>
        )}

        {attention.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] tracking-widest text-neutral-400 uppercase mb-2">Attention</div>
            <ul className="space-y-1.5">
              {attention.map((item, i) => (
                <li key={i} className="text-sm text-neutral-200">• {item}</li>
              ))}
            </ul>
          </div>
        )}

        {latest && (
          <div className="mt-4 pt-4 border-t border-neutral-800">
            <div className="text-[11px] tracking-widest text-neutral-400 uppercase mb-1">Continue</div>
            <p className="text-sm text-neutral-200 line-clamp-2">{latest.content}</p>
          </div>
        )}
      </div>

      {/* Moments feed */}
      <div className="max-w-2xl mx-auto mt-6">
        <div className="text-[11px] tracking-widest text-neutral-400 uppercase mb-3">Moments</div>
        {feed.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing kept yet. Use ＋ to talk, see, write or add.</p>
        ) : (
          <ul className="space-y-2">
            {feed.map((m) => (
              <li key={m.id} className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
                <div className="flex items-center justify-between text-[11px] tracking-widest text-neutral-500 uppercase">
                  <span>{m.type}</span>
                  <span>{m.time}</span>
                </div>
                <p className="text-sm text-neutral-200 mt-1 line-clamp-3">{m.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2">
      <div className="text-[10px] tracking-widest text-neutral-500 uppercase">{label}</div>
      <div className="text-sm text-white mt-0.5">{value}</div>
    </div>
  );
}
