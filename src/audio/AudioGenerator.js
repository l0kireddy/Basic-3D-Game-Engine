/**
 * AudioGenerator - Generates simple audio samples for testing
 */
export class AudioGenerator {
  constructor() {
    this.audioContext = null;
    this.sampleRate = 44100;
  }

  // Get or create audio context
  getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Generate a simple beep sound
  generateBeep(frequency = 440, duration = 0.3, volume = 0.3) {
    const context = this.getAudioContext();
    const sampleFrames = Math.floor(duration * this.sampleRate);
    const audioBuffer = context.createBuffer(1, sampleFrames, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < sampleFrames; i++) {
      const t = i / this.sampleRate;
      // Simple sine wave with envelope
      const envelope = Math.max(0, 1 - (t / duration));
      channelData[i] = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    }

    return audioBuffer;
  }

  // Generate a click sound
  generateClick(duration = 0.1, volume = 0.5) {
    const context = this.getAudioContext();
    const sampleFrames = Math.floor(duration * this.sampleRate);
    const audioBuffer = context.createBuffer(1, sampleFrames, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < sampleFrames; i++) {
      const t = i / this.sampleRate;
      // Sharp attack, quick decay
      const envelope = Math.exp(-t * 20);
      const noise = (Math.random() * 2 - 1) * 0.3;
      const tone = Math.sin(2 * Math.PI * 800 * t);
      channelData[i] = (noise + tone) * volume * envelope;
    }

    return audioBuffer;
  }

  // Generate an explosion sound
  generateExplosion(duration = 0.8, volume = 0.4) {
    const context = this.getAudioContext();
    const sampleFrames = Math.floor(duration * this.sampleRate);
    const audioBuffer = context.createBuffer(1, sampleFrames, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < sampleFrames; i++) {
      const t = i / this.sampleRate;
      // Exponential decay envelope
      const envelope = Math.exp(-t * 3);
      // Low frequency rumble + high frequency crack
      const rumble = Math.sin(2 * Math.PI * 60 * t) * 0.6;
      const crack = Math.sin(2 * Math.PI * 1200 * t) * 0.3;
      const noise = (Math.random() * 2 - 1) * 0.8;
      channelData[i] = (rumble + crack + noise) * volume * envelope;
    }

    return audioBuffer;
  }

  // Generate a jump sound
  generateJump(duration = 0.4, volume = 0.3) {
    const context = this.getAudioContext();
    const sampleFrames = Math.floor(duration * this.sampleRate);
    const audioBuffer = context.createBuffer(1, sampleFrames, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < sampleFrames; i++) {
      const t = i / this.sampleRate;
      // Rising frequency with quick decay
      const frequency = 200 + (t / duration) * 400;
      const envelope = Math.exp(-t * 5);
      channelData[i] = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    }

    return audioBuffer;
  }

  // Generate ambient background sound
  generateAmbient(duration = 5.0, volume = 0.2) {
    const context = this.getAudioContext();
    const sampleFrames = Math.floor(duration * this.sampleRate);
    const audioBuffer = context.createBuffer(1, sampleFrames, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < sampleFrames; i++) {
      const t = i / this.sampleRate;
      // Multiple sine waves for ambient texture
      const wave1 = Math.sin(2 * Math.PI * 80 * t) * 0.3;
      const wave2 = Math.sin(2 * Math.PI * 120 * t) * 0.2;
      const wave3 = Math.sin(2 * Math.PI * 160 * t) * 0.1;
      const noise = (Math.random() * 2 - 1) * 0.05;
      channelData[i] = (wave1 + wave2 + wave3 + noise) * volume;
    }

    return audioBuffer;
  }

  // Generate all test sounds and return them as a map
  generateTestSounds() {
    return new Map([
      ['click.wav', this.generateClick()],
      ['explosion.wav', this.generateExplosion()],
      ['jump.wav', this.generateJump()],
      ['ambient.wav', this.generateAmbient()],
      ['beep.wav', this.generateBeep()]
    ]);
  }
}