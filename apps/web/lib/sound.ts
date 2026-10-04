/**
 * Smol Café — Audio Alert Synthesizer (Web Audio API)
 * Generates crisp, attentive, loud acoustic bell chimes for busy kitchen KDS and customer alerts.
 * Zero external asset dependencies, zero CORS errors, works on all modern browsers.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Loud, bright, attentive 3-tone Kitchen KDS Dispatch Bell
   * Designed to cut through noisy kitchen backgrounds (grill, grinder, espresso steam).
   * Tone sequence: High Ding-Dong-Ding (C6 1046.5Hz -> E6 1318.5Hz -> G6 1568.0Hz)
   */
  public playKitchenNewOrderAlert() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Tone 1: C6 (1046.5 Hz) - Crisp attack
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Harmonic 1 (adds metallic chime presence)
      const harm1 = ctx.createOscillator();
      const harmGain1 = ctx.createGain();
      harm1.type = "triangle";
      harm1.frequency.setValueAtTime(2093.0, now);
      harmGain1.gain.setValueAtTime(0.3, now);
      harmGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      harm1.connect(harmGain1);
      harmGain1.connect(ctx.destination);
      harm1.start(now);
      harm1.stop(now + 0.5);

      // Tone 2: E6 (1318.5 Hz) - Ascending bell (0.16s delay)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.5, now + 0.16);
      gain2.gain.setValueAtTime(0.8, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 1.0);

      // Tone 3: G6 (1567.98 Hz) - Bright resonant finale (0.32s delay)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(1567.98, now + 0.32);
      gain3.gain.setValueAtTime(0.9, now + 0.32);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.32);
      osc3.stop(now + 1.6);

      // Harmonic 3 sparkle
      const harm3 = ctx.createOscillator();
      const harmGain3 = ctx.createGain();
      harm3.type = "triangle";
      harm3.frequency.setValueAtTime(3135.96, now + 0.32);
      harmGain3.gain.setValueAtTime(0.35, now + 0.32);
      harmGain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      harm3.connect(harmGain3);
      harmGain3.connect(ctx.destination);
      harm3.start(now + 0.32);
      harm3.stop(now + 0.9);
    } catch (e) {
      console.warn("Kitchen alert audio synthesis failed:", e);
    }
  }

  /**
   * Attentive two-tone melodic service bell for Customer "ORDER READY / SERVED"
   * Frequencies: F5 (698.46 Hz) -> C6 (1046.50 Hz) with rich harmonics
   */
  public playOrderReadyChime() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: F5 (698.46 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(698.46, now);
      gain1.gain.setValueAtTime(0.65, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      // Note 2: A5 (880 Hz) harmonic
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.15);
      gain2.gain.setValueAtTime(0.7, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 1.5);

      // Note 3: C6 (1046.50 Hz) high bell
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(1046.5, now + 0.3);
      gain3.gain.setValueAtTime(0.8, now + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.3);
      osc3.stop(now + 2.0);
    } catch (e) {
      console.warn("Audio synthesis note failed:", e);
    }
  }

  /**
   * Warm front-desk bell chime for Cashier Desk when customer submits "Pay at Cashier"
   * Tone sequence: Soft double bell (G5 783.99Hz -> C6 1046.50Hz)
   */
  public playCashierIncomingOrderAlert() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: G5 (783.99 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0.6, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.9);

      // Note 2: C6 (1046.50 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1046.50, now + 0.18);
      gain2.gain.setValueAtTime(0.75, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 1.4);
    } catch (e) {
      console.warn("Cashier audio synthesis failed:", e);
    }
  }

  /**
   * Alias for standard order alerts
   */
  public playOrderPlacedChime() {
    this.playKitchenNewOrderAlert();
  }
}

export const soundManager = new SoundSynthesizer();
