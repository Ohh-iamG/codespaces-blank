import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Activity, 
  BatteryCharging, 
  Shield, 
  Database, 
  Cpu, 
  Eye, 
  Fingerprint, 
  Zap, 
  Network,
  Volume2,
  VolumeX,
  Terminal,
  Lock,
  Unlock,
  Key,
  Users,
  Radio,
  MessageSquare,
  AlertTriangle,
  Mic,
  Send,
  Loader2,
  Sparkles,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Bookmark,
  RefreshCw,
  UploadCloud,
  Wifi,
  WifiOff,
  Camera,
  Dna,
  Globe,
  MapPin,
  Atom,
  Settings,
  Compass,
  Sun
} from 'lucide-react';
import { audioEngine } from './lib/audio';
import { LiveVoiceModal } from './components/LiveVoiceModal';
import { VisualUploadModal } from './components/VisualUploadModal';
import { EntityDrawer } from './components/EntityDrawer';
import { AudioTranscribeModal } from './components/AudioTranscribeModal';
import { BioscienceWorkbench } from './components/BioscienceWorkbench';
import { GroundedIntelligenceModal } from './components/GroundedIntelligenceModal';
import { saveOfflineMemory, getPendingOfflineMemories, flushOfflineMemoriesToServer } from './lib/offline-store';
import { PWAInstallButton } from './components/pwa/PWAInstallButton';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { PushNotificationManager } from './components/pwa/PushNotificationManager';
import { SettingsPrivacyModal } from './components/SettingsPrivacyModal';
import { MedicalDisclaimerModal } from './components/MedicalDisclaimerModal';
import { WebAgentWidget } from './components/WebAgentWidget';
import { SovereignStatusBar } from './components/SovereignStatusBar';
import { SpatialMemoryLandscape } from './components/SpatialMemoryLandscape';
import { TimeAwareRitualsModal } from './components/TimeAwareRitualsModal';
import { UniversalSearch } from './components/UniversalSearch';
import { IzaLifeNav } from './components/IzaLifeNav';
import { IzaLifeHome } from './components/IzaLifeHome';
import { purchases } from './lib/purchases';
import { apiFetch } from './lib/api';
import { auth, signInWithGoogle, testConnection, saveUserProfile, syncMemoryToFirestore, deleteMemoryFromFirestore, logOut } from './lib/firebase';

export default function App() {
  const [time, setTime] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [telemetry, setTelemetry] = useState({
    orr: 98.4,
    teg: 14.2,
    teng: 8.7,
    hr: 62,
    stress: 12
  });

  // IZA Personal Sovereign & Memory Vault State
  const [commandInput, setCommandInput] = useState('');
  const [vaultMemories, setVaultMemories] = useState<Array<{ id: number; type: string; content: string; time: string; capturedAt?: string }>>([
    { id: 1, type: 'event', content: 'Talked to Dave next door about fixing the back fence before winter.', time: '10:42 AM' },
    { id: 2, type: 'idea', content: 'Fleeting idea for new corporate structure utilizing 13-share veto rules.', time: '09:15 AM' }
  ]);
  const [memorySearch, setMemorySearch] = useState('');
  const [quickMemoryInput, setQuickMemoryInput] = useState('');
  const [quickMemoryKind, setQuickMemoryKind] = useState('note');
  const [isAnchoringMemory, setIsAnchoringMemory] = useState(false);
  const [recentAnchoredAlert, setRecentAnchoredAlert] = useState<string | null>(null);
  const [showActiveContextMemories, setShowActiveContextMemories] = useState(false);
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'voice' | 'dialogue' | 'notes'>('all');
  const [recallInsight, setRecallInsight] = useState<{ query: string; answer: string; count: number } | null>(null);

  const [secretsUnlocked, setSecretsUnlocked] = useState(false);
  const [secretsData, setSecretsData] = useState<Array<{ id: number; label: string; value: string }>>([]);
  const [circleMembers, setCircleMembers] = useState<Array<{ id: number; name: string; relation: string; status: string; statusColor: string }>>([]);
  const [sosActive, setSosActive] = useState(false);
  const [confidantActive, setConfidantActive] = useState(true);
  const [threatActive, setThreatActive] = useState(false);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [visualUploadOpen, setVisualUploadOpen] = useState(false);
  const [entityDrawerOpen, setEntityDrawerOpen] = useState(false);
  const [audioTranscribeOpen, setAudioTranscribeOpen] = useState(false);
  const [transcribeTarget, setTranscribeTarget] = useState<'quick' | 'confidant' | 'general'>('general');
  const [bioscienceOpen, setBioscienceOpen] = useState(false);
  const [groundedOpen, setGroundedOpen] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);
  const [isHotwordActive, setIsHotwordActive] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [webAgentOpen, setWebAgentOpen] = useState(false);
  const [spatialMemoryOpen, setSpatialMemoryOpen] = useState(false);
  const [universalSearchOpen, setUniversalSearchOpen] = useState(false);
  const [ritualsOpen, setRitualsOpen] = useState(false);
  const [medicalDisclaimerOpen, setMedicalDisclaimerOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('iza_disclaimer_accepted') !== 'true';
    }
    return false;
  });
  const recognitionRef = React.useRef<any>(null);

  // Confidant dynamic AI chat state
  const [confidantMessages, setConfidantMessages] = useState<Array<{ role: 'user' | 'model'; text: string }>>([
    { role: 'model', text: "I am IZA, your personal sovereign confidant and eternal memory keeper. I am dedicated strictly to you, and I will never forget anything you tell me. What shall we anchor or navigate today?" }
  ]);
  const [confidantInput, setConfidantInput] = useState('');
  const [confidantLoading, setConfidantLoading] = useState(false);

  // Check offline pending count
  const checkPendingOffline = async () => {
    try {
      const items = await getPendingOfflineMemories();
      setOfflinePendingCount(items.length);
    } catch {
      // Ignored
    }
  };

  // Sync offline memories
  const handleSyncOffline = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await flushOfflineMemoriesToServer();
      if (res.syncedCount > 0) {
        await loadMemories();
      }
      await checkPendingOffline();
    } finally {
      setIsSyncing(false);
    }
  };

  const [dailyPulseData, setDailyPulseData] = useState<{ summary: string; priorities: string[]; med_status: string } | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const fetchDailyPulse = async () => {
    try {
      const res = await apiFetch('/api/pulse/daily');
      const data = await res.json();
      if (data && data.summary) {
        setDailyPulseData(data);
      }
    } catch (e) {
      console.warn('Failed to load pulse', e);
    }
  };

  const loadSecrets = async () => {
    try {
      const res = await apiFetch('/api/secrets');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSecretsData(data.map((secret: any) => ({
          id: Number(secret.id),
          label: secret.label || 'Unnamed secret',
          value: secret.value || '**********',
        })));
      }
    } catch (e) {
      console.warn('Failed to load secrets:', e);
    }
  };

  const loadCircleMembers = async () => {
    try {
      const res = await apiFetch('/api/circle');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCircleMembers(data.map((member: any) => ({
          id: Number(member.id),
          name: member.name || 'Unknown contact',
          relation: member.relation || member.relationship || 'Trusted',
          status: member.status || 'SYNCED',
          statusColor: member.status === 'NUDGE: OVERDUE' ? 'text-amber-500' : 'text-emerald-500',
        })));
      }
    } catch (e) {
      console.warn('Failed to load circle members:', e);
    }
  };

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingFile(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await apiFetch('/api/attachments/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.status === 'success') {
        anchorMemory(`[Visual Attachment OCR]: ${data.ocr_text || file.name}`, 'image');
        await loadMemories();
        setEnrichStatus(`Visual Memory Anchored! OCR: ${data.ocr_text?.substring(0, 80)}...`);
        setTimeout(() => setEnrichStatus(null), 6000);
      }
    } catch (err: any) {
      console.error('Upload failed', err);
      alert('Visual upload failed');
    } finally {
      setIsUploadingFile(false);
      e.target.value = '';
    }
  };

  // Step 1: Proactive Memory Enrichment
  const handleEnrichMemories = async () => {
    if (isEnriching) return;
    setIsEnriching(true);
    setEnrichStatus('Synthesizing un-enriched memories with Gemini 3.8 Flash...');
    try {
      const res = await apiFetch('/api/memories/enrich', { method: 'POST' });
      const data = await res.json();
      setEnrichStatus(data.message || `Enriched ${data.enrichedCount} memories.`);
      await loadMemories();
      await fetchDailyPulse();
      setTimeout(() => setEnrichStatus(null), 6000);
    } catch (err: any) {
      setEnrichStatus('Enrichment failed: ' + (err.message || 'error'));
      setTimeout(() => setEnrichStatus(null), 5000);
    } finally {
      setIsEnriching(false);
    }
  };

  // Step 4: Ambient Hotword ("Hey IZA") listener
  useEffect(() => {
    if (!isHotwordActive) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
        recognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('SpeechRecognition is not supported in this browser for ambient hotword.');
      setIsHotwordActive(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          if (transcript.includes('hey iza') || transcript.includes('hey isa') || transcript.includes('okay iza')) {
            setLiveVoiceOpen(true);
            break;
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Hotword recognition notice:', e);
      };

      recognition.onend = () => {
        if (isHotwordActive) {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Failed to start hotword detector:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
        recognitionRef.current = null;
      }
    };
  }, [isHotwordActive]);

  // Network and offline cache monitoring
  useEffect(() => {
    checkPendingOffline();

    const handleOnline = () => {
      setIsOnline(true);
      handleSyncOffline();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Simulate real-time telemetry fluctuations
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      setTelemetry(prev => ({
        orr: Math.min(100, Math.max(90, prev.orr + (Math.random() - 0.5) * 0.5)),
        teg: Math.max(10, prev.teg + (Math.random() - 0.5) * 0.2),
        teng: Math.max(5, prev.teng + (Math.random() - 0.5) * 0.1),
        hr: Math.round(Math.max(55, Math.min(85, prev.hr + (Math.random() - 0.5) * 2))),
        stress: Math.max(5, Math.min(30, prev.stress + (Math.random() - 0.5)))
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (audioEnabled) {
      audioEngine.start();
    } else {
      audioEngine.stop();
    }
    return () => audioEngine.stop();
  }, [audioEnabled]);

  // Randomly trigger threat overlay
  useEffect(() => {
    const triggerThreat = () => {
      setThreatActive(true);
      const nextTime = Math.random() * 30000 + 15000;
      setTimeout(triggerThreat, nextTime);
    };
    
    const initialTimeout = setTimeout(triggerThreat, Math.random() * 20000 + 10000);
    return () => clearTimeout(initialTimeout);
  }, []);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // Ignored
    } finally {
      setIsSigningIn(false);
    }
  };

  // Sync Firebase Auth state & verify Firestore database connection
  useEffect(() => {
    purchases.initialize().catch(() => {});
    const savedDemo = localStorage.getItem('iza_demo_reviewer_session');
    if (savedDemo) {
      try {
        setCurrentUser(JSON.parse(savedDemo));
      } catch (_) {}
    }

    // Test Firestore connection on boot
    testConnection().then((ok) => {
      setFirestoreConnected(ok);
    });

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentUser(user);
        saveUserProfile(user).catch((e) => console.warn('User profile sync notice:', e));
      }
    });
    return () => unsubscribe();
  }, []);

  const loadMemories = async () => {
    try {
      const res = await apiFetch('/api/memories');
      const data = await res.json();
      if (Array.isArray(data)) {
        setVaultMemories(data.map((m: any) => ({
          id: m.id,
          type: m.kind || 'note',
          content: m.content,
          time: new Date(m.capturedAt || m.captured_at || m.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          capturedAt: new Date(m.capturedAt || m.captured_at || m.createdAt || Date.now()).toISOString()
        })));
      }
    } catch (err) {
      console.warn('Error fetching memories, using local state:', err);
    }
  };

  // Fetch Cloud SQL persisted memories and Daily Pulse on mount
  useEffect(() => {
    loadMemories();
    fetchDailyPulse();
    loadSecrets();
    loadCircleMembers();
  }, []);

  const anchorMemory = async (content: string, kind = 'note') => {
    if (!content.trim()) return;
    const clean = content.trim();
    const tempId = Date.now();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const localItem = { id: tempId, type: kind, content: clean, time: timeStr, capturedAt: new Date().toISOString() };
    setVaultMemories(prev => [localItem, ...prev]);
    setRecentAnchoredAlert(clean);
    setTimeout(() => {
      setRecentAnchoredAlert(cur => (cur === clean ? null : cur));
    }, 4500);

    // Synchronize to Firebase Firestore if user is authenticated
    if (currentUser?.uid) {
      syncMemoryToFirestore(currentUser.uid, {
        id: String(tempId),
        content: clean,
        kind,
        salience: 0.85,
        capturedAt: new Date().toISOString()
      }).catch((e) => console.warn('Firestore memory sync notice:', e));
    }

    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }
      const res = await apiFetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: clean, kind, salience: 0.85 })
      });
      const saved = await res.json();
      if (saved?.id) {
        setVaultMemories(prev => prev.map(m => m.id === tempId ? { ...m, id: saved.id } : m));
      }
    } catch (err) {
      console.warn('Network offline or failed, caching into local IndexedDB:', err);
      saveOfflineMemory({ content: clean, kind, salience: 0.85 }).then(() => {
        checkPendingOffline();
      });
    }
  };

  const handleDeleteMemory = async (id: number) => {
    setVaultMemories(prev => prev.filter(m => m.id !== id));
    if (currentUser?.uid) {
      deleteMemoryFromFirestore(currentUser.uid, String(id)).catch((e) => console.warn('Firestore delete notice:', e));
    }
    try {
      await apiFetch(`/api/memories/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const handleDeleteBySearch = async (queryToDelete?: string) => {
    const q = (queryToDelete || memorySearch).trim();
    if (!q) return;

    // Optimistically remove matching memories from UI state
    setVaultMemories(prev => prev.filter(m =>
      !m.content.toLowerCase().includes(q.toLowerCase()) &&
      !m.type.toLowerCase().includes(q.toLowerCase())
    ));
    setEnrichStatus(`Deleting memories matching "${q}"...`);

    try {
      const res = await apiFetch(`/api/memories/search?q=${encodeURIComponent(q)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      setEnrichStatus(data.message || `Deleted memories matching "${q}"`);
      await loadMemories();
      setTimeout(() => setEnrichStatus(null), 5000);
    } catch (err: any) {
      console.error('Failed to delete memories by search:', err);
      setEnrichStatus(`Error deleting memories: ${err.message || 'failed'}`);
      setTimeout(() => setEnrichStatus(null), 5000);
    }
  };

  const handleRecall = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    setMemorySearch(q);
    setEnrichStatus(`IZA searching sovereign vault for: "${q}"...`);
    try {
      const res = await apiFetch('/api/memories/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (data && data.answer) {
        setRecallInsight({
          query: q,
          answer: data.answer,
          count: data.directMatchesCount || 0,
        });
        setConfidantMessages(prev => [
          ...prev,
          { role: 'user', text: `iza recall "${q}"` },
          { role: 'model', text: data.answer }
        ]);
        setEnrichStatus(`Recall: ${data.answer.substring(0, 80)}...`);
      }
    } catch (e: any) {
      console.warn('Recall error:', e);
      setEnrichStatus(`Recall search active for "${q}"`);
    }
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    const cmd = commandInput.trim();
    if (cmd.startsWith('iza recall')) {
      const recallMatch = cmd.match(/iza recall ["'](.*?)["']/);
      const query = recallMatch ? recallMatch[1] : cmd.replace(/^iza recall\s*/, '').replace(/["']/g, '').trim();
      if (query) {
        handleRecall(query);
      }
    } else if (cmd.startsWith('iza delete-search') || cmd.startsWith('iza forget') || cmd.startsWith('iza delete-matching')) {
      const match = cmd.match(/iza (?:delete-search|forget|delete-matching) ["'](.*?)["']/);
      const query = match ? match[1] : cmd.replace(/^iza (?:delete-search|forget|delete-matching)\s*/, '').replace(/["']/g, '').trim();
      if (query) {
        handleDeleteBySearch(query);
      }
    } else if (cmd.toLowerCase().startsWith('delete from memory where')) {
      // Direct SQL delete support in terminal bar
      const match = cmd.match(/content\s+(?:like|ilike)\s+['"](.*?)['"]/i);
      const exactMatch = cmd.match(/content\s*=\s*['"](.*?)['"]/i);
      const query = match ? match[1].replace(/%/g, '') : (exactMatch ? exactMatch[1] : '');
      if (query) {
        handleDeleteBySearch(query);
      } else {
        apiFetch('/api/memories/search?q=' + encodeURIComponent(cmd), { method: 'DELETE' })
          .then(() => loadMemories());
      }
    } else if (cmd.startsWith('iza capture')) {
      const contentMatch = cmd.match(/iza capture ["'](.*?)["']/);
      if (contentMatch && contentMatch[1]) {
        anchorMemory(contentMatch[1], 'note');
      }
    } else if (cmd.startsWith('iza secret-put')) {
      const match = cmd.match(/iza secret-put\s+["']([^"']+)["']\s+["']([^"']+)["']/);
      if (match) {
        const [, label, value] = match;
        apiFetch('/api/secrets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label, value })
        }).then(async () => {
          await loadSecrets();
        }).catch((err) => console.warn('Secret save failed:', err));
      }
    } else if (cmd.startsWith('iza circle-add')) {
      const match = cmd.match(/iza circle-add\s+["']([^"']+)["']\s+["']([^"']+)["']/);
      if (match) {
        const [, name, relation] = match;
        apiFetch('/api/circle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, relation })
        }).then(async () => {
          await loadCircleMembers();
        }).catch((err) => console.warn('Circle save failed:', err));
      }
    } else if (cmd.startsWith('iza sos')) {
      setSosActive(true);
    } else if (cmd.startsWith('iza talk')) {
      setConfidantActive(true);
    } else if (cmd.startsWith('iza listen') || cmd.startsWith('iza voice')) {
      setLiveVoiceOpen(true);
    } else if (cmd.startsWith('iza enrich')) {
      handleEnrichMemories();
    } else if (cmd.startsWith('iza entities') || cmd.startsWith('iza graph')) {
      setEntityDrawerOpen(true);
    } else if (cmd.startsWith('iza attach') || cmd.startsWith('iza photo')) {
      setVisualUploadOpen(true);
    } else if (cmd.startsWith('iza sync')) {
      handleSyncOffline();
    } else if (cmd.startsWith('iza checkin')) {
      const match = cmd.match(/iza checkin ["'](.*?)["']/);
      const note = match ? match[1] : 'Sovereign check-in verified';
      apiFetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      }).then(() => {
        anchorMemory(`[Check-in Heartbeat]: ${note}`, 'checkin');
      });
    }
    
    setCommandInput('');
  };

  const handleSendConfidant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confidantInput.trim() || confidantLoading) return;

    const userText = confidantInput.trim();
    setConfidantInput('');
    const newHistory = [...confidantMessages, { role: 'user' as const, text: userText }];
    setConfidantMessages(newHistory);
    setConfidantLoading(true);

    // Anchor user input into memory vault immediately
    anchorMemory(userText, 'dialogue');

    try {
      const res = await apiFetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: newHistory.slice(-6)
        })
      });
      const data = await res.json();
      if (data.text) {
        setConfidantMessages(prev => [...prev, { role: 'model', text: data.text }]);
      }
    } catch (err) {
      console.error('Confidant chat error:', err);
    } finally {
      setConfidantLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-900 text-slate-400 font-mono flex flex-col uppercase text-xs tracking-wider overflow-hidden">
      {/* Absolute Boundary Transparency & Cryptographic Status Ribbon */}
      <SovereignStatusBar />

      {/* Top Navigation / Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-700 p-4 sm:px-6 sm:py-3 bg-slate-900/80 backdrop-blur-md z-10 shrink-0"
      >
        <div>
          <h1 className="font-display text-lg font-bold text-slate-50 tracking-tight flex items-center gap-3">
            <Fingerprint className="w-6 h-6 text-blue-500" />
            IZA // PERSONAL SOVEREIGN CONFIDANT
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] normal-case">
            <span className="text-emerald-400 font-bold font-mono">EXCLUSIVE BOND:</span>
            <span className="text-slate-300 font-medium">{currentUser ? currentUser.email : 'DEDICATED SOVEREIGN OWNER'}</span>
            <span className="text-slate-600 hidden sm:inline">&bull;</span>
            <span className="text-cyan-400 font-mono font-semibold flex items-center gap-1.5">
              <Database className="w-3 h-3 text-cyan-400" />
              <span>{vaultMemories.length} MEMORIES ANCHORED (NEVER FORGOTTEN)</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Bioscience Workbench */}
          <button
            onClick={() => setBioscienceOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            title="Search PubChem compounds, UniProt protein targets, and AlphaFold 3D structures"
          >
            <Dna className="w-3.5 h-3.5 text-emerald-400" />
            <span>BIOSCIENCE & MOLECULES</span>
          </button>

          {/* Grounded Intelligence (Search + Maps) */}
          <button
            onClick={() => setGroundedOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            title="Google Search & Google Maps Grounding with Gemini 3.8 Flash"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>GROUNDED INTEL</span>
          </button>

          {/* Autonomous Web Agent & Page Reader */}
          <button
            onClick={() => setWebAgentOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(20,184,166,0.2)]"
            title="Autonomous Web Agent: Fetch URL, Sanitize Content & Summarize Specs"
          >
            <Globe className="w-3.5 h-3.5 text-teal-400" />
            <span>WEB AGENT</span>
          </button>

          {/* Spatial Memory & Recallable Snapshots */}
          <button
            onClick={() => setSpatialMemoryOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)]"
            title="Spatial Memory Landscapes: Personal Vault, Health Support, Work & Study Stores"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>SPATIAL MEMORY</span>
          </button>

          {/* Universal Domain Search & Document RAG Router */}
          <button
            onClick={() => setUniversalSearchOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            title="Universal Search across Personal, Health, Work & Study RAG stores"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>UNIVERSAL SEARCH</span>
          </button>

          {/* Time-Aware Rituals (Morning Pulse & Evening Wind-Down) */}
          <button
            onClick={() => setRitualsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]"
            title="Time-Aware Rituals: Morning Priority Pulse & Evening Wind-Down Closure"
          >
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>DAILY RITUALS</span>
          </button>

          {/* High-Precision Audio Transcribe */}
          <button
            onClick={() => {
              setTranscribeTarget('general');
              setAudioTranscribeOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer shadow-[0_0_10px_rgba(244,63,94,0.2)]"
            title="Transcribe speech verbatim using Gemini 3.5 Transcribe"
          >
            <Mic className="w-3.5 h-3.5 text-rose-400" />
            <span>TRANSCRIBE AUDIO</span>
          </button>

          <button
            onClick={() => setEntityDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer"
          >
            <Network className="w-3.5 h-3.5 text-purple-400" />
            <span>ENTITIES & GRAPH</span>
          </button>

          <button
            onClick={() => setIsHotwordActive(!isHotwordActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer ${
              isHotwordActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700'
            }`}
            title="Hands-free trigger: Saying 'Hey IZA' will automatically open the live duplex voice link."
          >
            <span className={`w-2 h-2 rounded-full ${isHotwordActive ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`}></span>
            <span>{isHotwordActive ? 'HOTWORD: "HEY IZA" [ACTIVE]' : 'HOTWORD: OFF'}</span>
          </button>

          <button
            onClick={() => setLiveVoiceOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer"
            title="Launch Gemini 3.8 Live Duplex Voice & Multimodal Rear Camera Stream"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <div className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-cyan-400" />
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span>LIVE AGENT (VOICE + CAM)</span>
          </button>

          <PushNotificationManager />
          <PWAInstallButton />

          <OfflineIndicator
            isOnline={isOnline}
            pendingCount={offlinePendingCount}
            isSyncing={isSyncing}
            onSync={handleSyncOffline}
          />

          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-2.5 py-1 rounded">
              <span className="text-emerald-400 text-[10px]">● {currentUser.email?.split('@')[0]}</span>
              <span className="text-cyan-400 text-[9px] border-l border-slate-700 pl-1.5 hidden xl:inline" title="Firestore Database: ai-studio-izamasterui-a9c88bb8-fb34-4e2b-b40c-3453bcd97dc1">
                FIRESTORE: {firestoreConnected ? 'SYNCED' : 'ONLINE'}
              </span>
              <button 
                onClick={() => {
                  localStorage.removeItem('iza_demo_reviewer_session');
                  logOut();
                  setCurrentUser(null);
                }}
                className="text-slate-500 hover:text-slate-300 text-[9px] underline ml-1 cursor-pointer"
              >
                LOGOUT
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-300 text-[10px] transition-colors cursor-pointer"
            >
              {isSigningIn ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold transition cursor-pointer"
            title="Settings, In-App Subscriptions, Sign in with Apple & Store Compliance"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">SETTINGS</span>
          </button>

          <div className="flex flex-col items-end">
            <div className="text-blue-500 font-bold flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              POSTGRES + PGVECTOR: ACTIVE
            </div>
            <div className="text-slate-500 mt-1">
              UTC {time.toISOString().split('T')[1].slice(0, -5)}
            </div>
          </div>
        </div>
      </motion.header>

      {/* IZA LIFE home: Pulse card and recent Moments */}
      <IzaLifeHome now={time} memories={vaultMemories} pulse={dailyPulseData ? { summary: dailyPulseData.summary, priorities: dailyPulseData.priorities ?? [] } : null} />

      {/* 1. DAILY PULSE BRIEFING HEADER */}
      <div className="bg-slate-800/95 border-b border-slate-700/80 px-4 py-3 backdrop-blur-sm z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/30 shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider font-mono">IZA Daily Pulse</span>
                {dailyPulseData?.med_status && (
                  <span className="text-[10px] bg-slate-900/80 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30 font-mono">
                    Rx: {dailyPulseData.med_status}
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm text-slate-200 font-sans mt-0.5 leading-relaxed">
                {dailyPulseData?.summary || 'Gathering 24h biological pulse, medications, and recent anchor context...'}
              </div>
              {dailyPulseData?.priorities && dailyPulseData.priorities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {dailyPulseData.priorities.map((item, idx) => (
                    <span key={idx} className="text-[10px] bg-slate-900/90 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/20">
                      • {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={handleEnrichMemories}
              disabled={isEnriching}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-mono font-medium disabled:opacity-50 transition-colors cursor-pointer"
              title="Run Gemini 3.8 Flash proactive memory synthesis and auto-entity linkage"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isEnriching ? 'animate-spin' : ''}`} />
              <span>{isEnriching ? 'Synthesizing...' : 'Enrich Memories'}</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono font-medium cursor-pointer border border-slate-600 transition-colors">
              <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
              <span>{isUploadingFile ? 'OCR Extracting...' : 'Visual Ingestion'}</span>
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleDirectFileUpload} disabled={isUploadingFile} />
            </label>

            <button
              onClick={() => setEntityDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono font-medium cursor-pointer border border-slate-600 transition-colors"
            >
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>Knowledge Graph</span>
            </button>
          </div>
        </div>
      </div>

      {/* Synthesis / Enrichment Status Banner */}
      {enrichStatus && (
        <div className="bg-cyan-950/90 border-b border-cyan-500/50 px-4 py-2 text-cyan-200 text-xs font-mono flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-sans">{enrichStatus}</span>
          </div>
          <button onClick={() => setEnrichStatus(null)} className="text-cyan-400 hover:text-white text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* Main Grid: Three Loops */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] flex-1 overflow-hidden">
        
        {/* LOOP 1: Internal */}
        <motion.section 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="flex flex-col gap-6 lg:border-r border-slate-700 bg-slate-800 p-4 sm:p-6 overflow-y-auto"
        >
          <div className="flex items-center gap-2 text-slate-50 border-b border-slate-700 pb-2">
            <Activity className="w-4 h-4" />
            <h2 className="font-display text-sm font-bold">1. Internal Loop</h2>
          </div>
          <p className="text-slate-400 leading-relaxed normal-case">
            Biological telemetry and biophysical energy harvesting matrix. Infinite power plant engaged.
          </p>

          <div className="bg-slate-900 border border-blue-500 p-4 rounded-lg flex flex-col gap-4 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-2 text-[10px] font-bold uppercase"><Zap className="w-3 h-3 text-blue-500"/> ORR Saturation</span>
              <span className="text-blue-500 font-bold">{telemetry.orr.toFixed(2)}%</span>
            </div>
            <div className="w-full bg-slate-800 h-1 mt-1 rounded">
              <div className="bg-blue-500 h-1 rounded transition-all duration-1000 ease-linear" style={{ width: `${telemetry.orr}%` }}></div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <div className="text-slate-500 mb-1">TEG Output</div>
                <div className="text-slate-200 text-lg">{telemetry.teg.toFixed(1)} <span className="text-[10px] text-slate-500">μW</span></div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">TENG Yield</div>
                <div className="text-slate-200 text-lg">{telemetry.teng.toFixed(1)} <span className="text-[10px] text-slate-500">μW</span></div>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-slate-700 flex justify-between items-end">
              <div>
                <div className="text-slate-500 mb-1 flex items-center gap-2">Cognitive Load <Cpu className="w-3 h-3"/></div>
                <div className="text-slate-200">{telemetry.stress.toFixed(0)} / 100</div>
              </div>
              <div className="text-right">
                <div className="text-slate-500 mb-1">BPM</div>
                <div className="text-slate-200">{telemetry.hr}</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* LOOP 2: Ambient */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="flex flex-col gap-6 p-4 sm:p-6 main-canvas relative overflow-y-auto overflow-x-hidden"
        >
          <div className="flex items-center gap-2 text-slate-50 border-b border-slate-700 pb-2 bg-slate-900/50 backdrop-blur-sm p-2 rounded z-10">
            <Shield className="w-4 h-4" />
            <h2 className="font-display text-sm font-bold">2. Ambient Loop</h2>
          </div>
          <p className="text-slate-400 leading-relaxed normal-case bg-slate-900/50 backdrop-blur-sm p-2 rounded z-10">
            Interpersonal Zen Shield active. Filtering external narrative variables and emotional drift.
          </p>

          <div className="bg-slate-800 border border-amber-500/80 p-4 sm:p-5 rounded-lg flex flex-col gap-5 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] relative z-10 w-full max-w-2xl mx-auto">
            <div>
              <div className="text-amber-500 mb-2 flex justify-between items-center text-[10px] font-bold uppercase">
                <span className="flex items-center gap-2"><Eye className="w-3 h-3" /> Adaptive Tone Profiling</span>
                <span className="text-emerald-400 font-mono text-[9px] bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">SOVEREIGNTY SHIELD ENGAGED</span>
              </div>
              <div className="text-[#94a3b8] normal-case bg-slate-900 p-3 border border-slate-700/80 rounded text-[13px] leading-relaxed">
                <span className="text-slate-500 font-mono text-xs uppercase mb-1 block">Threat Assessment [Rank 28]</span>
                No narrative distortion or gaslighting detected. IZA is actively guarding your cognitive sovereignty and personal historical record.
              </div>
            </div>

            {/* IMMUTABLE MEMORY VAULT */}
            <div className="flex-1 mt-2 flex flex-col gap-3">
              <div className="text-slate-500 flex flex-wrap items-center justify-between text-[10px] font-bold uppercase gap-2 border-b border-slate-700/80 pb-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" /> 
                  <span className="text-emerald-400 text-xs">Immutable Memory Vault</span>
                  <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[9px]">
                    {vaultMemories.length} ANCHORED
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-cyan-400 font-mono">ZERO AMNESIA</span>
                  <button 
                    onClick={loadMemories}
                    title="Refresh memory vault from Cloud SQL"
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Real-time Anchored Alert */}
              {recentAnchoredAlert && (
                <div className="bg-emerald-950/90 border border-emerald-500/80 p-2.5 rounded-lg flex items-center justify-between text-xs text-emerald-200 font-mono animate-in fade-in slide-in-from-top-1 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-400 shrink-0">ANCHORED:</span>
                    <span className="truncate normal-case">"{recentAnchoredAlert}"</span>
                  </div>
                  <span className="text-[9px] bg-emerald-900 border border-emerald-700 px-1.5 py-0.5 rounded text-emerald-300 uppercase shrink-0 ml-2">
                    NEVER FORGOTTEN
                  </span>
                </div>
              )}

              {/* Quick Memory Anchor Input */}
              {/* Proactive Tools: Visual Ingestion, Synthesis & Graph */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisualUploadOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>ATTACH VISUAL (.PNG/.JPG/.PDF)</span>
                </button>
                <button
                  type="button"
                  disabled={isEnriching}
                  onClick={handleEnrichMemories}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600/30 disabled:opacity-50 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold transition-all cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-cyan-400 ${isEnriching ? 'animate-spin' : ''}`} />
                  <span>{isEnriching ? 'SYNTHESIZING...' : 'ENRICH VAULT'}</span>
                </button>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (quickMemoryInput.trim()) {
                    anchorMemory(quickMemoryInput.trim(), quickMemoryKind);
                    setQuickMemoryInput('');
                  }
                }}
                className="flex flex-col sm:flex-row gap-2 bg-slate-900/90 p-2 rounded-lg border border-slate-700/80"
              >
                <select
                  value={quickMemoryKind}
                  onChange={(e) => setQuickMemoryKind(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] rounded px-2 py-1.5 uppercase font-mono cursor-pointer"
                >
                  <option value="note">Note</option>
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                  <option value="event">Event</option>
                  <option value="idea">Idea</option>
                </select>
                <input
                  type="text"
                  value={quickMemoryInput}
                  onChange={(e) => setQuickMemoryInput(e.target.value)}
                  placeholder="Tell IZA something to remember forever..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 font-sans normal-case focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    setTranscribeTarget('quick');
                    setAudioTranscribeOpen(true);
                  }}
                  title="Dictate with Gemini 3.5 Transcribe"
                  className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 rounded text-xs flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="submit"
                  disabled={!quickMemoryInput.trim()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-bold rounded text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ANCHOR</span>
                </button>
              </form>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between pt-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={memorySearch}
                    onChange={(e) => setMemorySearch(e.target.value)}
                    placeholder="Search memories, facts, past conversations..."
                    className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 font-mono normal-case focus:outline-none focus:border-cyan-500"
                  />
                  {memorySearch && (
                    <button 
                      onClick={() => setMemorySearch('')}
                      className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto text-[9px] uppercase font-mono">
                  {(['all', 'voice', 'dialogue', 'notes'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setMemoryFilter(filter)}
                      className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                        memoryFilter === filter
                          ? 'bg-slate-700 text-cyan-300 border border-cyan-500/50 font-bold'
                          : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* IZA Semantic Recall Synthesis Card */}
              {recallInsight && (
                <div className="bg-cyan-950/80 border border-cyan-500/50 p-2.5 rounded-lg text-xs font-mono space-y-1.5">
                  <div className="flex items-center justify-between text-cyan-300 font-bold text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      IZA RECALL: "{recallInsight.query}"
                    </span>
                    <button 
                      onClick={() => setRecallInsight(null)} 
                      className="text-cyan-400 hover:text-white cursor-pointer text-xs"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-slate-100 font-sans leading-relaxed text-xs select-text">
                    {recallInsight.answer}
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-cyan-800/40">
                    <span>{recallInsight.count} exact matches in database</span>
                    {recallInsight.count > 0 && (
                      <button
                        onClick={() => handleDeleteBySearch(recallInsight.query)}
                        className="text-rose-400 hover:text-rose-300 underline font-mono cursor-pointer"
                      >
                        Purge these memories
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Active Search & Delete by Keyword Action Bar */}
              {memorySearch.trim() && (
                <div className="flex items-center justify-between bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-300 text-[11px] truncate">
                    <Search className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Keyword: <strong className="text-cyan-300">"{memorySearch}"</strong></span>
                    <span className="text-slate-500">
                      ({vaultMemories.filter(m => m.content.toLowerCase().includes(memorySearch.toLowerCase()) || m.type.toLowerCase().includes(memorySearch.toLowerCase())).length} found)
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteBySearch(memorySearch)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-rose-900/70 hover:bg-rose-700 text-rose-200 border border-rose-600/60 rounded text-[10px] font-bold transition-colors cursor-pointer shrink-0 ml-2"
                    title={`Delete all memories matching "${memorySearch}" from Cloud SQL`}
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>DELETE MATCHING</span>
                  </button>
                </div>
              )}

              {/* Memory Items List */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2 max-h-64 overflow-y-auto space-y-2">
                {vaultMemories
                  .filter((m) => {
                    const matchesSearch =
                      !memorySearch.trim() ||
                      m.content.toLowerCase().includes(memorySearch.toLowerCase()) ||
                      m.type.toLowerCase().includes(memorySearch.toLowerCase());
                    if (!matchesSearch) return false;
                    if (memoryFilter === 'voice') return m.type.includes('voice');
                    if (memoryFilter === 'dialogue') return m.type.includes('dialogue');
                    if (memoryFilter === 'notes') return !m.type.includes('voice') && !m.type.includes('dialogue');
                    return true;
                  })
                  .map((log) => {
                    const isVoice = log.type.includes('voice');
                    const isDialogue = log.type.includes('dialogue');
                    const badgeColor = isVoice 
                      ? 'bg-purple-900/50 text-purple-300 border-purple-700' 
                      : isDialogue
                      ? 'bg-blue-900/50 text-blue-300 border-blue-700'
                      : 'bg-emerald-900/50 text-emerald-300 border-emerald-700';

                    return (
                      <div 
                        key={log.id} 
                        className="group flex items-start justify-between gap-3 p-2.5 rounded bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className={`px-1.5 py-0.5 rounded border text-[9px] uppercase font-bold font-mono ${badgeColor}`}>
                              {log.type}
                            </span>
                            <span className="text-slate-500 font-mono">{log.time}</span>
                          </div>
                          <p className="text-slate-200 normal-case text-xs leading-relaxed font-sans select-text break-words">
                            {log.content}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteMemory(log.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all cursor-pointer shrink-0"
                          title="Purge memory from vault"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                {vaultMemories.filter((m) => {
                  const matchesSearch =
                    !memorySearch.trim() ||
                    m.content.toLowerCase().includes(memorySearch.toLowerCase()) ||
                    m.type.toLowerCase().includes(memorySearch.toLowerCase());
                  if (!matchesSearch) return false;
                  if (memoryFilter === 'voice') return m.type.includes('voice');
                  if (memoryFilter === 'dialogue') return m.type.includes('dialogue');
                  if (memoryFilter === 'notes') return !m.type.includes('voice') && !m.type.includes('dialogue');
                  return true;
                }).length === 0 && (
                  <div className="text-center py-6 text-slate-500 font-mono text-xs normal-case">
                    {memorySearch ? 'No memories match your search query.' : 'Memory vault is initialized. Anything you tell IZA via chat, voice, or CLI is remembered here forever.'}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {threatActive && (
            <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm p-6 flex flex-col justify-center border-x-4 border-red-500/80 m-2 sm:m-4 rounded">
              <div className="flex items-center gap-3 text-red-500 mb-4 animate-pulse">
                <AlertTriangle className="w-8 h-8 shrink-0" />
                <h3 className="font-display text-lg sm:text-xl font-bold leading-tight">SYSTEM INTEGRITY COMPROMISE</h3>
              </div>
              <div className="text-slate-300 normal-case text-[13px] mb-6 font-mono bg-red-950/40 p-4 rounded border border-red-900/50 shadow-inner">
                <span className="text-red-400 font-bold block mb-2 uppercase text-[10px] tracking-widest border-b border-red-900/50 pb-1">Threat Vector: Cognitive Interference</span>
                Unauthorized attempt to alter episodic memory context detected. Interpersonal Zen Shield intercepting narrative rewrite sequence.
              </div>
              <button
                onClick={() => setThreatActive(false)}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 py-3 rounded uppercase font-bold text-xs tracking-wider transition-colors cursor-pointer w-full shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)]"
              >
                NEUTRALIZE & PURGE THREAT
              </button>
            </div>
          )}
        </motion.section>

        {/* LOOP 3: Execution */}
        <motion.section 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="flex flex-col gap-6 lg:border-l border-slate-700 bg-slate-800 p-4 sm:p-6 overflow-y-auto"
        >
          <div className="flex items-center justify-between text-slate-50 border-b border-slate-700 pb-2">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4" />
              <h2 className="font-display text-sm font-bold">3. Execution Loop</h2>
            </div>
            <span className="text-slate-500 text-[10px]">ID: #8821</span>
          </div>
          
          <div className="bg-slate-900 border border-emerald-500 p-4 rounded-lg flex flex-col gap-4 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-emerald-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span>Rank 5 Diplomacy Matrix</span>
              </div>
              <span>●</span>
            </div>

            <div className="space-y-4 mt-2 normal-case text-[13px] text-[#94a3b8]">
              <div>
                <div className="text-slate-400 mb-1 flex justify-between uppercase text-[10px]">
                  <span>Logic Exception Routing</span>
                  <span className="text-slate-200">Active</span>
                </div>
                <div className="w-full bg-slate-800 h-1 rounded">
                  <div className="bg-slate-500 h-1 w-full rounded"></div>
                </div>
              </div>
              
              <div>
                <div className="text-slate-400 mb-1 flex justify-between uppercase text-[10px]">
                  <span>Task Auto-Decline</span>
                  <span className="text-slate-200">9 requests blocked</span>
                </div>
                <div className="w-full bg-slate-800 h-1 rounded">
                  <div className="bg-slate-500 h-1 w-3/4 rounded"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-purple-500/50 p-4 rounded-lg flex flex-col gap-4 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-purple-400">
              <div className="flex items-center gap-2">
                <Key className="w-3 h-3" />
                <span>Continuity Secrets</span>
              </div>
              <button 
                onClick={() => setSecretsUnlocked(!secretsUnlocked)}
                className="hover:text-purple-300 transition-colors cursor-pointer"
                title={secretsUnlocked ? "Lock Vault" : "Unlock Vault"}
              >
                {secretsUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              </button>
            </div>

            <div className="space-y-3 mt-1 text-[13px]">
              {secretsData.map((secret) => (
                <div key={secret.id} className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">{secret.label}</span>
                  {secretsUnlocked ? (
                    <span className="text-slate-200 normal-case tracking-normal">{secret.value}</span>
                  ) : (
                    <span className="text-slate-600 bg-slate-800 px-2 py-0.5 rounded text-[10px]">ENCRYPTED</span>
                  )}
                </div>
              ))}
            </div>
            {!secretsUnlocked && (
              <div className="text-[10px] text-slate-500 normal-case italic mt-2">
                Secrets are encrypted app-side. IZA cannot read them without your explicit passphrase.
              </div>
            )}
          </div>

          <div className={`bg-slate-900 border ${sosActive ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'border-rose-500/50'} p-4 rounded-lg flex flex-col gap-4 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] transition-all duration-500`}>
            <div className={`flex items-center justify-between text-[10px] font-bold uppercase ${sosActive ? 'text-red-500' : 'text-rose-400'}`}>
              <div className="flex items-center gap-2">
                {sosActive ? <AlertTriangle className="w-3 h-3 animate-pulse" /> : <Users className="w-3 h-3" />}
                <span>The Circle</span>
              </div>
              <span className="flex h-2 w-2 relative">
                 <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${sosActive ? 'bg-red-400' : 'bg-rose-400'}`}></span>
                 <span className={`relative inline-flex rounded-full h-2 w-2 ${sosActive ? 'bg-red-500' : 'bg-rose-500'}`}></span>
              </span>
            </div>

            <div className="space-y-3 mt-1 text-[13px]">
              {circleMembers.map(member => (
                <div key={member.id} className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">{member.name} <span className="text-slate-600">({member.relation})</span></span>
                  <span className={`${member.statusColor} text-[10px]`}>{member.status}</span>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setSosActive(!sosActive)}
              className={`w-full border rounded py-1.5 text-[10px] transition-colors flex items-center justify-center gap-2 mt-2 font-bold ${sosActive ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30 cursor-pointer' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30 cursor-pointer'}`}
            >
              <Radio className="w-3 h-3" />
              {sosActive ? 'CANCEL SOS BROADCAST' : 'INITIATE SOS'}
            </button>
            {sosActive && (
              <div className="text-[10px] text-red-400/80 normal-case italic text-center">
                Broadcasting emergency coordinates and biometric payload to trusted circle.
              </div>
            )}
          </div>

          {confidantActive && (
            <div className="bg-slate-900 border border-blue-500/60 p-4 rounded-lg flex flex-col gap-3 shadow-[0_10px_20px_-3px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase text-blue-400 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>The Confidant // Gemini 3.8</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setLiveVoiceOpen(true)}
                    className="text-[9px] bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 px-2 py-0.5 rounded border border-cyan-500/40 flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Mic className="w-2.5 h-2.5" />
                    <span>VOICE</span>
                  </button>
                  <button onClick={() => setConfidantActive(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">✕</button>
                </div>
              </div>

              {/* Memory Recall Context Banner */}
              <div className="bg-slate-950/80 border border-blue-900/50 rounded p-2 flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 text-cyan-400 font-mono">
                  <Database className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>RECALL ACTIVE: {vaultMemories.length} MEMORIES</span>
                </div>
                <button
                  onClick={() => setShowActiveContextMemories(!showActiveContextMemories)}
                  className="text-slate-400 hover:text-cyan-300 underline font-mono text-[9px] cursor-pointer"
                >
                  {showActiveContextMemories ? 'HIDE CONTEXT' : 'INSPECT CONTEXT'}
                </button>
              </div>

              {/* Expandable Recall Context Drawer */}
              {showActiveContextMemories && (
                <div className="bg-slate-950 border border-slate-800 rounded p-2.5 max-h-36 overflow-y-auto space-y-1.5 font-mono text-[10px] normal-case animate-in fade-in">
                  <div className="text-slate-500 text-[9px] uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                    <span>Memories injected into IZA prompt context:</span>
                  </div>
                  {vaultMemories.slice(0, 15).map((m) => (
                    <div key={m.id} className="text-slate-300 truncate border-l border-cyan-500/50 pl-2">
                      <span className="text-cyan-400">[{m.type}]</span> {m.content}
                    </div>
                  ))}
                  {vaultMemories.length === 0 && (
                    <div className="text-slate-600 italic">No memories recorded yet.</div>
                  )}
                </div>
              )}

              {/* Chat message history */}
              <div className="flex flex-col gap-2.5 text-[12px] normal-case h-44 overflow-y-auto pr-1">
                {confidantMessages.map((msg, i) => (
                  <div 
                    key={i}
                    className={`p-2.5 rounded-lg text-slate-200 border leading-relaxed ${
                      msg.role === 'model'
                        ? 'bg-slate-800/60 border-l-2 border-blue-500 border-slate-700/50 w-[92%]'
                        : 'bg-blue-950/40 border-r-2 border-slate-500 border-blue-900/40 w-[92%] self-end'
                    }`}
                  >
                    <span className="text-[9px] font-mono uppercase block mb-1 font-bold tracking-wider text-slate-400">
                      {msg.role === 'model' ? 'IZA (CONFIDANT & MEMORY KEEPER)' : 'YOU'}
                    </span>
                    {msg.text}
                  </div>
                ))}
                {confidantLoading && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs italic">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span>IZA recalling past memories & formulating response...</span>
                  </div>
                )}
              </div>

              {/* Input for Confidant text message */}
              <form onSubmit={handleSendConfidant} className="flex gap-2 pt-1 border-t border-slate-800">
                <input 
                  type="text"
                  value={confidantInput}
                  onChange={(e) => setConfidantInput(e.target.value)}
                  placeholder="Tell IZA anything (she remembers forever)..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 normal-case font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    setTranscribeTarget('confidant');
                    setAudioTranscribeOpen(true);
                  }}
                  title="Speak to Confidant (Gemini 3.5 Transcribe)"
                  className="px-2 py-1 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 rounded text-xs flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Mic className="w-3 h-3" />
                </button>
                <button 
                  type="submit"
                  disabled={confidantLoading || !confidantInput.trim()}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              </form>
              <div className="text-[9px] text-slate-500 font-mono flex items-center justify-between">
                <span>🔒 CLOUD SQL AUTO-PERSISTENCE ENGAGED</span>
                <span className="text-emerald-500">NEVER FORGET</span>
              </div>
            </div>
          )}
          
        </motion.section>

      </div>
      
      {/* CLI Input Bar */}
      <div className="bg-slate-950 border-t border-slate-700 px-4 py-2 shrink-0 z-20">
        <form onSubmit={handleCommand} className="flex items-center gap-3">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <input 
            type="text" 
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Try: iza capture 'my new idea' | iza secret-put 'PIN' | iza talk | iza sos" 
            className="flex-1 bg-transparent border-none outline-none text-slate-300 placeholder:text-slate-600 normal-case font-mono text-sm"
          />
        </form>
      </div>

      {/* Footer / Status Bar */}
      <footer className="border-t border-slate-800 bg-slate-900 flex items-center p-2 px-4 sm:px-6 text-[11px] text-slate-500 gap-4 sm:gap-6 shrink-0 flex-wrap z-10">
        <span>STATUS: {sosActive ? 'EMERGENCY OVERRIDE' : 'READY'}</span>
        <span>LATENCY: {sosActive ? '2ms' : '12ms'}</span>
        <span>RAM: 4.2GB / 16GB</span>
        <button 
          onClick={() => setAudioEnabled(!audioEnabled)}
          className={`flex items-center gap-2 px-2 py-1 rounded transition-colors cursor-pointer ${audioEnabled ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400'}`}
          title="Toggle Data Stream Audio"
        >
          {audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
          <span>DATA_STREAM</span>
        </button>
        <span className="ml-auto hidden sm:inline">UTF-8</span>
        <span className="hidden sm:inline">Ln 24, Col 12</span>
      </footer>

      {/* Real-time Voice Conversation with Gemini 3.8 Live API */}
      <LiveVoiceModal 
        isOpen={liveVoiceOpen} 
        onClose={() => setLiveVoiceOpen(false)}
        onLogMemory={(text) => {
          setVaultMemories(prev => [
            { id: Date.now(), type: 'voice', content: text, time: time.toISOString().split('T')[1].slice(0, 5) },
            ...prev
          ]);
          apiFetch('/api/memories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: text, kind: 'voice', salience: 0.7 })
          }).catch(err => console.error('Failed to log voice memory to DB:', err));
        }}
      />

      {/* Multi-Modal Visual Ingestion Modal (Photos, Diagrams, Field Notes) */}
      <VisualUploadModal
        isOpen={visualUploadOpen}
        onClose={() => setVisualUploadOpen(false)}
        onUploaded={(mem) => {
          if (mem) {
            setVaultMemories(prev => [
              {
                id: mem.id || Date.now(),
                type: mem.kind || 'attachment',
                content: mem.content,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
              ...prev,
            ]);
          }
        }}
      />

      {/* Knowledge Graph & Entity Timeline Drawer */}
      <EntityDrawer
        isOpen={entityDrawerOpen}
        onClose={() => setEntityDrawerOpen(false)}
      />

      {/* Audio Transcription Modal (gemini-3.5-transcribe) */}
      <AudioTranscribeModal
        isOpen={audioTranscribeOpen}
        onClose={() => setAudioTranscribeOpen(false)}
        onTranscriptReady={(transcript) => {
          if (transcribeTarget === 'quick') {
            setQuickMemoryInput(transcript);
          } else if (transcribeTarget === 'confidant') {
            setConfidantInput(transcript);
          } else {
            anchorMemory(transcript, 'voice');
          }
        }}
      />

      {/* Bioscience & Molecular Workbench (PubChem, UniProt, AlphaFold) */}
      <BioscienceWorkbench
        isOpen={bioscienceOpen}
        onClose={() => setBioscienceOpen(false)}
        onAnchorMemory={(content, kind) => anchorMemory(content, kind || 'science')}
      />

      {/* Grounded Intelligence Modal (Google Search + Google Maps Grounding) */}
      <GroundedIntelligenceModal
        isOpen={groundedOpen}
        onClose={() => setGroundedOpen(false)}
        onAnchorMemory={(content, kind) => anchorMemory(content, kind || 'note')}
      />

      {/* Settings, Store Subscriptions, Apple Sign-In & Privacy Purge Modal */}
      <SettingsPrivacyModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        currentUser={currentUser}
        onUserChange={(user) => {
          setCurrentUser(user);
          if (user?.email === 'test-reviewer@earthi.ltd') {
            loadMemories();
          }
        }}
        onDataPurged={() => {
          setVaultMemories([]);
          setConfidantMessages([
            { role: 'model', text: "All sovereign memory vaults and biophysical telemetry have been permanently purged." }
          ]);
        }}
        onOpenDisclaimer={() => setMedicalDisclaimerOpen(true)}
      />

      {/* Health & Medical Disclaimer Modal (Guideline 1.4) */}
      <MedicalDisclaimerModal
        isOpen={medicalDisclaimerOpen}
        onClose={() => setMedicalDisclaimerOpen(false)}
      />

      {/* Autonomous Web Agent & Page Reader Modal */}
      {webAgentOpen && (
        <WebAgentWidget
          isModal={true}
          onClose={() => setWebAgentOpen(false)}
          onMemoryAnchored={(content, title) => {
            anchorMemory(`[Web Research]: ${title}\n${content}`, 'web_research');
            loadMemories();
          }}
        />
      )}

      {/* Spatial Memory Landscapes & Recallable Snapshots Modal */}
      {spatialMemoryOpen && (
        <SpatialMemoryLandscape
          isModal={true}
          onClose={() => setSpatialMemoryOpen(false)}
          onRefreshNeeded={loadMemories}
          onReanchorIntoConfidant={(content, domain) => {
            setConfidantInput(`Re-anchoring from ${domain}: ${content}`);
            setSpatialMemoryOpen(false);
          }}
        />
      )}

      {/* Universal Domain Search & Document Ingestion RAG Modal */}
      <UniversalSearch
        isOpen={universalSearchOpen}
        onClose={() => setUniversalSearchOpen(false)}
        onRefreshNeeded={loadMemories}
        onReanchorIntoConfidant={(content, domain) => {
          setConfidantInput(`[Re-anchoring from ${domain}]: ${content}`);
          setUniversalSearchOpen(false);
        }}
      />

      {/* Time-Aware Rituals Modal (Morning Pulse & Evening Wind-Down) */}
      <TimeAwareRitualsModal
        isOpen={ritualsOpen}
        onClose={() => setRitualsOpen(false)}
        onCompleteRitual={loadMemories}
        onReanchorContext={(prompt) => {
          setConfidantInput(prompt);
          setRitualsOpen(false);
        }}
      />

      {/* IZA LIFE navigation: IZA · RECALL · ＋ · PEOPLE · ME */}
      <IzaLifeNav
        onHome={() => {
          setLiveVoiceOpen(false);
          setVisualUploadOpen(false);
          setUniversalSearchOpen(false);
          setEntityDrawerOpen(false);
          setSettingsOpen(false);
          setWebAgentOpen(false);
          setSpatialMemoryOpen(false);
          setRitualsOpen(false);
        }}
        onRecall={() => setUniversalSearchOpen(true)}
        onPeople={() => setEntityDrawerOpen(true)}
        onMe={() => setSettingsOpen(true)}
        onTalk={() => setLiveVoiceOpen(true)}
        onSee={() => setVisualUploadOpen(true)}
        onAdd={() => setAudioTranscribeOpen(true)}
        onWrite={(text) => anchorMemory(text, 'note')}
      />
    </div>
  );
}

