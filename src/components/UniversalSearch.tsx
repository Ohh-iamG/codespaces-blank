import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Layers, 
  FileText, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink, 
  ShieldCheck, 
  User, 
  HeartPulse, 
  Briefcase, 
  GraduationCap, 
  MessageSquare, 
  X, 
  Loader2,
  Copy,
  Check
} from 'lucide-react';
import { apiFetch } from '../lib/api';

export interface UniversalSearchResult {
  id: number;
  title: string;
  content: string;
  summary: string;
  domain: 'personal' | 'health' | 'work' | 'study';
  domainLabel: string;
  sourceChunk: string;
  confidence: number;
  capturedAt: string;
}

interface UniversalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onReanchorIntoConfidant?: (content: string, domain: string) => void;
  onRefreshNeeded?: () => void;
}

export function UniversalSearch({
  isOpen,
  onClose,
  onReanchorIntoConfidant,
  onRefreshNeeded
}: UniversalSearchProps) {
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<string>('all');
  const [results, setResults] = useState<UniversalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Document Upload Form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDomain, setUploadDomain] = useState<'personal' | 'health' | 'work' | 'study'>('work');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccessNotice, setUploadSuccessNotice] = useState<string | null>(null);

  const executeSearch = async (targetQuery = query, targetDomain = domain) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/search/universal?q=${encodeURIComponent(targetQuery)}&domain=${targetDomain}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(data);
      }
    } catch (err) {
      console.warn('Universal search error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      executeSearch(query, domain);
    }
  }, [isOpen, domain]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query, domain);
  };

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadContent.trim()) return;

    setIsUploading(true);
    setUploadSuccessNotice(null);
    try {
      const res = await apiFetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadTitle.trim(),
          domain: uploadDomain,
          content: uploadContent.trim(),
          fileName: uploadFileName.trim() || `${uploadTitle.trim()}.pdf`,
        })
      });
      const data = await res.json();
      if (data.success) {
        setUploadSuccessNotice(`Document "${uploadTitle}" ingested into ${uploadDomain.toUpperCase()} domain.`);
        setUploadTitle('');
        setUploadContent('');
        setUploadFileName('');
        setTimeout(() => {
          setUploadModalOpen(false);
          setUploadSuccessNotice(null);
          executeSearch('', domain);
          if (onRefreshNeeded) onRefreshNeeded();
        }, 1200);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyCitation = async (item: UniversalSearchResult) => {
    if (!navigator.clipboard?.writeText) {
      console.warn('Clipboard access unavailable in this browser context.');
      return;
    }

    try {
      await navigator.clipboard.writeText(`[Citation: ${item.sourceChunk}]:\n${item.content}`);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Failed to copy citation:', err);
    }
  };

  const getDomainBadge = (d: string) => {
    switch (d) {
      case 'personal':
        return {
          icon: User,
          color: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/40',
          label: 'Personal Vault & Life'
        };
      case 'health':
        return {
          icon: HeartPulse,
          color: 'text-rose-400 bg-rose-950/80 border-rose-500/40',
          label: 'Health & Care Support'
        };
      case 'study':
        return {
          icon: GraduationCap,
          color: 'text-indigo-400 bg-indigo-950/80 border-indigo-500/40',
          label: 'Study & Reference Files'
        };
      case 'work':
      default:
        return {
          icon: Briefcase,
          color: 'text-amber-400 bg-amber-950/80 border-amber-500/40',
          label: 'Work & Custom Documents'
        };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 font-mono text-xs">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>UNIVERSAL DOMAIN SEARCH & DOCUMENT RAG</span>
                <span className="text-[9px] bg-slate-800 px-2 py-0.5 rounded text-cyan-400 border border-slate-700">
                  CITED TEXT CHUNKS
                </span>
              </div>
              <div className="text-[10px] text-slate-400 normal-case font-sans">
                Unified cross-session search across Personal, Health, Work, and Study knowledge stores.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUploadModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>INGEST DOCUMENT / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Universal Search Controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row gap-2.5">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across personal notes, medical checks, manuals, textbooks..."
              className="w-full bg-slate-900 border border-slate-700 text-xs pl-9 pr-3 py-2 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </form>

          {/* Domain Dropdown specified in user requirements */}
          <select
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value);
            }}
            className="bg-slate-900 border border-slate-700 text-xs px-3 py-2 rounded-lg text-slate-300 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Domains</option>
            <option value="personal">Personal Vault & Life</option>
            <option value="health">Health & Care Support</option>
            <option value="work">Work & Custom Documents</option>
            <option value="study">Study & Reference Files</option>
          </select>

          <button
            onClick={() => executeSearch(query, domain)}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs uppercase transition cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'FILTER'}
          </button>
        </div>

        {/* Results List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 max-h-[65vh]">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Scanning universal vector chunks...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl space-y-2">
              <div>No records found matching &ldquo;{query}&rdquo; in {domain.toUpperCase()} domain.</div>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="text-cyan-400 hover:underline text-xs"
              >
                Upload your first textbook, manual or procedure PDF &rarr;
              </button>
            </div>
          ) : (
            results.map((item) => {
              const badge = getDomainBadge(item.domain);
              const BadgeIcon = badge.icon;
              const confidencePercent = `${Math.round(item.confidence * 100)}%`;

              return (
                <div
                  key={item.id}
                  className="p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2.5 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${badge.color}`}>
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badge.label}</span>
                      </span>
                      <h4 className="font-bold text-slate-100 text-xs tracking-tight truncate max-w-md">
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 text-cyan-400 font-mono">
                        <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        <span>{confidencePercent} MATCH</span>
                      </span>
                      <span className="text-slate-600">&bull;</span>
                      <span className="text-slate-400 font-mono truncate max-w-[150px]" title={item.sourceChunk}>
                        {item.sourceChunk}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
                    {item.content}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                    <div>
                      <span>Indexed at: </span>
                      <span className="text-slate-400">{new Date(item.capturedAt).toLocaleString()}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyCitation(item)}
                        className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded transition cursor-pointer flex items-center gap-1"
                        title="Copy chunk citation"
                      >
                        {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>CITE</span>
                      </button>

                      {onReanchorIntoConfidant && (
                        <button
                          onClick={() => {
                            onReanchorIntoConfidant(item.content, item.domain);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 rounded font-bold transition cursor-pointer flex items-center gap-1"
                          title="Inject into active conversation"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>RE-ANCHOR IN DIALOGUE</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Ingest Document Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-100 text-sm">INGEST CUSTOM DOCUMENT / RAG CHUNK</span>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadSuccessNotice && (
              <div className="p-3 bg-emerald-950 border border-emerald-500/40 text-emerald-300 rounded text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{uploadSuccessNotice}</span>
              </div>
            )}

            <form onSubmit={handleDocumentUpload} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Molecular Biology Textbook Chapter 4 / Appliance User Manual"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Universal Category Domain</label>
                <select
                  value={uploadDomain}
                  onChange={(e) => setUploadDomain(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="work">Work & Custom Documents (SOPs, OEM Manuals, Procedures)</option>
                  <option value="study">Study & Reference Files (Textbooks, Notes, Research)</option>
                  <option value="health">Health & Care Support (Health Records, Care Plans, Protocols)</option>
                  <option value="personal">Personal Vault & Life (Journals, Leases, Goals, Contacts)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Original File Name (Optional)</label>
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="e.g. Bio-Textbook-2026.pdf"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Text / OCR Content to Ingest</label>
                <textarea
                  required
                  rows={6}
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="Paste text excerpt, manual specifications, textbook notes, or procedures..."
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded text-xs transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold rounded text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>INDEX & INGEST RAG</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
