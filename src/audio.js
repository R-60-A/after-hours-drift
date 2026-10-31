// Local Web Audio engine: engine tone, tire skid noise, crash, and mute.
(function(root) {
  'use strict';
  root.createDriftAudio = function() {
    return {
      context: null,
      engine: null,
      engineGain: null,
      skidGain: null,
      master: null,
      init(muted) {
        if (this.context) {
          this.context.resume().catch(() => {});
          return;
        }
        try {
          const A = window.AudioContext || window.webkitAudioContext;
          if (!A) return;
          const a = this.context = new A();
          this.master = a.createGain();
          this.master.gain.value = muted ? 0 : .38;
          this.master.connect(a.destination);
          this.engine = a.createOscillator();
          this.engine.type = 'sawtooth';
          this.engine.frequency.value = 45;
          const filter = a.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 340;
          this.engineGain = a.createGain();
          this.engineGain.gain.value = 0;
          this.engine.connect(filter);
          filter.connect(this.engineGain);
          this.engineGain.connect(this.master);
          this.engine.start();
          const buffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate),
            data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          this.noiseBuffer = buffer;
          const noise = a.createBufferSource();
          noise.buffer = buffer;
          noise.loop = true;
          const band = a.createBiquadFilter();
          band.type = 'bandpass';
          band.frequency.value = 1700;
          band.Q.value = .7;
          this.skidGain = a.createGain();
          this.skidGain.gain.value = 0;
          noise.connect(band);
          band.connect(this.skidGain);
          this.skidGain.connect(this.master);
          noise.start();
        } catch (_) {
          this.context = null;
        }
      },
      update(active, car, score) {
        if (!this.context) return;
        const t = this.context.currentTime;
        this.engine.frequency.setTargetAtTime(38 + car.speed * .48, t, .08);
        this.engineGain.gain.setTargetAtTime(active ? .035 + car.speed * .00023 : 0, t, .08);
        this.skidGain.gain.setTargetAtTime(active && score.drifting ? Math.min(.15, Math.abs(car
          .slip) * .16) : 0, t, .08);
      },
      crash() {
        if (!this.context) return;
        try {
          const a = this.context,
            n = a.createBufferSource(),
            g = a.createGain(),
            filter = a.createBiquadFilter();
          n.buffer = this.noiseBuffer;
          filter.type = 'lowpass';
          filter.frequency.value = 650;
          g.gain.setValueAtTime(.65, a.currentTime);
          g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .45);
          n.connect(filter);
          filter.connect(g);
          g.connect(this.master);
          n.start();
          n.stop(a.currentTime + .5);
        } catch (_) {}
      },
      mute(muted) {
        if (this.context) this.master.gain.setTargetAtTime(muted ? 0 : .38, this.context
          .currentTime, .03);
      }
    };
  };
})(globalThis);
