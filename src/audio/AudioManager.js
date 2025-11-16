import * as THREE from 'three';

/**
 * AudioManager - Handles all audio functionality in the 3D engine
 * Features: 3D spatial audio, sound effects, background music, audio components
 */
export class AudioManager {
  constructor() {
    // Create audio listener
    this.listener = new THREE.AudioListener();
    this.audioLoader = new THREE.AudioLoader();
    
    // Audio context and master controls
    this.context = null;
    this.masterVolume = 1.0;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.6;
    
    // Audio storage
    this.loadedSounds = new Map(); // filename -> AudioBuffer
    this.activeSounds = new Map(); // object -> audio instances
    this.backgroundMusic = null;
    
    // Initialize audio context
    this.initAudioContext();
    
    console.log('🔊 AudioManager initialized');
  }

  /**
   * Initialize Web Audio API context
   */
  initAudioContext() {
    try {
      // Get audio context from THREE.js AudioListener
      this.context = this.listener.context;
      
      // Handle audio context suspension (browser autoplay policy)
      if (this.context.state === 'suspended') {
        console.log('🔇 Audio context suspended - will resume on user interaction');
        this.setupUserInteractionResume();
      }
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
    }
  }

  /**
   * Setup audio context resume on user interaction (required by browsers)
   */
  setupUserInteractionResume() {
    const resumeAudio = () => {
      if (this.context.state === 'suspended') {
        this.context.resume().then(() => {
          console.log('🔊 Audio context resumed');
          document.removeEventListener('click', resumeAudio);
          document.removeEventListener('keydown', resumeAudio);
        });
      }
    };
    
    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);
  }

  /**
   * Attach audio listener to camera
   */
  attachToCamera(camera) {
    camera.add(this.listener);
    console.log('🎧 Audio listener attached to camera');
  }

  /**
   * Load audio file and store it
   */
  async loadSound(filename, url) {
    return new Promise((resolve, reject) => {
      if (this.loadedSounds.has(filename)) {
        console.log(`🔊 Sound already loaded: ${filename}`);
        resolve(this.loadedSounds.get(filename));
        return;
      }

      console.log(`📥 Loading sound: ${filename}`);
      this.audioLoader.load(
        url,
        (audioBuffer) => {
          this.loadedSounds.set(filename, audioBuffer);
          console.log(`✅ Sound loaded: ${filename}`);
          resolve(audioBuffer);
        },
        (progress) => {
          console.log(`📈 Loading ${filename}: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
        },
        (error) => {
          console.error(`❌ Failed to load sound ${filename}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Create positional audio for a 3D object
   */
  createPositionalAudio(object, soundName, options = {}) {
    const {
      volume = 1.0,
      loop = false,
      autoplay = false,
      refDistance = 1,
      rolloffFactor = 1,
      maxDistance = 1000
    } = options;

    if (!this.loadedSounds.has(soundName)) {
      console.warn(`⚠️ Sound not loaded: ${soundName}`);
      return null;
    }

    const audioBuffer = this.loadedSounds.get(soundName);
    const positionalAudio = new THREE.PositionalAudio(this.listener);
    
    // Configure audio properties
    positionalAudio.setBuffer(audioBuffer);
    positionalAudio.setVolume(volume * this.sfxVolume * this.masterVolume);
    positionalAudio.setLoop(loop);
    positionalAudio.setRefDistance(refDistance);
    positionalAudio.setRolloffFactor(rolloffFactor);
    positionalAudio.setMaxDistance(maxDistance);

    // Attach to object
    object.add(positionalAudio);

    // Store reference
    if (!this.activeSounds.has(object)) {
      this.activeSounds.set(object, []);
    }
    this.activeSounds.get(object).push(positionalAudio);

    if (autoplay) {
      positionalAudio.play();
    }

    console.log(`🔊 Created positional audio for ${object.name}: ${soundName}`);
    return positionalAudio;
  }

  /**
   * Create non-positional audio (UI sounds, music)
   */
  createAudio(soundName, options = {}) {
    const {
      volume = 1.0,
      loop = false,
      autoplay = false
    } = options;

    if (!this.loadedSounds.has(soundName)) {
      console.warn(`⚠️ Sound not loaded: ${soundName}`);
      return null;
    }

    const audioBuffer = this.loadedSounds.get(soundName);
    const audio = new THREE.Audio(this.listener);
    
    // Configure audio properties
    audio.setBuffer(audioBuffer);
    audio.setVolume(volume * this.sfxVolume * this.masterVolume);
    audio.setLoop(loop);

    if (autoplay) {
      audio.play();
    }

    console.log(`🔊 Created audio: ${soundName}`);
    return audio;
  }

  /**
   * Play background music
   */
  playBackgroundMusic(soundName, options = {}) {
    const { volume = 1.0, fadeIn = false, fadeTime = 1000 } = options;

    // Stop current background music
    if (this.backgroundMusic) {
      this.stopBackgroundMusic();
    }

    // Create new background music
    this.backgroundMusic = this.createAudio(soundName, {
      volume: volume * this.musicVolume,
      loop: true,
      autoplay: true
    });

    if (fadeIn && this.backgroundMusic) {
      // Fade in effect
      this.backgroundMusic.setVolume(0);
      this.fadeVolume(this.backgroundMusic, volume * this.musicVolume, fadeTime);
    }

    console.log(`🎵 Playing background music: ${soundName}`);
    return this.backgroundMusic;
  }

  /**
   * Stop background music
   */
  stopBackgroundMusic(fadeOut = false, fadeTime = 1000) {
    if (!this.backgroundMusic) return;

    if (fadeOut) {
      this.fadeVolume(this.backgroundMusic, 0, fadeTime, () => {
        this.backgroundMusic.stop();
        this.backgroundMusic = null;
      });
    } else {
      this.backgroundMusic.stop();
      this.backgroundMusic = null;
    }

    console.log('🔇 Background music stopped');
  }

  /**
   * Fade audio volume over time
   */
  fadeVolume(audio, targetVolume, duration, callback = null) {
    const startVolume = audio.getVolume();
    const startTime = Date.now();

    const fade = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const currentVolume = startVolume + (targetVolume - startVolume) * progress;
      audio.setVolume(currentVolume);

      if (progress < 1) {
        requestAnimationFrame(fade);
      } else if (callback) {
        callback();
      }
    };

    fade();
  }

  /**
   * Play sound effect on object
   */
  playSoundEffect(object, soundName, options = {}) {
    const audio = this.createPositionalAudio(object, soundName, {
      ...options,
      autoplay: true
    });

    // Auto-remove after playback if not looping
    if (audio && !options.loop) {
      audio.onEnded = () => {
        this.removeAudioFromObject(object, audio);
      };
    }

    return audio;
  }

  /**
   * Remove audio from object
   */
  removeAudioFromObject(object, audio) {
    if (this.activeSounds.has(object)) {
      const sounds = this.activeSounds.get(object);
      const index = sounds.indexOf(audio);
      if (index > -1) {
        sounds.splice(index, 1);
        object.remove(audio);
        
        if (sounds.length === 0) {
          this.activeSounds.delete(object);
        }
      }
    }
  }

  /**
   * Stop all sounds on an object
   */
  stopObjectSounds(object) {
    if (this.activeSounds.has(object)) {
      const sounds = this.activeSounds.get(object);
      sounds.forEach(audio => {
        audio.stop();
        object.remove(audio);
      });
      this.activeSounds.delete(object);
      console.log(`🔇 Stopped all sounds on ${object.name}`);
    }
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
    console.log(`🔊 Master volume set to ${(this.masterVolume * 100).toFixed(0)}%`);
  }

  /**
   * Set SFX volume
   */
  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
    console.log(`🔊 SFX volume set to ${(this.sfxVolume * 100).toFixed(0)}%`);
  }

  /**
   * Set music volume
   */
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.backgroundMusic) {
      this.backgroundMusic.setVolume(this.musicVolume * this.masterVolume);
    }
    console.log(`🎵 Music volume set to ${(this.musicVolume * 100).toFixed(0)}%`);
  }

  /**
   * Update all active sound volumes
   */
  updateAllVolumes() {
    this.activeSounds.forEach((sounds, object) => {
      sounds.forEach(audio => {
        const baseVolume = audio.userData?.baseVolume || 1.0;
        audio.setVolume(baseVolume * this.sfxVolume * this.masterVolume);
      });
    });

    if (this.backgroundMusic) {
      const baseVolume = this.backgroundMusic.userData?.baseVolume || 1.0;
      this.backgroundMusic.setVolume(baseVolume * this.musicVolume * this.masterVolume);
    }
  }

  /**
   * Get audio stats for debugging
   */
  getStats() {
    return {
      loadedSounds: this.loadedSounds.size,
      activeObjects: this.activeSounds.size,
      totalActiveSounds: Array.from(this.activeSounds.values()).reduce((total, sounds) => total + sounds.length, 0),
      hasBackgroundMusic: !!this.backgroundMusic,
      contextState: this.context?.state,
      masterVolume: this.masterVolume,
      sfxVolume: this.sfxVolume,
      musicVolume: this.musicVolume
    };
  }

  /**
   * Clean up all audio
   */
  dispose() {
    // Stop all sounds
    this.activeSounds.forEach((sounds, object) => {
      this.stopObjectSounds(object);
    });

    // Stop background music
    this.stopBackgroundMusic();

    // Clear loaded sounds
    this.loadedSounds.clear();

    console.log('🗑️ AudioManager disposed');
  }
}