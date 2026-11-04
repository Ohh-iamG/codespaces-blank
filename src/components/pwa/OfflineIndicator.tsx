import React from 'react';
import { Wifi, WifiOff, RefreshCw, HardDrive, ShieldCheck } from 'lucide-react';

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount?: number;
  isSyncing?: boolean;
  onSync?: () => void;
}

export function OfflineIndicator({
  isOnline,
  pendingCount = 0,
  isSyncing = false,
  onSync,
}: OfflineIndicatorProps) {
  if (isOnline && pendingCount === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-lg">
        <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span className="hidden sm:inline">ONLINE •</span>
        <span>VAULT CONNECTED</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-amber-300 bg-amber-950/70 border border-amber-500/50 rounded-lg shadow-lg animate-pulse">
        <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <div className="flex items-center gap-2">
          <span className="font-semibold">OFFLINE SHELL ACTIVE</span>
          <span className="text-[11px] text-amber-400/80 hidden md:inline">
            (Instant cache & local vault preserving state)
          </span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 border border-amber-500/40 rounded text-amber-200">
              {pendingCount} unsynced
            </span>
          )}
        </div>
      </div>
    );
  }

  // Back online with pending local entries
  return (
    <div className="flex items-center gap-2 px-3 py-1 text-xs font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-500/50 rounded-lg shadow-sm">
      <HardDrive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      <span>{pendingCount} offline items pending</span>
      {onSync && (
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 rounded transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      )}
    </div>
  );
}
