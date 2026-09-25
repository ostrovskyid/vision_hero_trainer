/** Shared colour, sound and speech helpers used by every exercise. */

/**
 * Scales a colour's brightness. Cheap cyan filters never block red completely,
 * so a full-intensity red still ghosts through as a grey outline; dimming the
 * target is the most effective lever the software has against that.
 */
export const scaleColor = (hex: string, factor: number) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const scale = (channel: number) => Math.round(Math.min(255, Math.max(0, channel * factor)));
  const r = scale((value >> 16) & 255);
  const g = scale((value >> 8) & 255);
  const b = scale(value & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`;
};

/** Expands a #rrggbb colour to an rgba() string, for the translucent tints. */
export const withAlpha = (hex: string, alpha: number) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const playSound = (type: 'hit' | 'miss' | 'complete', enabled: boolean) => {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'hit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'miss') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'complete') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

/**
 * Reads an instruction aloud. Most five-year-olds cannot read yet, so every
 * game says what to do instead of relying on the text on screen. Uses the
 * browser's built-in voices, so it works offline and needs no audio files.
 */
export const speak = (text: string, enabled: boolean) => {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    // A new instruction replaces the old one rather than queueing behind it.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.15;
    const english = synth.getVoices().find(v => v.lang.startsWith('en'));
    if (english) utterance.voice = english;
    synth.speak(utterance);
  } catch {
    // Speech is a nicety; the game still shows the instruction on screen.
  }
};

export const stopSpeaking = () => {
  try { window.speechSynthesis?.cancel(); } catch { /* unsupported */ }
};
