// Web Audio API & Haptic feedback engine for Warmth (온기)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private meltOsc: OscillatorNode | null = null;
  private meltGain: GainNode | null = null;
  private meltFilter: BiquadFilterNode | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // 1. 3초 롱프레스 시 왁스가 녹아내리는 저음 앰비언스 (Melt hum)
  public startMeltHum() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      this.stopMeltHum();

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

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
      gain.connect(this.ctx.destination);

      osc.start(now);
      this.meltOsc = osc;
      this.meltGain = gain;
      this.meltFilter = filter;

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
    try {
      if (this.meltGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.meltGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
        setTimeout(() => {
          try {
            this.meltOsc?.stop();
            this.meltOsc?.disconnect();
            this.meltGain?.disconnect();
          } catch {
            // ignore
          }
          this.meltOsc = null;
          this.meltGain = null;
          this.meltFilter = null;
        }, 120);
      }
    } catch {
      // ignore
    }
  }

  // 2. 왁스 파쇄 및 봉인 개봉음 (Wax Crack / Seal Broken)
  public playWaxCrackSound() {
    this.stopMeltHum();
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // [A] 노이즈 버스트 (바사삭 깨지는 파편 질감)
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(1200, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);

      // [B] 묵직한 딱! 스냅 톤 (Snapping Transient)
      const snapOsc = this.ctx.createOscillator();
      const snapGain = this.ctx.createGain();

      snapOsc.type = 'sine';
      snapOsc.frequency.setValueAtTime(380, now);
      snapOsc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

      snapGain.gain.setValueAtTime(0.5, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      snapOsc.connect(snapGain);
      snapGain.connect(this.ctx.destination);

      snapOsc.start(now);
      snapOsc.stop(now + 0.25);

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
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 아르페지오

      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.9);
      });
    } catch {
      // ignore
    }
  }

  // 4. 종이 사각거리는 편지지 오픈 효과음 (Paper unfold)
  public playPaperRustle() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(2.0, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
    } catch {
      // ignore
    }
  }
}

export const soundEngine = new SoundEngine();
