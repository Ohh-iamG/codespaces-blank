import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Loader2, Copy, Check, Sparkles, X, Volume2, ArrowRight } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AudioTranscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptReady: (transcript: string) => void;
}

export function AudioTranscribeModal({ isOpen, onClose, onTranscriptReady }: AudioTranscribeModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    setErrorMsg(null);
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(timerRef.current);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await processAudio(audioBlob, mimeType);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setErrorMsg(err.message || 'Microphone access denied. Please allow microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const processAudio = async (blob: Blob, mimeType: string) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const dataUrl = await base64Promise;

      const res = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: dataUrl,
          mimeType: mimeType.split(';')[0] || 'audio/webm',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transcribe audio');
      }

      setTranscript(data.transcript || '(No speech detected)');
    } catch (err: any) {
      console.error('Transcription error:', err);
      setErrorMsg(err.message || 'Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!transcript) return;
    if (!navigator.clipboard?.writeText) {
      setErrorMsg('Clipboard access is unavailable in this browser context.');
      return;
    }

    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
      setErrorMsg('Could not copy transcript to clipboard.');
    }
  };

  const handleApply = () => {
    if (transcript) {
      onTranscriptReady(transcript);
      onClose();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 font-mono text-xs flex flex-col gap-4 text-slate-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <Mic className="w-5 h-5 text-cyan-400" />
            <span className="font-bold tracking-wider uppercase text-sm">
              TRANSCRIBE AUDIO // GEMINI 3.5 TRANSCRIBE
            </span>
          </div>
          <button
            onClick={() => {
              if (isRecording) stopRecording();
              onClose();
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audio Recording Visualizer / Status */}
        <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-950/60 border border-slate-800/80 rounded-lg gap-3">
          {isRecording ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-rose-500 opacity-50"></span>
                <div className="relative w-14 h-14 rounded-full bg-rose-600/30 border-2 border-rose-500 flex items-center justify-center">
                  <Mic className="w-7 h-7 text-rose-400 animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span>RECORDING IN PROGRESS — {formatTime(recordingSeconds)}</span>
              </div>
              <p className="text-[10px] text-slate-400 text-center max-w-xs">
                Speak naturally. Audio is streamed and transcribed verbatim via <span className="text-cyan-300">gemini-3.5-transcribe</span>.
              </p>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
              <div className="text-cyan-300 font-bold">SYNTHESIZING VERBATIM TRANSCRIPT...</div>
              <span className="text-[10px] text-slate-400">Model: gemini-3.5-transcribe</span>
            </div>
          ) : transcript ? (
            <div className="w-full flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  TRANSCRIPTION READY
                </span>
                <span className="text-slate-500">model: gemini-3.5-transcribe</span>
              </div>
              <div className="bg-slate-900 border border-slate-700/80 rounded p-3 text-slate-200 text-sm leading-relaxed max-h-48 overflow-y-auto selection:bg-cyan-500/30">
                {transcript}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                <Mic className="w-6 h-6" />
              </div>
              <div className="font-semibold text-slate-200">Ready to transcribe speech</div>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Tap start recording, dictate your note, dose update, or observation, and receive instant verbatim text.
              </p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/40 rounded text-rose-300 text-[11px]">
            {errorMsg}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div>
            {!isRecording && !isProcessing ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border border-rose-500/50 rounded font-bold cursor-pointer transition-all shadow-[0_0_12px_rgba(244,63,94,0.2)]"
              >
                <Mic className="w-4 h-4 text-rose-400" />
                <span>START RECORDING</span>
              </button>
            ) : isRecording ? (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 rounded font-bold cursor-pointer transition-all"
              >
                <Square className="w-4 h-4 text-rose-400 fill-rose-400" />
                <span>STOP & TRANSCRIBE</span>
              </button>
            ) : null}
          </div>

          {transcript && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
              <button
                onClick={handleApply}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/50 rounded font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.25)] cursor-pointer"
              >
                <span>USE TRANSCRIPT</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
