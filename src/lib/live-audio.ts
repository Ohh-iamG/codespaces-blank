import { auth } from './firebase';

/**
 * Live audio & video streaming manager for Gemini 3.8 Live API
 * Designed for mobile phone hardware (iOS Safari, Android Chrome, and desktop).
 * 
 * Features:
 * - Automatic client-side audio resampling:
 *   Input: Device hardware sample rate (44.1kHz / 48kHz) -> 16kHz 16-bit PCM for Gemini Live
 *   Output: Gemini Live 24kHz PCM -> Device hardware sample rate (prevents pitch distortion & stutter)
 * - User-initiated Audio Unlock for mobile autoplay policy compliance
 * - AudioWorklet keep-alive with seamless ScriptProcessor fallback
 * - Real-time camera video frame streaming (JPEG 1-2 FPS) for multimodal visual Q&A
 */

// Resample Float32Array between arbitrary sample rates using linear interpolation
export function resampleBuffer(sourceBuffer: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate || sourceBuffer.length === 0) {
    return sourceBuffer;
  }
  const ratio = sourceRate / targetRate;
  const targetLength = Math.round(sourceBuffer.length / ratio);
  const result = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * ratio;
    const lower = Math.floor(srcIndex);
    const upper = Math.min(lower + 1, sourceBuffer.length - 1);
    const weight = srcIndex - lower;
    result[i] = sourceBuffer[lower] * (1 - weight) + sourceBuffer[upper] * weight;
  }
  return result;
}

// Convert Float32Array to 16-bit PCM ArrayBuffer then to base64
function floatTo16BitPCM(input: Float32Array): string {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  let binary = '';
  const bytes = new Uint8Array(output.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 16-bit PCM to Float32Array
function base64To16BitPCM(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

export interface VoiceSentiment {
  stress_index: number;
  tone: string;
  rms: number;
}

export interface LiveSessionCallbacks {
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'listening') => void;
  onMicStatusChange?: (enabled: boolean, reason?: string) => void;
  onAudioUnlockChange?: (unlocked: boolean) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onMemoryAnchored?: (memory: { id?: number; content: string; kind?: string; sentiment?: any }) => void;
  onError?: (err: string) => void;
  onVolumeChange?: (inputVol: number, outputVol: number) => void;
  onSentimentChange?: (sentiment: VoiceSentiment) => void;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private callbacks: LiveSessionCallbacks = {};
  public isConnected = false;
  public isMicMuted = false;
  public hasMicAccess = false;
  public isAudioUnlocked = false;

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Unlock Web Audio contexts on direct mobile user gesture (tap/touch)
   */
  public async unlockAudioContext(): Promise<boolean> {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.outputAudioCtx && AudioCtxClass) {
        this.outputAudioCtx = new AudioCtxClass();
      }

      if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      // Play a short silent buffer to prime iOS audio hardware
      if (this.outputAudioCtx) {
        const silentBuffer = this.outputAudioCtx.createBuffer(1, 1, 22050);
        const source = this.outputAudioCtx.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(this.outputAudioCtx.destination);
        source.start(0);
      }

      this.isAudioUnlocked = true;
      this.callbacks.onAudioUnlockChange?.(true);
      return true;
    } catch (err) {
      console.warn('Audio unlock warning:', err);
      return false;
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;
    this.callbacks.onStatusChange?.('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/^https?:\/\//, '') || window.location.host;
    const wsProtocol = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.startsWith('http://') ? 'ws:' : protocol;
    const idToken = (await auth.currentUser?.getIdToken()) ?? '';
    const wsUrl = `${wsProtocol}//${host}/live?token=${encodeURIComponent(idToken)}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = async () => {
          this.isConnected = true;
          this.callbacks.onStatusChange?.('connected');

          // Attempt initial audio unlock & mic start
          await this.unlockAudioContext().catch(() => {});
          try {
            await this.startAudioCapture();
          } catch (micErr: any) {
            console.warn('Microphone permission deferred or denied:', micErr);
            this.callbacks.onMicStatusChange?.(false, 'Microphone permission needed. Tap Enable Mic to speak.');
          }
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.error) {
              this.callbacks.onError?.(data.error);
            }
            if (data.inputTranscript) {
              this.callbacks.onInputTranscript?.(data.inputTranscript);
            }
            if (data.outputTranscript) {
              this.callbacks.onOutputTranscript?.(data.outputTranscript);
            }
            if (data.memoryAnchored) {
              this.callbacks.onMemoryAnchored?.(data.memoryAnchored);
            }
            if (data.interrupted) {
              this.handleInterruption();
            }
            if (data.audio) {
              this.callbacks.onStatusChange?.('speaking');
              this.playAudioChunk(data.audio);
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        this.ws.onerror = (e) => {
          console.error('WebSocket error:', e);
          this.callbacks.onError?.('Live connection error');
          reject(e);
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.callbacks.onStatusChange?.('disconnected');
          this.cleanup();
        };
      } catch (err) {
        this.callbacks.onError?.('Could not create WebSocket');
        reject(err);
      }
    });
  }

  private async startAudioCapture() {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.inputAudioCtx && AudioCtxClass) {
      this.inputAudioCtx = new AudioCtxClass();
    }

    if (this.inputAudioCtx && this.inputAudioCtx.state === 'suspended') {
      await this.inputAudioCtx.resume();
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.hasMicAccess = true;
    this.callbacks.onMicStatusChange?.(true);

    const source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
    const nativeSampleRate = this.inputAudioCtx.sampleRate;

    // Process incoming audio frames, calculate sentiment & resample to 16kHz PCM
    const handleAudioChunk = (channelData: Float32Array) => {
      if (!this.isConnected || this.isMicMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      // 1. Telemetry & volume analysis
      let sum = 0;
      let zeroCrossings = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
        if (i > 0 && ((channelData[i] >= 0 && channelData[i - 1] < 0) || (channelData[i] < 0 && channelData[i - 1] >= 0))) {
          zeroCrossings++;
        }
      }
      const rms = Math.sqrt(sum / channelData.length);
      this.callbacks.onVolumeChange?.(rms, 0);

      // 2. Sentiment inference
      const zcrRatio = zeroCrossings / channelData.length;
      let stress_index = 2;
      let tone = 'calm';

      if (rms > 0.02) {
        if (rms > 0.15 || zcrRatio > 0.28) {
          stress_index = Math.min(10, Math.round(5 + rms * 20 + zcrRatio * 10));
          tone = stress_index >= 7 ? 'strained' : 'elevated';
        } else if (rms > 0.05) {
          stress_index = Math.min(6, Math.round(3 + rms * 15));
          tone = 'focused';
        } else {
          stress_index = 2;
          tone = 'grounded';
        }

        const sentimentPayload: VoiceSentiment = { stress_index, tone, rms };
        this.callbacks.onSentimentChange?.(sentimentPayload);

        if (Math.random() < 0.12) {
          this.ws.send(JSON.stringify({ sentiment: { stress_index, tone } }));
        }
      }

      // 3. Resample from phone native hardware rate (e.g. 44.1kHz / 48kHz) to 16000Hz PCM
      const resampled = resampleBuffer(channelData, nativeSampleRate, 16000);
      const base64PCM = floatTo16BitPCM(resampled);
      this.ws.send(JSON.stringify({ audio: base64PCM }));
    };

    // Try AudioWorklet first for mobile keep-alive
    let workletInitialized = false;
    if (this.inputAudioCtx.audioWorklet && typeof Blob !== 'undefined') {
      try {
        const workletCode = `
          class IzaAudioProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0];
              if (input && input[0] && input[0].length > 0) {
                this.port.postMessage(input[0]);
              }
              return true;
            }
          }
          registerProcessor('iza-audio-processor', IzaAudioProcessor);
        `;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await this.inputAudioCtx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        this.workletNode = new AudioWorkletNode(this.inputAudioCtx, 'iza-audio-processor');
        this.workletNode.port.onmessage = (event) => {
          handleAudioChunk(event.data);
        };

        source.connect(this.workletNode);
        this.workletNode.connect(this.inputAudioCtx.destination);
        workletInitialized = true;
      } catch (workletErr) {
        console.warn('AudioWorklet initialization fallback to ScriptProcessor:', workletErr);
      }
    }

    // Fallback to ScriptProcessorNode
    if (!workletInitialized) {
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
      this.scriptProcessor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0);
        handleAudioChunk(channelData);
      };
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);
    }
  }

  public async enableMicrophone(): Promise<boolean> {
    try {
      await this.unlockAudioContext();
      await this.startAudioCapture();
      return true;
    } catch (err: any) {
      console.warn('Microphone permission request rejected:', err);
      this.callbacks.onMicStatusChange?.(false, 'Microphone permission denied. Check your browser site permissions.');
      return false;
    }
  }

  /**
   * Playback 24kHz incoming PCM audio chunk from Gemini Live
   * Resamples chunk to match mobile AudioContext sample rate for stutter-free, pitch-accurate audio
   */
  private playAudioChunk(base64: string) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!this.outputAudioCtx && AudioCtxClass) {
      this.outputAudioCtx = new AudioCtxClass();
    }
    if (!this.outputAudioCtx) return;

    if (this.outputAudioCtx.state === 'suspended') {
      this.outputAudioCtx.resume().catch(() => {});
    }

    const float32_24k = base64To16BitPCM(base64);
    const targetSampleRate = this.outputAudioCtx.sampleRate || 48000;

    // Resample from 24kHz to native device sample rate (e.g. 44.1kHz or 48kHz)
    const resampledData = resampleBuffer(float32_24k, 24000, targetSampleRate);

    const audioBuffer = this.outputAudioCtx.createBuffer(1, resampledData.length, targetSampleRate);
    audioBuffer.getChannelData(0).set(resampledData);

    const source = this.outputAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioCtx.destination);

    const currentTime = this.outputAudioCtx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0) {
        this.callbacks.onStatusChange?.('listening');
      }
    };
  }

  /**
   * Stream a JPEG video frame from the camera to Gemini 3.8 Live
   */
  public sendVideoFrame(base64Jpeg: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ image: base64Jpeg }));
    }
  }

  public sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text }));
    }
  }

  public setMicMuted(muted: boolean) {
    this.isMicMuted = muted;
  }

  private handleInterruption() {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch (_) {}
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    this.callbacks.onStatusChange?.('listening');
  }

  public disconnect() {
    this.cleanup();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.callbacks.onStatusChange?.('disconnected');
  }

  private cleanup() {
    this.handleInterruption();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch (_) {}
      this.workletNode = null;
    }
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (_) {}
      this.scriptProcessor = null;
    }
    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (_) {}
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch (_) {}
      this.outputAudioCtx = null;
    }
  }
}
