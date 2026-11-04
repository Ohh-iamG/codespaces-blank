import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, 
  MapPin, 
  Search, 
  Loader2, 
  ExternalLink, 
  Bookmark, 
  X, 
  Sparkles, 
  Compass, 
  CheckCircle2,
  Navigation
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface GroundedIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAnchorMemory: (content: string, kind?: string) => void;
}

export function GroundedIntelligenceModal({ isOpen, onClose, onAnchorMemory }: GroundedIntelligenceModalProps) {
  const [mode, setMode] = useState<'search' | 'maps'>('search');
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search Results
  const [searchResponse, setSearchResponse] = useState<{
    text: string;
    groundingChunks: any[];
    webSearchQueries: string[];
  } | null>(null);

  // Maps Results
  const [mapsResponse, setMapsResponse] = useState<{
    text: string;
    places: any[];
    groundingChunks: any[];
  } | null>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [anchoredNotice, setAnchoredNotice] = useState<string | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser');
      return;
    }
    setLocationStatus('Locating coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationStatus(`GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
      },
      (err) => {
        setLocationStatus(`GPS unavailable (${err.message})`);
      },
      { timeout: 8000 }
    );
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (mode === 'search') {
        const res = await apiFetch('/api/search-grounding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search grounding failed');
        setSearchResponse(data);
      } else {
        const res = await apiFetch('/api/maps-grounding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            latitude: userLocation?.lat,
            longitude: userLocation?.lng,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Maps grounding failed');
        setMapsResponse(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Grounding request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const anchorSearch = () => {
    if (!searchResponse) return;
    const sources = (searchResponse.groundingChunks || [])
      .map((c: any) => c.web ? `${c.web.title} (${c.web.uri})` : null)
      .filter(Boolean)
      .join('\n');

    const text = `[Search Grounded Intel // ${prompt}]:\n\n${searchResponse.text}\n\nSources:\n${sources}`;
    onAnchorMemory(text, 'note');
    setAnchoredNotice('Anchored search intelligence to sovereign vault.');
    setTimeout(() => setAnchoredNotice(null), 3000);
  };

  const anchorMaps = () => {
    if (!mapsResponse) return;
    const placesList = (mapsResponse.places || [])
      .map((p: any) => `${p.title || 'Location'}: ${p.uri || ''}`)
      .join('\n');

    const text = `[Maps Grounded Telemetry // ${prompt}]:\n\n${mapsResponse.text}\n\nPlaces & Facilities:\n${placesList}`;
    onAnchorMemory(text, 'event');
    setAnchoredNotice('Anchored place telemetry to sovereign vault.');
    setTimeout(() => setAnchoredNotice(null), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col font-mono text-xs text-slate-300 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${mode === 'search' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'}`}>
              {mode === 'search' ? <Globe className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            </div>
            <div>
              <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <span>GROUNDED INTELLIGENCE</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  GEMINI 3.8 FLASH
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Live web and location telemetry grounded with Google Search and Google Maps.
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

        {/* Mode Selector */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMode('search'); setErrorMsg(null); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
                mode === 'search'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>GOOGLE SEARCH GROUNDING</span>
            </button>

            <button
              onClick={() => { setMode('maps'); setErrorMsg(null); }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
                mode === 'maps'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>GOOGLE MAPS GROUNDING</span>
            </button>
          </div>

          {mode === 'maps' && (
            <button
              onClick={detectLocation}
              className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
              title="Use your phone or computer GPS coordinates for nearby recommendations"
            >
              <Navigation className="w-3 h-3 text-emerald-400" />
              <span>{locationStatus || 'Detect Location'}</span>
            </button>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleExecute} className="p-4 bg-slate-900 border-b border-slate-800 flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'search'
                  ? 'Ask anything requiring current live web verification (e.g., latest FDA approvals, medical protocols, weather)...'
                  : 'Find local facilities (e.g., nearest 24hr pharmacy, urgent care triage, pathology lab, oxygen supply)...'
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="px-4 py-2 bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/50 rounded-lg font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>GROUND</span>
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

          {/* SEARCH GROUNDING RESULTS */}
          {mode === 'search' && (
            <div>
              {searchResponse ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      SEARCH GROUNDED SYNTHESIS
                    </span>
                    <button
                      onClick={anchorSearch}
                      className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded font-bold cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>ANCHOR INTEL</span>
                    </button>
                  </div>

                  <div className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-slate-950 p-4 rounded-xl border border-slate-800">
                    {searchResponse.text}
                  </div>

                  {/* Web Sources & Grounding Chunks */}
                  {searchResponse.groundingChunks && searchResponse.groundingChunks.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        Verified Web Grounding Sources
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {searchResponse.groundingChunks.map((chunk: any, idx: number) => {
                          const web = chunk.web;
                          if (!web) return null;
                          return (
                            <a
                              key={idx}
                              href={web.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2.5 bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-lg flex items-center justify-between gap-2 group transition-all"
                            >
                              <div className="truncate">
                                <div className="text-[11px] text-cyan-300 font-semibold truncate group-hover:underline">
                                  {web.title || web.uri}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">{web.uri}</div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Search Queries */}
                  {searchResponse.webSearchQueries && searchResponse.webSearchQueries.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500">Queries:</span>
                      {searchResponse.webSearchQueries.map((q, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {q}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Globe className="w-10 h-10 mx-auto text-cyan-500/40 mb-2" />
                  <p className="font-semibold text-slate-300">Live Web Grounding via Google Search</p>
                  <p className="text-[11px] max-w-sm mx-auto">
                    Verify breaking events, recent pharmaceutical advisories, clinical updates, or weather conditions.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {[
                      'Latest Metformin Longevity Clinical Trials 2025',
                      'WHO emergency health alerts today',
                      'Current atmospheric UV index and air quality'
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => { setPrompt(example); }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MAPS GROUNDING RESULTS */}
          {mode === 'maps' && (
            <div>
              {mapsResponse ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      MAPS GROUNDED GEOGRAPHY & PLACES
                    </span>
                    <button
                      onClick={anchorMaps}
                      className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded font-bold cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>ANCHOR PLACES</span>
                    </button>
                  </div>

                  <div className="text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-sans bg-slate-950 p-4 rounded-xl border border-slate-800">
                    {mapsResponse.text}
                  </div>

                  {/* Interactive Map Place Links */}
                  {mapsResponse.places && mapsResponse.places.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        Discovered Facilities & Map Links
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {mapsResponse.places.map((place: any, idx: number) => (
                          <a
                            key={idx}
                            href={place.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="p-3 bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-lg flex flex-col justify-between gap-2 group transition-all"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-100 text-[11px] group-hover:text-emerald-400">
                                  {place.title || 'Local Place'}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                              </div>
                              {place.address && (
                                <p className="text-[10px] text-slate-400 mt-1">{place.address}</p>
                              )}
                            </div>
                            {place.placeAnswerSources?.reviewSnippets && place.placeAnswerSources.reviewSnippets.length > 0 && (
                              <p className="text-[10px] text-slate-400 italic bg-slate-900/80 p-1.5 rounded border border-slate-800/60 line-clamp-2">
                                "{place.placeAnswerSources.reviewSnippets[0]}"
                              </p>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <MapPin className="w-10 h-10 mx-auto text-emerald-500/40 mb-2" />
                  <p className="font-semibold text-slate-300">Geographic Telemetry via Google Maps Grounding</p>
                  <p className="text-[11px] max-w-sm mx-auto">
                    Locate nearby medical centers, emergency trauma triage, pharmacies, testing labs, and biological supply depots.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {[
                      '24-hour pharmacies nearby',
                      'Emergency medical trauma center',
                      'Pathology and blood testing laboratories'
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => { setPrompt(example); }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                      >
                        {example}
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
