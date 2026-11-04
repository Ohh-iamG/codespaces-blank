import React, { useState, useRef } from 'react';
import { X, UploadCloud, Image as ImageIcon, Sparkles, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface VisualUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (memory: any) => void;
}

export function VisualUploadModal({ isOpen, onClose, onUploaded }: VisualUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (selected: File) => {
    setError(null);
    setResult(null);
    setFile(selected);

    if (selected.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await apiFetch('/api/attachments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || 'image/jpeg',
              fileData: base64Data,
              note: note.trim() || undefined,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to process visual artifact');
          }

          const data = await res.json();
          setResult(data);
          onUploaded(data.memory);
        } catch (postErr: any) {
          setError(postErr.message || 'Vision ingestion failed');
        } finally {
          setIsUploading(false);
        }
      };
    } catch (err: any) {
      setError(err.message || 'File read error');
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl(null);
    setNote('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-blue-500/60 rounded-xl w-full max-w-xl flex flex-col shadow-[0_0_50px_rgba(59,130,246,0.25)] overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-100 text-sm tracking-wide flex items-center gap-2">
                <span>MULTI-MODAL VISUAL INGESTION</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono">
                  GEMINI VISION &bull; RECALLABLE
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Ingest photos, equipment diagrams, sketches, or site notes directly into Cloud SQL.
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {!result ? (
            <>
              {/* Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  file
                    ? 'border-blue-500/60 bg-blue-950/20'
                    : 'border-slate-700 hover:border-blue-400/60 bg-slate-950/50 hover:bg-slate-900'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />

                {previewUrl ? (
                  <div className="relative w-full max-h-48 flex items-center justify-center overflow-hidden rounded-lg border border-slate-800">
                    <img src={previewUrl} alt="Upload preview" className="object-contain max-h-48" />
                  </div>
                ) : file ? (
                  <div className="text-center">
                    <ImageIcon className="w-10 h-10 mx-auto text-blue-400 mb-2" />
                    <span className="text-xs font-mono text-slate-200">{file.name}</span>
                    <span className="block text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <UploadCloud className="w-10 h-10 mx-auto text-blue-400/70 mb-2" />
                    <span className="text-xs font-mono text-slate-200 font-bold block">
                      DRAG & DROP OR CLICK TO BROWSE
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono block mt-1">
                      Supports .PNG, .JPG, .WEBP, .PDF (Sketches, schematics, field notes)
                    </span>
                  </div>
                )}
              </div>

              {/* Note Context Input */}
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">
                  TACTICAL CONTEXT / USER NOTE (OPTIONAL):
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Boundary fence post-hole diagram, north lot with Dave..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-950/60 border border-red-500/50 rounded text-red-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            /* Success & Extracted Synthesis Display */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-300 font-mono">
                    VISUAL ARTIFACT ANCHORED INTO MEMORY VAULT
                  </div>
                  <div className="text-[11px] text-emerald-400/80 font-mono">
                    Extracted text & entities are now searchable via &apos;iza recall&apos;.
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
                <span className="text-[10px] font-mono text-cyan-400 font-bold block">
                  GEMINI VISION SYNTHESIS:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {result.visualDescription}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          {!result ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-mono transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={!file || isUploading}
                onClick={handleUpload}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-mono font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-blue-500/20"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ANALYZING WITH VISION...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>INGEST & ANCHOR</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
              >
                INGEST ANOTHER
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                DONE
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
