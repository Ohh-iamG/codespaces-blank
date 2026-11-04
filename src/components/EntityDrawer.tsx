import React, { useState, useEffect } from 'react';
import { X, Network, Calendar, Tag, ArrowRight, User, MapPin, Wrench, FolderGit2, FileText, Sparkles, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface EntityRecord {
  id: number | string;
  name: string;
  entityType?: string;
  etype?: string;
  link_count?: number;
  aka?: string[];
  notes?: string;
  createdAt?: string;
}

interface LinkedMemory {
  id: number | string;
  content: string;
  summary?: string;
  kind: string;
  salience?: number;
  meta?: any;
  relationship?: string;
  relation?: string;
  capturedAt?: string;
  captured_at?: string;
}

interface EntityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEntity?: (entity: EntityRecord) => void;
  initialEntityId?: number | string | null;
}

export function EntityDrawer({ isOpen, onClose, initialEntityId }: EntityDrawerProps) {
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<EntityRecord | null>(null);
  const [timeline, setTimeline] = useState<LinkedMemory[]>([]);
  const [isLoadingEntities, setIsLoadingEntities] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedEntity(null);
      setTimeline([]);
      return;
    }

    setIsLoadingEntities(true);
    apiFetch('/api/entities')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEntities(data);
          if (initialEntityId) {
            const found = data.find((e) => String(e.id) === String(initialEntityId));
            if (found) loadTimeline(found);
          }
        }
      })
      .catch((err) => console.error('Failed to load entities:', err))
      .finally(() => setIsLoadingEntities(false));
  }, [isOpen, initialEntityId]);

  const loadTimeline = async (entity: EntityRecord) => {
    setSelectedEntity(entity);
    setIsLoadingTimeline(true);
    try {
      const res = await apiFetch(`/api/entities/${entity.id}/timeline`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTimeline(data);
      } else if (data && Array.isArray(data.timeline)) {
        setTimeline(data.timeline);
      } else {
        setTimeline([]);
      }
    } catch (err) {
      console.error('Failed to load timeline:', err);
      setTimeline([]);
    } finally {
      setIsLoadingTimeline(false);
    }
  };

  if (!isOpen) return null;

  const getEntityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'person':
        return <User className="w-3.5 h-3.5 text-blue-400" />;
      case 'place':
        return <MapPin className="w-3.5 h-3.5 text-emerald-400" />;
      case 'tool':
        return <Wrench className="w-3.5 h-3.5 text-amber-400" />;
      case 'project':
        return <FolderGit2 className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Tag className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const filteredEntities = entities.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.entityType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-blue-500/50 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-400 border border-purple-500/40 rounded-lg">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-slate-100 text-sm tracking-wide">
                  KNOWLEDGE GRAPH & ENTITIES
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono">
                  {entities.length} ANCHORED
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Click any person, place, or concept to inspect its complete episodic timeline.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two-Pane or Drawer View */}
        <div className="flex-1 flex overflow-hidden">
          {/* Entity List Pane */}
          <div className="w-1/3 border-r border-slate-800 bg-slate-950/50 flex flex-col">
            <div className="p-2.5 border-b border-slate-800">
              <input
                type="text"
                placeholder="Filter entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoadingEntities ? (
                <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Loading graph...</span>
                </div>
              ) : filteredEntities.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs font-mono">
                  No entities found. Speak or capture memories with names to auto-populate.
                </div>
              ) : (
                filteredEntities.map((ent) => (
                  <button
                    key={ent.id}
                    onClick={() => loadTimeline(ent)}
                    className={`w-full text-left p-2 rounded flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      selectedEntity?.id === ent.id
                        ? 'bg-purple-950/60 border border-purple-500/40 text-purple-200'
                        : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getEntityIcon(ent.etype || ent.entityType || 'person')}
                      <span className="font-bold truncate">{ent.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {ent.link_count !== undefined && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          {ent.link_count}
                        </span>
                      )}
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Timeline Drawer Pane */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-900/60">
            {selectedEntity ? (
              <div className="space-y-4">
                {/* Entity Header Card */}
                <div className="p-3.5 bg-slate-950/80 border border-purple-500/40 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getEntityIcon(selectedEntity.etype || selectedEntity.entityType || 'person')}
                      <h4 className="font-bold text-slate-100 text-sm">{selectedEntity.name}</h4>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {selectedEntity.etype || selectedEntity.entityType || 'entity'}
                    </span>
                  </div>
                  {selectedEntity.notes && (
                    <p className="text-xs text-slate-400 mt-2 font-sans">{selectedEntity.notes}</p>
                  )}
                  <div className="text-[10px] text-slate-600 font-mono mt-2 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>Registered: {selectedEntity.createdAt ? new Date(selectedEntity.createdAt).toLocaleDateString() : 'Active'}</span>
                  </div>
                </div>

                {/* Timeline Feed */}
                <div>
                  <div className="text-[11px] font-mono font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>CHRONOLOGICAL EPISODIC TIMELINE ({timeline.length})</span>
                  </div>

                  {isLoadingTimeline ? (
                    <div className="py-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      <span>Loading linked timeline...</span>
                    </div>
                  ) : timeline.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs font-mono bg-slate-950/40 rounded-lg border border-slate-800">
                      No episodic memories linked to this entity yet. Mention &quot;{selectedEntity.name}&quot; in voice or chat to automatically link!
                    </div>
                  ) : (
                    <div className="space-y-2.5 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                      {timeline.map((item) => {
                        const dateStr = item.captured_at || item.capturedAt || new Date().toISOString();
                        const rel = item.relation || item.relationship || 'mentions';
                        return (
                          <div key={item.id} className="relative pl-7 text-xs">
                            {/* Dot */}
                            <div className="absolute left-2 top-2.5 w-2 h-2 rounded-full bg-purple-500 border-2 border-slate-900" />

                            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                                <div className="flex items-center gap-2">
                                  <span className="uppercase text-purple-400 font-bold">[{item.kind}]</span>
                                  <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px]">
                                    {rel}
                                  </span>
                                </div>
                                <span>{new Date(dateStr).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                              </div>
                              {item.summary && item.summary !== item.content && (
                                <p className="text-[11px] text-purple-300/90 font-mono italic">
                                  {item.summary}
                                </p>
                              )}
                              <p className="text-slate-200 leading-relaxed font-sans">{item.content}</p>

                              {item.meta?.sentiment && (
                                <div className="pt-1 flex items-center gap-2 text-[10px] font-mono text-cyan-400">
                                  <span>TELEMETRY: {item.meta.sentiment.tone?.toUpperCase()}</span>
                                  <span>&bull;</span>
                                  <span>STRESS {item.meta.sentiment.stress_index}/10</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <Network className="w-10 h-10 mb-3 text-slate-700" />
                <span className="text-xs font-mono text-slate-400 font-bold">NO ENTITY SELECTED</span>
                <span className="text-[11px] text-slate-600 mt-1 max-w-xs font-sans">
                  Select a person, place, or system on the left to view every linked conversation, note, and field log.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
