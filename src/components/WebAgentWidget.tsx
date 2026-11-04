import React, { useState } from 'react';
import { 
  Globe, 
  ArrowRight, 
  Loader2, 
  FileText, 
  Database, 
  CheckCircle2, 
  ExternalLink, 
  Sparkles, 
  BookOpen,
  Copy,
  Check,
  X
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface WebAgentWidgetProps {
  onMemoryAnchored?: (content: string, title: string) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export function WebAgentWidget({ onMemoryAnchored, isModal = false, onClose }: WebAgentWidgetProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoAnchor, setAutoAnchor] = useState(true);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    title: string;
    url: string;
    summary: string;
    rawExcerpt: string;
    anchoredMemoryId: number | null;
  } | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const sampleUrls = [
    { label: 'UniProt Target (CFTR)', url: 'https://en.wikipedia.org/wiki/Cystic_fibrosis_transmembrane_conductance_regulator' },
    { label: 'AlphaFold 3 Architecture', url: 'https://en.wikipedia.org/wiki/AlphaFold' },
    { label: 'Hacker News Frontpage', url: 'https://news.ycombinator.com' },
  ];

  const handleInspectPage = async (e?: React.FormEvent, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = overrideUrl || url;
    if (!targetUrl.trim()) return;

    setLoading(true);
    setErrorNotice(null);

    try {
      const res = await apiFetch('/api/web/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim(), anchorToVault: autoAnchor }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
      if (data.anchoredMemoryId && onMemoryAnchored) {
        onMemoryAnchored(data.summary, data.title);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to inspect web page');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`[${result.title}](${result.url})\n\n${result.summary}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const content = (
    <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-4 sm:p-5 font-mono text-slate-100 shadow-[0_0_25px_rgba(16,185,129,0.15)] flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 tracking-wide flex items-center gap-2">
              <span>IZA WEB AGENT & LIVE PAGE READER</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-600/30">
                GEMINI 3.8 FLASH
              </span>
            </div>
            <div className="text-[10px] text-slate-400 normal-case font-sans">
              Autonomous URL content fetcher, DOM sanitizer & structured research extractor.
            </div>
          </div>
        </div>

        {isModal && onClose && (
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Preset Quick Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="text-slate-500 font-bold uppercase text-[9px]">PRESET LINKS:</span>
        {sampleUrls.map((s, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setUrl(s.url);
              handleInspectPage(undefined, s.url);
            }}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-emerald-500/40 transition cursor-pointer"
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* URL Input Form */}
      <form onSubmit={(e) => handleInspectPage(e)} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste any web page, article or OEM spec URL (https://...)"
            className="w-full bg-slate-950 border border-slate-700 text-xs px-3.5 py-2.5 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : <ArrowRight className="w-4 h-4 text-slate-950" />}
          <span>{loading ? 'READING...' : 'INSPECT PAGE'}</span>
        </button>
      </form>

      {/* Option: Auto-Anchor to Memory */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoAnchor}
            onChange={(e) => setAutoAnchor(e.target.checked)}
            className="accent-emerald-500 w-3.5 h-3.5 rounded"
          />
          <span className="flex items-center gap-1.5 text-slate-300 font-sans">
            <Database className="w-3 h-3 text-cyan-400" />
            <span>Automatically anchor web findings to Sovereign Memory Vault</span>
          </span>
        </label>
        <span className="text-[10px] text-slate-500 hidden sm:inline">Zero Amnesia Engine</span>
      </div>

      {/* Error state */}
      {errorNotice && (
        <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-lg text-red-300 text-xs">
          {errorNotice}
        </div>
      )}

      {/* Inspection Results */}
      {result && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 truncate max-w-xl">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{result.title}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {result.anchoredMemoryId && (
                <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded text-[9px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                  <span>ANCHORED TO VAULT</span>
                </span>
              )}
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-700 rounded transition cursor-pointer"
                title="Open live link"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={handleCopy}
                className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-700 rounded transition cursor-pointer"
                title="Copy analysis"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-slate-900/60 p-3.5 rounded-lg border border-slate-800">
            {result.summary}
          </div>

          {result.rawExcerpt && (
            <details className="text-[10px] text-slate-400">
              <summary className="cursor-pointer hover:text-slate-200 select-none py-1">
                View sanitized DOM text excerpt ({result.rawExcerpt.length} chars)
              </summary>
              <div className="p-2.5 bg-slate-900 rounded border border-slate-800 mt-1 font-mono text-[9px] text-slate-500 break-all leading-normal">
                {result.rawExcerpt}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
        <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
