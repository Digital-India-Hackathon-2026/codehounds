import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle, ShieldAlert, Activity, Volume2, Info, EyeOff } from 'lucide-react';
import { WS_URL } from '../lib/api';

type PermissionState = 'idle' | 'prompting' | 'granted' | 'denied';

export default function LiveMonitor() {
  const [permissionState, setPermissionState] = useState<PermissionState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [scamType, setScamType] = useState('Awaiting Input...');
  const [indicators, setIndicators] = useState<any[]>([]);
  const [transcripts, setTranscripts] = useState<any[]>([]);

  // Ref version of isRecording so closures always see the latest value
  const isRecordingRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsTabHidden(hidden);
      if (hidden && isRecordingRef.current) {
        stopMonitoring(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopMonitoring(false);
    };
  }, []);

  const addTranscript = (role: string, text: string, risk: number = 0) => {
    setTranscripts(prev => [...prev, {
      role,
      text,
      risk,
      time: new Date().toLocaleTimeString('en-US', { hour12: false })
    }]);
  };

  const requestPermission = async () => {
    setPermissionState('prompting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setPermissionState('granted');
    } catch {
      setPermissionState('denied');
    }
  };

  // Core recording cycle — uses ref so it never sees stale state
  const runCycle = (stream: MediaStream) => {
    if (!isRecordingRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      if (chunks.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        const blob = new Blob(chunks, { type: mimeType });
        blob.arrayBuffer().then(buf => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(buf);
          }
        });
      }
      // Chain next cycle only if still recording (ref is always current)
      if (isRecordingRef.current) {
        runCycle(stream);
      }
    };

    recorder.start();

    cycleTimeoutRef.current = setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, 4000);
  };

  const startMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;

      isRecordingRef.current = true;
      setIsRecording(true);
      setRiskScore(0);
      setScamType('Listening...');
      setIndicators([]);
      setTranscripts([]);
      addTranscript('SYSTEM', 'Microphone open. Streaming 4-second audio chunks to analysis pipeline...');

      const token = localStorage.getItem('access_token');
      const url = token ? `${WS_URL}?token=${token}` : WS_URL;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.transcript?.trim()) {
            addTranscript('CALLER', data.transcript, data.risk_score / 100);
            setRiskScore(data.risk_score / 100);
            setScamType(data.scam_type || 'Suspicious Pattern');
            setIndicators(data.indicators || []);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => addTranscript('SYSTEM', 'WebSocket disconnected.');
      ws.onerror = () => addTranscript('SYSTEM', 'WebSocket connection error. Is the backend running?');

      ws.onopen = () => runCycle(stream);

    } catch {
      setPermissionState('denied');
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const stopMonitoring = (pausedByTab = false) => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (cycleTimeoutRef.current) clearTimeout(cycleTimeoutRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const msg = pausedByTab
      ? 'Capture PAUSED — tab moved to background. Return and restart.'
      : 'Ambient capture stopped by user.';
    addTranscript('SYSTEM', msg);
  };

  const toggleMonitoring = () => {
    if (isRecording) {
      stopMonitoring(false);
    } else {
      startMonitoring();
    }
  };

  // Render permission gate
  if (permissionState === 'idle' || permissionState === 'prompting') {
    return (
      <main className="max-w-2xl mx-auto py-16 px-6 text-center">
        <div className="bg-matte-black border border-border-subtle rounded-3xl p-8 backdrop-blur-xl">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
            <Volume2 className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-4">Speaker Mode Ambient Monitor</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-6">
            This module activates the device's microphone to analyze audio transcripts for financial scams in real-time. 
            Ideal for placing a speakerphone call next to your system.
          </p>
          <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex gap-3 text-left mb-8">
            <Info className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
            <span className="text-xs text-secondary leading-normal">
              <strong>Explicit Privacy Sandbox Boundary:</strong> Web browsers cannot directly capture cellular calls on your device. 
              This interface uses standard microphone capture to scan external speakerphone sound waves.
            </span>
          </div>
          <button
            onClick={requestPermission}
            className="w-full py-3 bg-white text-black rounded-xl font-bold font-mono tracking-wider hover:bg-white/90 transition-all uppercase"
          >
            {permissionState === 'prompting' ? 'Requesting Browser Mic Access...' : 'Enable Microphone'}
          </button>
        </div>
      </main>
    );
  }

  if (permissionState === 'denied') {
    return (
      <main className="max-w-2xl mx-auto py-16 px-6 text-center">
        <div className="bg-matte-black border border-error/20 rounded-3xl p-8 backdrop-blur-xl">
          <div className="w-16 h-16 bg-error/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-error/20">
            <MicOff className="w-8 h-8 text-error" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-4">Microphone Access Blocked</h1>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-8">
            SentinelX requires microphone input to analyze call transcript patterns. 
            Please open your browser settings, allow microphone permissions for this site, and reload the application.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-transparent border border-white/20 text-white rounded-xl font-bold font-mono tracking-wider hover:border-white transition-all uppercase"
          >
            Reload Tab
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col gap-6">
      {/* Danger Banner Alert */}
      {riskScore > 0.8 && (
        <div className="bg-error/10 border border-error/30 text-error px-6 py-4 rounded-2xl flex items-center gap-4 animate-bounce">
          <ShieldAlert className="w-6 h-6 flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <span className="font-bold text-sm">CRITICAL THREAT EVENT:</span>
            <span className="text-xs ml-2">Algorithmic risk evaluation is high ({ (riskScore * 100).toFixed(0) }%). Suspicious behavior matching "{ scamType }" is present. Take immediate precautions.</span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 flex gap-6">
        {/* Left Side: Capturing Console */}
        <div className="flex-1 flex flex-col gap-6">
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Speaker Mode monitor</h1>
              <p className="text-secondary font-mono text-xs flex items-center gap-2">
                {isRecording ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-primary font-bold">AMBIENT MONITOR ACTIVE</span>
                  </>
                ) : isTabHidden ? (
                  <>
                    <EyeOff className="w-4 h-4 text-warning" />
                    <span className="text-warning">PAUSED: TAB BACKGROUNDED</span>
                  </>
                ) : (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                    <span>MONITOR IDLE</span>
                  </>
                )}
              </p>
            </div>
            
            <button
              onClick={toggleMonitoring}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold font-mono tracking-wider transition-all border ${
                isRecording
                  ? 'bg-transparent border-white/20 text-white hover:bg-white/5 hover:border-white'
                  : 'bg-white text-black border-transparent hover:bg-white/90'
              }`}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>STOP MONITORING</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <span>START MONITORING</span>
                </>
              )}
            </button>
          </header>

          {/* Transcript Panel */}
          <div className="glass-panel flex-1 p-6 flex flex-col min-h-0">
            <div className="flex items-center gap-2.5 mb-6 border-b border-white/10 pb-4">
              <Activity className="w-4 h-4 text-secondary" />
              <h2 className="font-mono text-xs tracking-widest text-secondary font-bold">SPEAKER TRANSCRIPT PIPELINE</h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {transcripts.length === 0 && (
                <div className="h-full flex items-center justify-center text-on-surface-variant font-mono text-xs">
                  Press Start to begin capturing audio.
                </div>
              )}
              {transcripts.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.role === 'SYSTEM' ? 'items-center' : 'items-start'}`}>
                  {msg.role !== 'SYSTEM' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-[9px] text-on-surface-variant">{msg.time}</span>
                      <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-silver-gray font-bold`}>
                        {msg.role}
                      </span>
                    </div>
                  )}
                  <div className={`p-4 max-w-[85%] rounded-2xl ${
                    msg.role === 'SYSTEM'
                      ? 'bg-transparent border border-border-subtle rounded-md text-on-surface-variant text-xs font-mono text-center p-3'
                      : `bg-charcoal border ${msg.risk > 0.8 ? 'border-error/40 shadow-[inset_0_1px_0_rgba(255,180,171,0.05)]' : 'border-border-subtle'} rounded-tl-none text-primary`
                  }`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Risk & Indicators Panel */}
        <div className="w-80 flex flex-col gap-6">
          {/* Gauge card */}
          <div className={`glass-panel p-6 flex flex-col items-center justify-center ${
            riskScore > 0.8 ? 'bg-error/5 border-error/30' : ''
          }`}>
            <h3 className="font-mono text-xs tracking-widest text-secondary mb-8">THREAT METRIC</h3>
            
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle cx="88" cy="88" r="76" stroke="rgba(255,255,255,0.03)" strokeWidth="10" fill="none" />
                <circle 
                  cx="88" cy="88" r="76" 
                  stroke={riskScore > 0.8 ? '#ffb4ab' : '#ffffff'} 
                  strokeWidth="10" fill="none" 
                  strokeDasharray="477.5" 
                  strokeDashoffset={477.5 - (477.5 * riskScore)} 
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out animate-pulse"
                />
              </svg>
              <div className="text-center z-10">
                <div className={`text-4xl font-bold font-mono tracking-tighter ${riskScore > 0.8 ? 'text-error' : 'text-primary'}`}>
                  { (riskScore * 100).toFixed(0) }<span className="text-xl">%</span>
                </div>
                <div className="text-[10px] text-secondary mt-1 font-mono">RISK ESTIMATE</div>
              </div>
            </div>

            <div className="mt-6 w-full text-center">
              <p className="text-xs font-semibold text-primary">{scamType}</p>
            </div>
          </div>

          {/* Indicators list */}
          <div className="glass-panel p-6 flex-1 min-h-0 flex flex-col">
            <h3 className="font-mono text-xs tracking-widest text-secondary mb-4 flex items-center gap-2 border-b border-white/5 pb-3">
              <AlertCircle className="w-3.5 h-3.5" /> INTERCEPTED VECTORS
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {indicators.length === 0 && (
                <p className="text-xs text-on-surface-variant font-mono text-center mt-6">
                  No vectors registered.
                </p>
              )}
              {indicators.map((ind, i) => (
                <div key={i} className="p-3 bg-charcoal border border-border-subtle rounded-xl flex items-center justify-between">
                  <span className="text-xs text-primary font-semibold">
                    {ind.type || ind.indicator_name || "Pattern Detected"}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-error shadow-[0_0_8px_#ffb4ab]"></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
