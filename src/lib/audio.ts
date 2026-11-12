// Web Audio API & Haptic feedback engine for Warmth (온기)

const VOLUME_STORAGE_KEY = 'warmth_sound_volume';
const RESUME_TIMEOUT_MS = 250;
const USER_GESTURE_WINDOW_MS = 1200;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.8;
  private meltOsc: OscillatorNode | null = null;
  private meltGain: GainNode | null = null;
  private meltFilter: BiquadFilterNode | null = null;
  private meltGeneration: number = 0;
  private isMelting: boolean = false;

  private resumePromise: Promise<boolean> | null = null;
  private ctxNeedsRecreate: boolean = false;
  private lastUserGestureAt: number = 0;
  private lastHealthCheckAt: number = 0;
  private clockCheckTimer: number | null = null;

  constructor() {
    this.syncVolumeFromStorage();
  }

  private syncVolumeFromStorage() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0 && val <= 1) {
          this.volume = val;
        }
      }
    } catch {
      // ignore storage errors
    }
  }

  private configureAudioSession() {
    if (typeof navigator === 'undefined') return;
    try {
      const navWithSession = navigator as Navigator & {
        audioSession?: { type: string };
      };
      if (navWithSession.audioSession && navWithSession.audioSession.type === 'auto') {
        navWithSession.audioSession.type = 'ambient';
      }
    } catch {
      // ignore unsupported browsers
    }
  }

  private clearClockCheckTimer() {
    if (this.clockCheckTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.clockCheckTimer);
      this.clockCheckTimer = null;
    }
  }

  private disposeCtx() {
    this.clearClockCheckTimer();
    this.stopMeltHum();
    const oldCtx = this.ctx;
    const oldGain = this.masterGain;
    this.ctx = null;
    this.masterGain = null;
    this.ctxNeedsRecreate = false;
    this.resumePromise = null;

    try {
      oldGain?.disconnect();
    } catch {
      // ignore
    }
    if (oldCtx) {
      try {
        oldCtx.onstatechange = null;
        if ((oldCtx.state as string) !== 'closed') {
          oldCtx.close().catch(() => {});
        }
      } catch {
        // ignore
      }
    }
  }

  private createCtxIfNeeded(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (this.ctx && (this.ctx.state as string) === 'closed') {
      this.disposeCtx();
    }

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.configureAudioSession();
      this.syncVolumeFromStorage();

      const ctx = new AudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // iOS WebKit 'interrupted' 전환 후 포그라운드 복귀 시 복구 또는 재생성 플래그 설정
      ctx.onstatechange = () => {
        if (this.ctx !== ctx) return;
        const currentState = ctx.state as string;
        if (currentState === 'interrupted') {
          this.ctxNeedsRecreate = true;
        }
        if (
          (currentState === 'suspended' || currentState === 'interrupted') &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible'
        ) {
          ctx.resume().catch(() => {});
        }
      };

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.ctxNeedsRecreate = false;
    }

    return this.ctx;
  }

  private recreateCtx(): AudioContext | null {
    this.disposeCtx();
    return this.createCtxIfNeeded();
  }

  // iOS WebKit 오디오 출력 채널 즉시 활성화를 위한 1샘플 무음 버퍼 재생
  private primeSilentBuffer(ctx: AudioContext) {
    try {
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // ignore
    }
  }

  // 실행 중인 AudioContext의 currentTime이 실제로 흐르는지 검사 (WebKit 좀비 컨텍스트 감지)
  private scheduleClockCheck(force: boolean = false) {
    if (typeof window === 'undefined' || !this.ctx) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    const nowMs = Date.now();
    if (!force && nowMs - this.lastHealthCheckAt < 2000) return;
    if (this.clockCheckTimer !== null) return;
    this.lastHealthCheckAt = nowMs;

    const targetCtx = this.ctx;
    const startCtxTime = targetCtx.currentTime;

    this.clockCheckTimer = window.setTimeout(() => {
      this.clockCheckTimer = null;
      if (this.ctx !== targetCtx) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      const state = targetCtx.state as string;
      const elapsedCtxTime = targetCtx.currentTime - startCtxTime;
      if (state === 'running' && elapsedCtxTime <= 0.0005) {
        // state는 running이지만 오디오 클럭이 멈춘 상태 -> 다음 제스처/복구 시 재생성
        this.ctxNeedsRecreate = true;
      }
    }, 180);
  }

  private async resumeWithTimeout(ctx: AudioContext): Promise<void> {
    let timeoutId: number | null = null;
    try {
      await Promise.race([
        ctx.resume().catch(() => {}),
        new Promise<void>((resolve) => {
          timeoutId = window.setTimeout(resolve, RESUME_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  private async ensureRunning(isUserGesture: boolean): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (this.ctx && this.ctxNeedsRecreate && isUserGesture) {
      this.recreateCtx();
    }

    const initialCtx = this.createCtxIfNeeded();
    if (!initialCtx) return false;

    const initialState = initialCtx.state as string;
    if (initialState === 'running' && !this.ctxNeedsRecreate) {
      this.scheduleClockCheck();
      return true;
    }

    if (isUserGesture && initialState === 'interrupted') {
      this.recreateCtx();
    }

    if (this.resumePromise) {
      return this.resumePromise;
    }

    this.resumePromise = (async () => {
      try {
        const ctx = this.ctx ?? this.createCtxIfNeeded();
        if (!ctx) return false;

        if (isUserGesture) {
          this.primeSilentBuffer(ctx);
        }

        if ((ctx.state as string) !== 'running') {
          await this.resumeWithTimeout(ctx);
        }

        if (this.ctx && (this.ctx.state as string) === 'running' && !this.ctxNeedsRecreate) {
          this.scheduleClockCheck();
          return true;
        }

        // 사용자 제스처 중인데도 기존 컨텍스트가 깨어나지 못하면 새 AudioContext로 즉시 교체
        if (isUserGesture) {
          const freshCtx = this.recreateCtx();
          if (!freshCtx) return false;
          this.primeSilentBuffer(freshCtx);
          if ((freshCtx.state as string) !== 'running') {
            await this.resumeWithTimeout(freshCtx);
          }
          const isRunning = (freshCtx.state as string) === 'running';
          if (isRunning) {
            this.scheduleClockCheck();
          }
          return isRunning;
        }

        return false;
      } catch {
        return false;
      } finally {
        this.resumePromise = null;
      }
    })();

    return this.resumePromise;
  }

  public markUserGesture() {
    this.lastUserGestureAt = Date.now();
  }

  public resume(isUserGesture: boolean = false) {
    if (isUserGesture) {
      this.lastUserGestureAt = Date.now();
    }
    try {
      const ctx = this.createCtxIfNeeded();
      if (!ctx) return;

      const state = ctx.state as string;
      if (state === 'running' && !this.ctxNeedsRecreate) {
        this.scheduleClockCheck();
        return;
      }

      if (isUserGesture && (this.ctxNeedsRecreate || state === 'interrupted')) {
        const freshCtx = this.recreateCtx();
        if (freshCtx) {
          this.primeSilentBuffer(freshCtx);
          void this.ensureRunning(true);
        }
        return;
      }

      if (isUserGesture) {
        this.primeSilentBuffer(ctx);
      }

      void this.ensureRunning(isUserGesture);
    } catch {
      // ignore
    }
  }

  public handleVisibilityHidden() {
    this.stopMeltHum();
    this.clearClockCheckTimer();
    if (this.ctx && (this.ctx.state as string) !== 'running') {
      this.ctxNeedsRecreate = true;
    }
  }

  public handleVisibilityRestore() {
    try {
      if (!this.ctx) return;
      const state = this.ctx.state as string;
      if (state === 'interrupted' || state === 'closed') {
        this.ctxNeedsRecreate = true;
      }
      if (state === 'suspended' || state === 'interrupted') {
        void this.ensureRunning(false).then((ok) => {
          if (!ok) {
            this.ctxNeedsRecreate = true;
          }
        });
      } else if (state === 'running') {
        this.scheduleClockCheck(true);
      }
    } catch {
      // ignore
    }
  }

  private getDestination(ctx?: AudioContext): AudioNode {
    const activeCtx = ctx ?? this.createCtxIfNeeded();
    if (this.masterGain) return this.masterGain;
    if (activeCtx) return activeCtx.destination;
    throw new Error('AudioContext not available');
  }

  // running 상태면 0ms 즉시 실행, 중단/일시정지 상태면 복구(필요 시 재생성) 후 즉시 실행
  private runWhenReady(playFn: (ctx: AudioContext) => void) {
    const ctx = this.createCtxIfNeeded();
    if (!ctx) return;

    const hasRecentGesture = Date.now() - this.lastUserGestureAt < USER_GESTURE_WINDOW_MS;
    const state = ctx.state as string;

    if (state === 'running' && !this.ctxNeedsRecreate) {
      try {
        playFn(ctx);
        this.scheduleClockCheck();
      } catch {
        // ignore
      }
      return;
    }

    void this.ensureRunning(hasRecentGesture).then((ready) => {
      if (!ready || !this.ctx || (this.ctx.state as string) !== 'running') return;
      try {
        playFn(this.ctx);
      } catch {
        // ignore
      }
    });
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VOLUME_STORAGE_KEY, String(this.volume));
      } catch {
        // ignore
      }
    }
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      } catch {
        // ignore
      }
    }
  }

  public getVolume(): number {
    this.syncVolumeFromStorage();
    return this.volume;
  }

  // 1. 3초 롱프레스 시 왁스가 녹아내리는 저음 앰비언스 (Melt hum)
  public startMeltHum() {
    this.lastUserGestureAt = Date.now();
    try {
      this.stopMeltHum();
      this.isMelting = true;
      const currentGen = ++this.meltGeneration;

      this.runWhenReady((ctx) => {
        if (!this.isMelting || this.meltGeneration !== currentGen) return;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // 따뜻하고 묵직한 삼각파 + 로우패스 필터
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(75, now);
        // 3초 동안 서서히 주파수와 배음이 증가하여 긴장감 고조
        osc.frequency.exponentialRampToValueAtTime(140, now + 3.0);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(180, now);
        filter.frequency.exponentialRampToValueAtTime(320, now + 3.0);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.3);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination(ctx));

        osc.start(now);
        this.meltOsc = osc;
        this.meltGain = gain;
        this.meltFilter = filter;
      });

      // 안드로이드 미세 햅틱
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40]);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn('Audio playback error', e);
    }
  }

  public updateMeltProgress(progress: number) {
    if (!this.ctx || !this.meltFilter || !this.meltGain) return;
    try {
      const now = this.ctx.currentTime;
      // 게이지가 찰수록 약간의 톤 상승
      this.meltFilter.frequency.setValueAtTime(180 + progress * 200, now);
      // 안드로이드 햅틱 펄스 주기적 전송
      if (progress > 0.3 && progress < 0.95 && typeof window !== 'undefined' && 'vibrate' in navigator) {
        if (Math.random() < 0.15) {
          navigator.vibrate([25]);
        }
      }
    } catch {
      // ignore
    }
  }

  public stopMeltHum() {
    this.isMelting = false;
    this.meltGeneration += 1;

    const osc = this.meltOsc;
    const gain = this.meltGain;
    const filter = this.meltFilter;
    this.meltOsc = null;
    this.meltGain = null;
    this.meltFilter = null;

    try {
      if (gain && this.ctx && (this.ctx.state as string) !== 'closed') {
        const now = this.ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.001), now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
        setTimeout(() => {
          try {
            osc?.stop();
          } catch {
            // ignore
          }
          try {
            osc?.disconnect();
            filter?.disconnect();
            gain?.disconnect();
          } catch {
            // ignore
          }
        }, 100);
      } else if (osc || gain || filter) {
        try {
          osc?.stop();
        } catch {
          // ignore
        }
        try {
          osc?.disconnect();
          filter?.disconnect();
          gain?.disconnect();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. 왁스 파쇄 및 봉인 개봉음 (Wax Crack / Seal Broken)
  public playWaxCrackSound() {
    this.stopMeltHum();
    try {
      this.runWhenReady((ctx) => {
        const now = ctx.currentTime;
        const dest = this.getDestination(ctx);

        // [A] 노이즈 버스트 (바사삭 깨지는 파편 질감)
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.15));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1200, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.35, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(dest);
        noise.start(now);
        noise.onended = () => {
          try {
            noise.disconnect();
            noiseFilter.disconnect();
            noiseGain.disconnect();
          } catch {
            // ignore
          }
        };

        // [B] 묵직한 딱! 스냅 톤 (Snapping Transient)
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();

        snapOsc.type = 'sine';
        snapOsc.frequency.setValueAtTime(380, now);
        snapOsc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

        snapGain.gain.setValueAtTime(0.5, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        snapOsc.connect(snapGain);
        snapGain.connect(dest);

        snapOsc.start(now);
        snapOsc.stop(now + 0.25);
        snapOsc.onended = () => {
          try {
            snapOsc.disconnect();
            snapGain.disconnect();
          } catch {
            // ignore
          }
        };
      });

      // 모바일 진동 피드백 (PRD 명시: [100, 50, 200])
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 200]);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn('Crack sound error', e);
    }
  }

  // 3. 미션 완수 축하 차임벨 (Delicate warm chime)
  public playMissionPassChime() {
    try {
      this.runWhenReady((ctx) => {
        const now = ctx.currentTime;
        const dest = this.getDestination(ctx);
        const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 아르페지오

        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startAt = now + idx * 0.08;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startAt);

          gain.gain.setValueAtTime(0.001, startAt);
          gain.gain.linearRampToValueAtTime(0.15, startAt + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.8);

          osc.connect(gain);
          gain.connect(dest);

          osc.start(startAt);
          osc.stop(startAt + 0.9);
          osc.onended = () => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch {
              // ignore
            }
          };
        });
      });
    } catch {
      // ignore
    }
  }

  // 4. 종이 사각거리는 편지지 오픈 효과음 (Paper unfold)
  public playPaperRustle() {
    try {
      this.runWhenReady((ctx) => {
        const now = ctx.currentTime;
        const dest = this.getDestination(ctx);
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.35));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.Q.setValueAtTime(2.0, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        noise.start(now);
        noise.onended = () => {
          try {
            noise.disconnect();
            filter.disconnect();
            gain.disconnect();
          } catch {
            // ignore
          }
        };
      });
    } catch {
      // ignore
    }
  }

  // 5. 퍼즐 타일 슬라이드 탁! 소리 (Soft wooden tile click)
  public playTileSlideSound() {
    try {
      this.runWhenReady((ctx) => {
        const now = ctx.currentTime;
        const dest = this.getDestination(ctx);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(125, now + 0.055);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.085);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            // ignore
          }
        };
      });
    } catch {
      // ignore
    }
  }

  // 6. 우표 소인 쿵! 도장 타격음 (Deep stamp postmark thud)
  public playStampThudSound() {
    try {
      this.runWhenReady((ctx) => {
        const now = ctx.currentTime;
        const dest = this.getDestination(ctx);

        // 묵직한 타격감
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.2);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            // ignore
          }
        };
      });

      // 모바일 진동
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([60]);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  // 7. 은은한 풍경 종소리 노크음 (Gentle wind chime bell for partner knock)
  public playWindChimeKnock() {
    try {
      this.runWhenReady((ctx) => {
        const now = ctx.currentTime;
        const dest = this.getDestination(ctx);
        // 은은한 오리엔탈/유러피안 풍경 종소리 (Pentatonic Chime: E5, B5, E6, F#6, B6)
        const notes = [
          { freq: 659.25, time: 0.0, gain: 0.15, duration: 1.8 },
          { freq: 987.77, time: 0.12, gain: 0.13, duration: 2.0 },
          { freq: 1318.51, time: 0.28, gain: 0.11, duration: 2.2 },
          { freq: 1479.98, time: 0.45, gain: 0.09, duration: 2.4 },
          { freq: 1975.53, time: 0.62, gain: 0.07, duration: 2.6 },
        ];

        notes.forEach((note) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startAt = now + note.time;

          // 맑고 투명한 사인파 종소리
          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.freq, startAt);

          gain.gain.setValueAtTime(0.001, startAt);
          gain.gain.linearRampToValueAtTime(note.gain, startAt + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration);

          osc.connect(gain);
          gain.connect(dest);

          osc.start(startAt);
          osc.stop(startAt + note.duration);
          osc.onended = () => {
            try {
              osc.disconnect();
              gain.disconnect();
            } catch {
              // ignore
            }
          };
        });
      });

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([30, 80, 40]);
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }
}

export const soundEngine = new SoundEngine();

if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    soundEngine.resume(true);
  };
  const unlockOptions: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener('pointerdown', unlockAudio, unlockOptions);
  window.addEventListener('touchstart', unlockAudio, unlockOptions);
  window.addEventListener('touchend', unlockAudio, unlockOptions);
  window.addEventListener('mousedown', unlockAudio, unlockOptions);
  window.addEventListener('click', unlockAudio, unlockOptions);
  window.addEventListener('keydown', unlockAudio, unlockOptions);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      soundEngine.handleVisibilityRestore();
    } else {
      soundEngine.handleVisibilityHidden();
    }
  };
  const restoreOnForeground = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      soundEngine.handleVisibilityRestore();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pageshow', restoreOnForeground);
  window.addEventListener('focus', restoreOnForeground);
  window.addEventListener('storage', (e) => {
    if (e.key === VOLUME_STORAGE_KEY && e.newValue !== null) {
      const parsed = parseFloat(e.newValue);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        soundEngine.setVolume(parsed);
      }
    }
  });
}
