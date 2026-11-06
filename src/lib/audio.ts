class DataStreamAudio {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private nodes: any[] = [];

  start() {
    if (this.isPlaying || typeof window === 'undefined') return;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) {
      return;
    }

    this.isPlaying = true;

    if (!this.ctx) {
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // 1. Noise generation
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1; // White noise
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // 2. Bandpass filter for data texture
    const bpFilter = this.ctx.createBiquadFilter();
    bpFilter.type = 'bandpass';
    bpFilter.frequency.value = 1500;
    bpFilter.Q.value = 4; // Tight resonance for synthetic feel

    // 3. LFO to create rapid pulsing (data flow effect)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square'; // choppy data stream feel
    lfo.frequency.value = 16; // 16 Hz rapid pulse

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.5;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.5;

    lfo.connect(lfoGain);
    lfoGain.connect(noiseGain.gain);

    // 4. Low frequency drone for OS gravity
    const drone = this.ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 50; 
    
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.8;
    drone.connect(droneGain);

    // 5. Master Gain
    const masterGain = this.ctx.createGain();
    masterGain.gain.value = 0.02; // Very subtle

    noiseSource.connect(bpFilter);
    bpFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    
    droneGain.connect(masterGain);
    
    masterGain.connect(this.ctx.destination);

    noiseSource.start();
    lfo.start();
    drone.start();
    
    this.nodes = [noiseSource, bpFilter, lfo, lfoGain, noiseGain, drone, droneGain, masterGain];
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    
    this.nodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        node.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    });
    this.nodes = [];
  }
}

export const audioEngine = new DataStreamAudio();
