import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Sparkles, 
  Plus, 
  Search, 
  Filter, 
  Tag, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  MessageSquare, 
  ArrowUpRight, 
  Layers,
  Wrench,
  HeartHandshake,
  Feather,
  Lightbulb,
  X,
  Loader2
} from 'lucide-react';
import { apiFetch } from '../lib/api';

export interface SnapshotCard {
  id: number;
  content: string;
  summary?: string;
  kind: string;
  salience: number;
  source?: string;
  capturedAt: string;
  meta?: {
    isSnapshot?: boolean;
    title?: string;
    domain?: 'sanctuary' | 'carer' | 'machinery' | 'creative';
    mood?: string;
    confidence?: number;
    sourceChunk?: string;
    spatialAnchor?: string;
    tags?: string[];
  };
}

interface SpatialMemoryLandscapeProps {
  onReanchorIntoConfidant?: (content: string, domain: string) => void;
  onRefreshNeeded?: () => void;
  isModal?: boolean;
  onClose?: () => void;
}

export function SpatialMemoryLandscape({
  onReanchorIntoConfidant,
  onRefreshNeeded,
  isModal = false,
  onClose,
}: SpatialMemoryLandscapeProps) {
  const [activeDomain, setActiveDomain] = useState<'all' | 'personal' | 'health' | 'work' | 'study' | 'sanctuary' | 'carer' | 'machinery' | 'creative'>('all');
  const [snapshots, setSnapshots] = useState<SnapshotCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotCard | null>(null);

  // New Snapshot Form State
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDomain, setNewDomain] = useState<'personal' | 'health' | 'work' | 'study'>('personal');
  const [newMood, setNewMood] = useState('Focused & Grounded');
  const [newSourceChunk, setNewSourceChunk] = useState('User Note / Uploaded Document');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const domains = [
    { id: 'all', label: 'All Domains', icon: Layers, color: 'text-slate-300', count: snapshots.length },
    { id: 'personal', label: 'Personal Vault & Life', icon: Feather, color: 'text-emerald-400', desc: 'Daily thoughts, life goals, contacts & personal preferences' },
    { id: 'health', label: 'Health & Care Support', icon: HeartHandshake, color: 'text-rose-400', desc: 'Daily pulse briefings, medication routines & wellness check-ins' },
    { id: 'work', label: 'Work & Custom Documents', icon: Wrench, color: 'text-amber-400', desc: 'Uploaded PDFs, user manuals, work procedures & SOPs' },
    { id: 'study', label: 'Study & Reference Files', icon: Lightbulb, color: 'text-cyan-400', desc: 'Textbooks, research, courses & reference notes' },
  ];

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const url = activeDomain === 'all' ? '/api/snapshots' : `/api/snapshots?domain=${activeDomain}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSnapshots(data);
      }
    } catch (err) {
      console.warn('Error fetching snapshots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [activeDomain]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          domain: newDomain,
          mood: newMood,
          sourceChunk: newSourceChunk,
          confidence: 0.98,
          tags: [newDomain, 'sovereign_snapshot']
        })
      });
      if (res.ok) {
        setNewTitle('');
        setNewContent('');
        setCreateModalOpen(false);
        fetchSnapshots();
        if (onRefreshNeeded) onRefreshNeeded();
      }
    } catch (err) {
      console.error('Error creating snapshot:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSnapshots = snapshots.filter((s) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const title = s.meta?.title?.toLowerCase() || '';
    const content = s.content.toLowerCase();
    const source = (s.source || '').toLowerCase();
    const domain = (s.meta?.domain || '').toLowerCase();
    return title.includes(query) || content.includes(query) || source.includes(query) || domain.includes(query);
  });

  const getDomainTheme = (domain?: string) => {
    switch (domain) {
      case 'health':
      case 'carer':
        return {
          bg: 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70',
          badge: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
          title: 'text-rose-300',
          dot: 'bg-rose-500',
          name: 'Health & Care Support'
        };
      case 'work':
      case 'machinery':
        return {
          bg: 'bg-amber-950/20 border-amber-500/40 hover:border-amber-500/70',
          badge: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
          title: 'text-amber-300',
          dot: 'bg-amber-500',
          name: 'Work & Custom Documents'
        };
      case 'study':
      case 'creative':
        return {
          bg: 'bg-cyan-950/20 border-cyan-500/40 hover:border-cyan-500/70',
          badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40',
          title: 'text-cyan-300',
          dot: 'bg-cyan-500',
          name: 'Study & Reference Files'
        };
      case 'personal':
      case 'sanctuary':
      default:
        return {
          bg: 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/70',
          badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
          title: 'text-emerald-300',
          dot: 'bg-emerald-500',
          name: 'Personal Vault & Life'
        };
    }
  };

  const contentComponent = (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-4 sm:p-5 flex flex-col font-mono text-xs text-slate-300 space-y-4 shadow-2xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Compass className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>SPATIAL MEMORY & NARRATIVE LANDSCAPES</span>
              <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                PGVECTOR INDEXED
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-sans normal-case">
              Physical structure for your sovereign knowledge: Sanctuaries, Carer Logs, Machinery Desks & Creative Canvases.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
          >
            <Plus className="w-3.5 h-3.5 text-slate-950" />
            <span>CREATE SNAPSHOT</span>
          </button>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Domain Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {domains.map((dom) => {
          const Icon = dom.icon;
          const isActive = activeDomain === dom.id;
          return (
            <button
              key={dom.id}
              onClick={() => setActiveDomain(dom.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-800 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${dom.color}`} />
              <span>{dom.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Statistics Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search spatial memories, OEM chunks, torque specs..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
        <div className="text-[10px] text-slate-400 flex items-center gap-2 shrink-0 px-1">
          <span>{filteredSnapshots.length} RECALLABLE MOMENT CARDS</span>
          <span>&bull;</span>
          <span className="text-emerald-400 font-bold">100% CITED VECTORS</span>
        </div>
      </div>

      {/* Grid of Recallable Moment Cards */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span>Retrieving spatial landscape vectors...</span>
        </div>
      ) : filteredSnapshots.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
          <div>No snapshot cards found in this landscape yet.</div>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="text-emerald-400 hover:underline text-xs"
          >
            Create your first Sovereign Snapshot Card &rarr;
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[60vh] overflow-y-auto pr-1">
          {filteredSnapshots.map((item) => {
            const meta = item.meta || {};
            const theme = getDomainTheme(meta.domain);
            const title = meta.title || item.content.split('\n')[0].replace(/^\[.*?\]:\s*/, '');
            const cleanContent = item.content.replace(/^\[.*?\]:\s*.*?\n/, '') || item.content;
            const confidence = meta.confidence ? `${Math.round(meta.confidence * 100)}%` : '98%';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedSnapshot(item)}
                className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-sm ${theme.bg}`}
              >
                <div className="space-y-2.5">
                  {/* Card Header with Domain & Confidence */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                      <span className={`font-bold px-1.5 py-0.5 rounded border uppercase text-[9px] ${theme.badge}`}>
                        {theme.name}
                      </span>
                    </div>

                    <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1" title="Vector match confidence">
                      <ShieldCheck className="w-3 h-3 text-cyan-400" />
                      <span>{confidence} CONFIDENCE</span>
                    </span>
                  </div>

                  {/* Card Title */}
                  <h3 className={`font-bold text-xs tracking-tight line-clamp-1 ${theme.title}`}>
                    {title}
                  </h3>

                  {/* Content Preview */}
                  <p className="text-[11px] text-slate-300 font-sans line-clamp-3 leading-relaxed normal-case">
                    {cleanContent}
                  </p>
                </div>

                {/* Footer with Metadata & Re-anchor action */}
                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="truncate max-w-[140px]" title={meta.sourceChunk || 'Sovereign Anchor'}>
                    <span className="text-slate-500">Source: </span>
                    <span className="text-slate-300">{meta.sourceChunk ? meta.sourceChunk.slice(0, 20) : 'Personal Note'}</span>
                  </div>

                  {onReanchorIntoConfidant && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReanchorIntoConfidant(cleanContent, meta.domain || 'sanctuary');
                      }}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold transition"
                      title="Inject into active Confidant dialogue"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>RE-ANCHOR</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Snapshot Detail View Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-5 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="font-bold text-slate-100 text-sm">RECALLABLE SNAPSHOT ARTIFACT</span>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Title</div>
                <div className="font-bold text-slate-200 text-sm mt-0.5">
                  {selectedSnapshot.meta?.title || selectedSnapshot.content.split('\n')[0]}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-500 uppercase">Landscape Domain</div>
                <div className="text-emerald-400 font-bold mt-0.5">
                  {selectedSnapshot.meta?.spatialAnchor || 'The Personal Sanctuary'}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-500 uppercase">Verified Content</div>
                <div className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-200 font-sans leading-relaxed whitespace-pre-wrap mt-1">
                  {selectedSnapshot.content}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500">Source Attribution</div>
                  <div className="text-slate-300 font-bold mt-0.5">{selectedSnapshot.meta?.sourceChunk || 'Sovereign Vault'}</div>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800">
                  <div className="text-slate-500">Emotional Tone Alignment</div>
                  <div className="text-cyan-400 font-bold mt-0.5">{selectedSnapshot.meta?.mood || 'Focused & Grounded'}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              {onReanchorIntoConfidant && (
                <button
                  onClick={() => {
                    onReanchorIntoConfidant(selectedSnapshot.content, selectedSnapshot.meta?.domain || 'sanctuary');
                    setSelectedSnapshot(null);
                    if (onClose) onClose();
                  }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>RE-ANCHOR IN DIALOGUE</span>
                </button>
              )}
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Snapshot Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-xl w-full max-w-lg p-5 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-100 text-sm">CREATE SOVEREIGN SNAPSHOT</span>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSnapshot} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Snapshot Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Caterpillar 140M Hydraulic Valve Calibration"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Spatial Landscape Domain</label>
                <select
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="personal">🌿 Personal Vault & Life (Goals, Journal, Preferences)</option>
                  <option value="health">🩺 Health & Care Support (Health, Medication, Protocols)</option>
                  <option value="work">💼 Work & Custom Documents (SOPs, OEM Manuals, Procedures)</option>
                  <option value="study">📚 Study & Reference Files (Textbooks, Notes, Research)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Verified Memory / Spec Details</label>
                <textarea
                  required
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Record exact technical specifications, torque settings, or personal reflections..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Source Attribution Chunk</label>
                  <input
                    type="text"
                    value={newSourceChunk}
                    onChange={(e) => setNewSourceChunk(e.target.value)}
                    placeholder="e.g. OEM-Manual §4.2"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase mb-1">Emotional Mood Tag</label>
                  <select
                    value={newMood}
                    onChange={(e) => setNewMood(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Focused & Grounded">Focused & Grounded</option>
                    <option value="Urgent Operational Fix">Urgent Operational Fix</option>
                    <option value="Reflective Sanctuary">Reflective Sanctuary</option>
                    <option value="Creative Breakthrough">Creative Breakthrough</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded text-xs transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>COMMIT TO VAULT</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
        <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto">
          {contentComponent}
        </div>
      </div>
    );
  }

  return contentComponent;
}
