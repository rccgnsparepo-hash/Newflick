import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, RotateCcw, X, Check, AlertOctagon, Wifi, Activity, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerVibration } from '../lib/haptics';

export type TaskType = 
  | 'post creation'
  | 'image upload'
  | 'video upload'
  | 'comment submit'
  | 'profile update'
  | 'avatar upload'
  | 'chat send'
  | 'file transfer'
  | 'notification sync'
  | 'feed sync'
  | 'cache refresh';

export type OperationState =
  | 'QUEUED'
  | 'STARTING'
  | 'CONNECTING'
  | 'UPLOADING'
  | 'SERVER ACKNOWLEDGED'
  | 'FINALIZING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRYING';

export interface OperationTask {
  id: string;
  type: TaskType;
  label: string;
  state: OperationState;
  progress: number; // 0 to 100
  speed?: string;
  bytesUploaded?: number;
  totalBytes?: number;
  eta?: number; // remaining seconds
  startedAt: number;
  updatedAt: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  onCancel?: () => void;
  onRetry?: () => Promise<void> | void;
}

export interface NetworkMetrics {
  ping: number; // ms
  status: 'FAST' | 'NORMAL' | 'SLOW' | 'BAD' | 'OFFLINE';
  uploadSpeed?: string;
}

interface OperationContextType {
  tasks: OperationTask[];
  networkMetrics: NetworkMetrics;
  createTask: (type: TaskType, label: string, options?: Partial<Pick<OperationTask, 'maxRetries' | 'onCancel' | 'onRetry' | 'totalBytes'>>) => string;
  updateTask: (id: string, updates: Partial<Omit<OperationTask, 'id'>>) => void;
  failTask: (id: string, reason: string) => void;
  successTask: (id: string) => void;
  removeTask: (id: string) => void;
  retryTask: (id: string) => Promise<void>;
  simulateTaskProgress: (id: string, durationMs?: number, stepDurationMs?: number) => Promise<void>;
  isTaskMonitorEnabled: boolean;
  setIsTaskMonitorEnabled: (val: boolean) => void;
}

const OperationContext = createContext<OperationContextType | undefined>(undefined);

export function useOperations() {
  const context = useContext(OperationContext);
  if (!context) {
    throw new Error('useOperations must be used within an OperationProvider');
  }
  return context;
}

export const OperationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<OperationTask[]>([]);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics>({ ping: 45, status: 'FAST' });
  const [isMonitorExpanded, setIsMonitorExpanded] = useState(true);
  const [isTaskMonitorEnabled, setIsTaskMonitorEnabled] = useState(() => {
    return localStorage.getItem('flick_show_task_monitor') === 'true';
  });

  const handleSetTaskMonitorEnabled = (val: boolean) => {
    setIsTaskMonitorEnabled(val);
    localStorage.setItem('flick_show_task_monitor', val ? 'true' : 'false');
  };

  // Auto-dismiss completed/failed tasks (disappear itself after a few seconds)
  useEffect(() => {
    const timeouts: { [key: string]: NodeJS.Timeout } = {};

    tasks.forEach(task => {
      if (task.state === 'SUCCESS') {
        timeouts[task.id] = setTimeout(() => {
          removeTask(task.id);
        }, 1500); // SUCCESS disappears after 1.5 seconds
      } else if (task.state === 'FAILED') {
        timeouts[task.id] = setTimeout(() => {
          removeTask(task.id);
        }, 3000); // FAILED disappears after 3 seconds
      }
    });

    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, [tasks]);

  // Measure network latency dynamically
  useEffect(() => {
    let active = true;
    const measurePing = async () => {
      if (!navigator.onLine) {
        if (active) setNetworkMetrics({ ping: 9999, status: 'OFFLINE' });
        return;
      }
      const start = performance.now();
      try {
        // Fetch a tiny resources or do a lightweight ping request
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
        const latency = Math.round(performance.now() - start);
        let status: NetworkMetrics['status'] = 'FAST';
        if (latency < 100) status = 'FAST';
        else if (latency < 300) status = 'NORMAL';
        else if (latency < 1000) status = 'SLOW';
        else status = 'BAD';

        if (active) {
          setNetworkMetrics({
            ping: latency,
            status,
            uploadSpeed: status === 'FAST' ? '8.4 MB/s' : status === 'NORMAL' ? '4.2 MB/s' : '820 KB/s'
          });
        }
      } catch (err) {
        // Fallback or offline
        if (active) {
          setNetworkMetrics({ ping: 1200, status: 'BAD' });
        }
      }
    };

    measurePing();
    const interval = setInterval(measurePing, 15000); // Poll latency every 15s

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const createTask = (
    type: TaskType,
    label: string,
    options?: Partial<Pick<OperationTask, 'maxRetries' | 'onCancel' | 'onRetry' | 'totalBytes'>>
  ): string => {
    const id = 'task_' + Math.random().toString(36).substring(2, 9);
    const newTask: OperationTask = {
      id,
      type,
      label,
      state: 'QUEUED',
      progress: 0,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? 3,
      totalBytes: options?.totalBytes,
      onCancel: options?.onCancel,
      onRetry: options?.onRetry,
    };
    setTasks(prev => [newTask, ...prev]);
    triggerVibration('light');
    playTaskSound('queued');
    return id;
  };

  const updateTask = (id: string, updates: Partial<Omit<OperationTask, 'id'>>) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        const newState = updates.state || task.state;
        const newProgress = updates.progress !== undefined ? updates.progress : task.progress;
        
        // Dynamically calculate speed, ETA and other data if bytes are provided
        let calcUpdates = { ...updates };
        if (updates.bytesUploaded !== undefined && task.totalBytes) {
          const elapsed = (Date.now() - task.startedAt) / 1000;
          if (elapsed > 0) {
            const speedBytes = updates.bytesUploaded / elapsed; // bytes/sec
            const speedMb = (speedBytes / (1024 * 1024)).toFixed(1);
            calcUpdates.speed = `${speedMb} MB/s`;
            const remainingBytes = task.totalBytes - updates.bytesUploaded;
            calcUpdates.eta = Math.max(0, Math.round(remainingBytes / speedBytes));
            calcUpdates.progress = Math.min(99, Math.round((updates.bytesUploaded / task.totalBytes) * 100));
          }
        }

        if (newState !== task.state) {
          playTaskSound(newState.toLowerCase());
        }

        return {
          ...task,
          ...calcUpdates,
          updatedAt: Date.now()
        };
      }
      return task;
    }));
  };

  const failTask = (id: string, reason: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        triggerVibration('heavy');
        playTaskSound('failed');
        return {
          ...task,
          state: 'FAILED',
          error: reason,
          updatedAt: Date.now()
        };
      }
      return task;
    }));
  };

  const successTask = (id: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        triggerVibration('medium');
        playTaskSound('success');
        return {
          ...task,
          state: 'SUCCESS',
          progress: 100,
          updatedAt: Date.now()
        };
      }
      return task;
    }));
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const retryTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (task.retryCount >= task.maxRetries) {
      failTask(id, 'Max retries exceeded');
      return;
    }

    updateTask(id, {
      state: 'RETRYING',
      retryCount: task.retryCount + 1,
      error: undefined,
      progress: 0
    });

    try {
      if (task.onRetry) {
        await task.onRetry();
      }
    } catch (err: any) {
      failTask(id, err?.message || 'Retry action failed');
    }
  };

  // Helper to trigger realistic background operations that progress over time
  const simulateTaskProgress = async (id: string, durationMs: number = 3000, stepDurationMs: number = 300) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    updateTask(id, { state: 'STARTING', progress: 5 });
    await new Promise(r => setTimeout(r, 400));
    
    updateTask(id, { state: 'CONNECTING', progress: 15 });
    await new Promise(r => setTimeout(r, 400));

    updateTask(id, { state: 'UPLOADING', progress: 25 });

    const totalSteps = Math.ceil(durationMs / stepDurationMs);
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      const currentProgress = 25 + Math.round((currentStep / totalSteps) * 60); // progress up to 85%
      
      // simulate bytes uploaded if totalBytes is set
      const bytesUploaded = task.totalBytes ? Math.round((currentProgress / 100) * task.totalBytes) : undefined;
      
      updateTask(id, { 
        progress: Math.min(85, currentProgress),
        bytesUploaded
      });

      if (currentStep >= totalSteps) {
        clearInterval(interval);
        
        // Finalize state transitions
        setTimeout(() => {
          updateTask(id, { state: 'SERVER ACKNOWLEDGED', progress: 90 });
          setTimeout(() => {
            updateTask(id, { state: 'FINALIZING', progress: 95 });
            setTimeout(() => {
              successTask(id);
            }, 500);
          }, 400);
        }, 300);
      }
    }, stepDurationMs);
  };

  // Custom task sounds to fit user request
  const playTaskSound = (soundType: string) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      if (soundType === 'queued') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(660, audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, audioContext.currentTime);
      } else if (soundType === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.16); // G5
        gain.gain.setValueAtTime(0.03, audioContext.currentTime);
      } else if (soundType === 'failed') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.25);
        gain.gain.setValueAtTime(0.04, audioContext.currentTime);
      } else {
        // Subtle tick for other transitions
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, audioContext.currentTime);
        gain.gain.setValueAtTime(0.01, audioContext.currentTime);
      }
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + 0.3);
    } catch (_) {}
  };

  // Helper to render the custom brutalist status bar
  const renderBrutalistProgressBar = (progress: number, state: OperationState) => {
    const totalBlocks = 15;
    const filledBlocks = Math.round((progress / 100) * totalBlocks);
    const emptyBlocks = totalBlocks - filledBlocks;
    
    const filledStr = '█'.repeat(filledBlocks);
    const emptyStr = '░'.repeat(emptyBlocks);

    let colorClass = 'text-red-500';
    if (state === 'SUCCESS') colorClass = 'text-emerald-500';
    if (state === 'FAILED') colorClass = 'text-red-500';
    if (state === 'QUEUED') colorClass = 'text-zinc-500';
    if (state === 'RETRYING') colorClass = 'text-amber-500 animate-pulse';

    return (
      <div className="font-mono text-[10px] tracking-widest flex items-center gap-1 leading-none select-none">
        <span className={colorClass}>[{filledStr}{emptyStr}]</span>
        <span className="font-black text-[var(--color-text)]">{progress}%</span>
      </div>
    );
  };

  const getNetworkStyle = () => {
    switch (networkMetrics.status) {
      case 'FAST': return { border: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20', label: 'FAST' };
      case 'NORMAL': return { border: 'border-cyan-500/40 text-cyan-400 bg-cyan-950/20', label: 'NORMAL' };
      case 'SLOW': return { border: 'border-amber-500/40 text-amber-400 bg-amber-950/20', label: 'SLOW' };
      case 'BAD': return { border: 'border-red-500/40 text-red-400 bg-red-950/20', label: 'BAD' };
      default: return { border: 'border-[var(--neon-green-border)] text-zinc-500 bg-[var(--color-background)]/20', label: 'OFFLINE' };
    }
  };

  const netStyle = getNetworkStyle();

  return (
    <OperationContext.Provider
      value={{
        tasks,
        networkMetrics,
        createTask,
        updateTask,
        failTask,
        successTask,
        removeTask,
        retryTask,
        simulateTaskProgress,
        isTaskMonitorEnabled,
        setIsTaskMonitorEnabled: handleSetTaskMonitorEnabled
      }}
    >
      {children}

      {/* FLOATING BRUTALIST REALTIME OPERATION TASK MONITOR & NETWORK SPECTRUM */}
      {isTaskMonitorEnabled && tasks.length > 0 && (
        <div className="fixed bottom-4 right-4 z-100 font-mono w-80 max-w-[calc(100vw-2rem)] select-none animate-fade-in">
          <div className="bg-[#0b0b0e] border-2 border-red-500/60 p-3.5 [box-shadow:6px_6px_0px_rgba(239,68,68,0.25)] flex flex-col gap-2.5">
            {/* Header Title Bar */}
            <div className="flex items-center justify-between border-b border-[var(--neon-green-border)] pb-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-[var(--color-text)]">
                <Terminal className="w-4 h-4 text-red-500 animate-pulse" />
                <span>TASK_SPECTRUM_MONITOR</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Live Latency badge */}
                <div className={`px-2 py-0.5 text-[7px] border font-black uppercase tracking-wider ${netStyle.border} flex items-center gap-1 rounded`}>
                  <Wifi className="w-2.5 h-2.5" />
                  <span>{netStyle.label} • {networkMetrics.ping}ms</span>
                </div>

                <button
                  onClick={() => setIsMonitorExpanded(!isMonitorExpanded)}
                  className="text-zinc-500 hover:text-[var(--color-text)] transition cursor-pointer"
                  title={isMonitorExpanded ? "Minimize monitor" : "Expand monitor"}
                >
                  {isMonitorExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => {
                    handleSetTaskMonitorEnabled(false);
                    triggerVibration('medium');
                  }}
                  className="text-zinc-500 hover:text-red-500 transition cursor-pointer p-0.5"
                  title="Close & Hide Monitor (can re-enable in Settings)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tasks Panel scroll container */}
            <AnimatePresence>
              {isMonitorExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3.5 max-h-64 overflow-y-auto pr-1 scrollbar-thin"
                >
                  {tasks.map((task) => {
                    let badgeColor = 'bg-[var(--color-background)] border-[var(--neon-green-border)] text-zinc-400';
                    if (task.state === 'SUCCESS') badgeColor = 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400';
                    if (task.state === 'FAILED') badgeColor = 'bg-red-950/20 border-red-500/30 text-red-400';
                    if (task.state === 'UPLOADING') badgeColor = 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400';
                    if (task.state === 'RETRYING') badgeColor = 'bg-amber-950/20 border-amber-500/30 text-amber-400';

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -50, opacity: 0 }}
                        className="p-2.5 border border-zinc-850/60 bg-[var(--color-surface)]/55 hover:border-[var(--neon-green-border)] transition"
                      >
                        {/* Task metadata row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-left">
                            <span className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-wider block leading-none mb-1">
                              {task.type} • {task.id.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-[var(--color-text)] font-semibold leading-tight block">
                              {task.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`px-1.5 py-0.5 text-[6.5px] border font-black uppercase tracking-widest ${badgeColor} rounded`}>
                              {task.state}
                            </span>
                            
                            {/* Cancellation trigger */}
                            {task.state !== 'SUCCESS' && task.state !== 'FAILED' && task.onCancel && (
                              <button
                                onClick={() => {
                                  task.onCancel?.();
                                  failTask(task.id, 'Cancelled by client spectrum');
                                }}
                                className="text-zinc-600 hover:text-red-500 cursor-pointer p-0.5 transition"
                                title="Abort task"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Dismiss completed tasks */}
                            {(task.state === 'SUCCESS' || task.state === 'FAILED') && (
                              <button
                                onClick={() => removeTask(task.id)}
                                className="text-zinc-600 hover:text-zinc-400 cursor-pointer p-0.5 transition"
                                title="Dismiss monitoring"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Real-time statistics block for uploads/processing */}
                        {task.state !== 'SUCCESS' && task.state !== 'FAILED' && (
                          <div className="mt-2 text-[8px] text-zinc-400 flex items-center justify-between font-mono leading-none select-none">
                            {task.totalBytes && task.bytesUploaded ? (
                              <span>
                                {(task.bytesUploaded / (1024 * 1024)).toFixed(1)} MB / {(task.totalBytes / (1024 * 1024)).toFixed(1)} MB
                              </span>
                            ) : (
                              <span className="text-zinc-500 italic">Processing payload...</span>
                            )}

                            {task.speed && <span>{task.speed}</span>}
                            {task.eta !== undefined && <span>ETA: {task.eta}s</span>}
                          </div>
                        )}

                        {/* Custom Brutalist bar */}
                        <div className="mt-2.5">
                          {renderBrutalistProgressBar(task.progress, task.state)}
                        </div>

                        {/* Retrying trigger bar or error explanation */}
                        {task.state === 'FAILED' && (
                          <div className="mt-2.5 flex items-center justify-between gap-2 bg-red-950/15 p-1.5 border border-red-500/20 rounded">
                            <span className="text-[7.5px] text-red-400 font-medium truncate max-w-[150px]">
                              ⚠️ {task.error}
                            </span>
                            
                            {task.onRetry && (
                              <button
                                onClick={() => retryTask(task.id)}
                                className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-[var(--color-text)] text-[7.5px] uppercase font-bold cursor-pointer rounded flex items-center gap-1 shrink-0"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>RETRY [ {task.retryCount} ]</span>
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </OperationContext.Provider>
  );
};
