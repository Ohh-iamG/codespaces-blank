import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dna, 
  Atom, 
  Search, 
  Loader2, 
  ExternalLink, 
  Bookmark, 
  FileText, 
  X, 
  Sparkles, 
  Activity, 
  CheckCircle2,
  ChevronRight,
  Database
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface BioscienceWorkbenchProps {
  isOpen: boolean;
  onClose: () => void;
  onAnchorMemory: (content: string, kind?: string) => void;
}

export function BioscienceWorkbench({ isOpen, onClose, onAnchorMemory }: BioscienceWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<'compounds' | 'proteins' | 'analysis'>('compounds');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Results
  const [compoundResult, setCompoundResult] = useState<any | null>(null);
  const [proteinResults, setProteinResults] = useState<any[]>([]);
  const [analysisTarget, setAnalysisTarget] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [anchoredNotice, setAnchoredNotice] = useState<string | null>(null);

  const searchCompound = async (name: string) => {
    if (!name.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setCompoundResult(null);

    try {
      const res = await apiFetch(`/api/science/pubchem?name=${encodeURIComponent(name.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Compound not found');
      }
      setCompoundResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'PubChem search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const searchProtein = async (term: string) => {
    if (!term.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setProteinResults([]);

    try {
      const res = await apiFetch(`/api/science/uniprot?query=${encodeURIComponent(term.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'UniProt search failed');
      }
      setProteinResults(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0) {
        setErrorMsg(`No proteins matching "${term}" found.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Protein search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const runBiochemicalAnalysis = async (target: string) => {
    if (!target.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);
    setAnalysisResult(null);

    try {
      const res = await apiFetch('/api/science/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Biochemical analysis failed');
      }
      setAnalysisResult(data.analysis);
      setAnalysisTarget(target);
    } catch (err: any) {
      setErrorMsg(err.message || 'Biochemical analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'compounds') {
      searchCompound(query);
    } else if (activeTab === 'proteins') {
      searchProtein(query);
    } else {
      runBiochemicalAnalysis(query);
    }
  };

  const anchorCompound = (c: any) => {
    const text = `[PubChem Compound Anchored]: ${c.title} (CID: ${c.cid || 'N/A'})\nFormula: ${c.molecularFormula} | MW: ${c.molecularWeight} g/mol\nIUPAC: ${c.iupacName}\nSMILES: ${c.canonicalSmiles}\nPubChem: ${c.pubchemUrl}`;
    onAnchorMemory(text, 'science');
    setAnchoredNotice(`Anchored ${c.title} to sovereign vault.`);
    setTimeout(() => setAnchoredNotice(null), 3000);
  };

  const anchorProtein = (p: any) => {
    const text = `[UniProt Protein Target]: ${p.proteinName} (${p.entryName} / ${p.accession})\nOrganism: ${p.organism} | Length: ${p.length} aa\nFunction: ${p.function || 'N/A'}\nAlphaFold 3D: ${p.alphaFoldUrl}`;
    onAnchorMemory(text, 'science');
    setAnchoredNotice(`Anchored ${p.proteinName} to sovereign vault.`);
    setTimeout(() => setAnchoredNotice(null), 3000);
  };

  const anchorAnalysis = () => {
    if (!analysisResult) return;
    const text = `[Biochemical Pharmacology Analysis]: ${analysisTarget}\n\n${analysisResult}`;
    onAnchorMemory(text, 'science');
    setAnchoredNotice(`Anchored biochemical analysis for ${analysisTarget}.`);
    setTimeout(() => setAnchoredNotice(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col font-mono text-xs text-slate-300 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-400">
              <Dna className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <span>BIOSCIENCE & MOLECULAR WORKBENCH</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PUBCHEM • UNIPROT • ALPHAFOLD
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sovereign biological telemetry, compound structures, protein targets, and pharmacology.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 shrink-0">
          <button
            onClick={() => { setActiveTab('compounds'); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
              activeTab === 'compounds'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Atom className="w-3.5 h-3.5" />
            <span>PUBCHEM COMPOUNDS</span>
          </button>

          <button
            onClick={() => { setActiveTab('proteins'); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
              activeTab === 'proteins'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Dna className="w-3.5 h-3.5" />
            <span>UNIPROT & ALPHAFOLD</span>
          </button>

          <button
            onClick={() => { setActiveTab('analysis'); setErrorMsg(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
              activeTab === 'analysis'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>PHARMACOLOGY & TARGETS</span>
          </button>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="p-4 bg-slate-900 border-b border-slate-800 flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                activeTab === 'compounds'
                  ? 'Search molecule or drug (e.g., Metformin, Rapamycin, Caffeine, Aspirin)...'
                  : activeTab === 'proteins'
                  ? 'Search protein target (e.g., EGFR, TP53, ACE2, MTOR, INS)...'
                  : 'Enter biophysical target or substance for pharmacological analysis...'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/50 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>SEARCH</span>
          </button>
        </form>

        {/* Notification Toast */}
        {anchoredNotice && (
          <div className="mx-4 mt-3 p-2 bg-emerald-500/20 border border-emerald-500/50 rounded text-emerald-300 flex items-center gap-2 text-[11px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{anchoredNotice}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/40 rounded text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* TAB 1: COMPOUNDS */}
          {activeTab === 'compounds' && (
            <div>
              {compoundResult ? (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <div className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <span>{compoundResult.title}</span>
                        {compoundResult.cid && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                            CID: {compoundResult.cid}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{compoundResult.iupacName}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => anchorCompound(compoundResult)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded transition-all cursor-pointer"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>ANCHOR TO VAULT</span>
                      </button>
                      <a
                        href={compoundResult.pubchemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>PUBCHEM</span>
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Molecular Formula</span>
                        <span className="text-emerald-400 text-base font-semibold">{compoundResult.molecularFormula || 'N/A'}</span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Molecular Weight</span>
                        <span className="text-slate-200 text-base font-semibold">
                          {compoundResult.molecularWeight ? `${compoundResult.molecularWeight} g/mol` : 'N/A'}
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Canonical SMILES</span>
                        <span className="text-slate-300 text-[11px] break-all font-mono select-all">
                          {compoundResult.canonicalSmiles || 'N/A'}
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">InChIKey</span>
                        <span className="text-slate-400 text-[11px] break-all font-mono select-all">
                          {compoundResult.inchiKey || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-800 rounded-lg">
                      <span className="text-[10px] text-slate-500 font-bold uppercase mb-2">2D Structure Representation</span>
                      {compoundResult.structureImageUrl ? (
                        <div className="bg-white p-3 rounded-lg border border-slate-700 shadow-md">
                          <img
                            src={compoundResult.structureImageUrl}
                            alt={`${compoundResult.title} 2D Structure`}
                            className="max-h-48 max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="text-slate-500 text-xs italic py-8">Structure preview unavailable</div>
                      )}
                      <button
                        onClick={() => {
                          setActiveTab('analysis');
                          setQuery(compoundResult.title);
                          runBiochemicalAnalysis(compoundResult.title);
                        }}
                        className="mt-3 text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Analyze Mechanism of Action</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Atom className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-400">Search the PubChem Compound Database</p>
                  <p className="text-[11px] max-w-sm mx-auto">
                    Lookup molecular properties, 2D structures, molecular weights, and SMILES for any pharmaceutical or biological compound.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {['Metformin', 'Rapamycin', 'Nicotinamide', 'Caffeine', 'Aspirin'].map((c) => (
                      <button
                        key={c}
                        onClick={() => { setQuery(c); searchCompound(c); }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROTEINS & ALPHAFOLD */}
          {activeTab === 'proteins' && (
            <div className="space-y-3">
              {proteinResults.length > 0 ? (
                proteinResults.map((p) => (
                  <div key={p.accession} className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          <span>{p.proteinName}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            {p.accession}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          <span>{p.entryName}</span> &bull; <span>{p.organism}</span> &bull; <span>{p.length} amino acids</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => anchorProtein(p)}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded transition-all cursor-pointer"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                          <span>ANCHOR TARGET</span>
                        </button>
                        <a
                          href={p.alphaFoldUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>ALPHAFOLD 3D</span>
                        </a>
                      </div>
                    </div>

                    {p.function && (
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded border border-slate-800/60">
                        {p.function}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <div>
                        {p.geneNames && p.geneNames.length > 0 && (
                          <span>Genes: <strong className="text-slate-200">{p.geneNames.join(', ')}</strong></span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <a
                          href={p.uniprotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <span>UniProtKB</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href={p.alphaFoldPdbUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <span>Download PDB</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Dna className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-400">Search UniProt & AlphaFold 3D Structures</p>
                  <p className="text-[11px] max-w-sm mx-auto">
                    Inspect protein receptors, functional domains, and predicted 3D AlphaFold models for cellular targets.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {['EGFR', 'ACE2', 'MTOR', 'TP53', 'INS'].map((t) => (
                      <button
                        key={t}
                        onClick={() => { setQuery(t); searchProtein(t); }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PHARMACOLOGY ANALYSIS */}
          {activeTab === 'analysis' && (
            <div>
              {analysisResult ? (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="font-bold text-slate-100 text-sm">
                        BIOPHYSICAL PHARMACOLOGY // {analysisTarget.toUpperCase()}
                      </span>
                    </div>
                    <button
                      onClick={anchorAnalysis}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded transition-all cursor-pointer font-bold"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>ANCHOR ANALYSIS</span>
                    </button>
                  </div>

                  <div className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-slate-900 p-4 rounded-lg border border-slate-800">
                    {analysisResult}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Sparkles className="w-10 h-10 mx-auto text-purple-500/50 mb-2" />
                  <p className="font-semibold text-slate-400">Deep Biochemical & Receptor Mechanism Synthesis</p>
                  <p className="text-[11px] max-w-sm mx-auto">
                    Generate comprehensive pharmacodynamics, biophysical receptor bindings, and genomic variant clearance pathways for any drug or molecule.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {['Metformin AMPK activation', 'Rapamycin mTORC1 inhibition', 'Caffeine Adenosine antagonism'].map((item) => (
                      <button
                        key={item}
                        onClick={() => { setQuery(item); runBiochemicalAnalysis(item); }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
