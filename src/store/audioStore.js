import { create } from 'zustand';
import { AudioManager } from '../audio/AudioManager.js';

/**
 * Audio Store - Manages audio state and provides audio controls
 */
export const useAudioStore = create((set, get) => ({
  // Audio manager instance
  audioManager: new AudioManager(),
  
  // Audio settings
  masterVolume: 1.0,
  sfxVolume: 0.8,
  musicVolume: 0.6,
  isMuted: false,
  
  // Current background music
  currentMusic: null,
  
  // Audio library (loaded sounds)
  audioLibrary: new Map(),
  
  // Loading state
  isLoading: false,
  loadingProgress: 0,

  /**
   * Initialize audio system with camera
   */
  initAudio: (camera) => {
    const { audioManager } = get();
    audioManager.attachToCamera(camera);
    console.log('🎧 Audio system initialized');
  },

  /**
   * Load audio file
   */
  loadAudio: async (filename, url) => {
    const { audioManager, audioLibrary } = get();
    
    set({ isLoading: true });
    
    try {
      const audioBuffer = await audioManager.loadSound(filename, url);
      const newLibrary = new Map(audioLibrary);
      newLibrary.set(filename, {
        buffer: audioBuffer,
        url: url,
        loadedAt: Date.now()
      });
      
      set({ 
        audioLibrary: newLibrary,
        isLoading: false 
      });
      
      return audioBuffer;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Load multiple audio files
   */
  loadAudioBatch: async (audioFiles) => {
    const { loadAudio } = get();
    const promises = audioFiles.map(({ filename, url }) => loadAudio(filename, url));
    
    try {
      await Promise.all(promises);
      console.log(`✅ Loaded ${audioFiles.length} audio files`);
    } catch (error) {
      console.error('❌ Failed to load audio batch:', error);
      throw error;
    }
  },

  /**
   * Play sound effect on object
   */
  playObjectSound: (object, soundName, options = {}) => {
    const { audioManager } = get();
    return audioManager.playSoundEffect(object, soundName, options);
  },

  /**
   * Create positional audio for object
   */
  createObjectAudio: (object, soundName, options = {}) => {
    const { audioManager } = get();
    return audioManager.createPositionalAudio(object, soundName, options);
  },

  /**
   * Play background music
   */
  playMusic: (soundName, options = {}) => {
    const { audioManager } = get();
    const music = audioManager.playBackgroundMusic(soundName, options);
    set({ currentMusic: soundName });
    return music;
  },

  /**
   * Stop background music
   */
  stopMusic: (fadeOut = true) => {
    const { audioManager } = get();
    audioManager.stopBackgroundMusic(fadeOut);
    set({ currentMusic: null });
  },

  /**
   * Stop all sounds on object
   */
  stopObjectSounds: (object) => {
    const { audioManager } = get();
    audioManager.stopObjectSounds(object);
  },

  /**
   * Set master volume
   */
  setMasterVolume: (volume) => {
    const { audioManager } = get();
    audioManager.setMasterVolume(volume);
    set({ masterVolume: volume });
  },

  /**
   * Set SFX volume
   */
  setSFXVolume: (volume) => {
    const { audioManager } = get();
    audioManager.setSFXVolume(volume);
    set({ sfxVolume: volume });
  },

  /**
   * Set music volume
   */
  setMusicVolume: (volume) => {
    const { audioManager } = get();
    audioManager.setMusicVolume(volume);
    set({ musicVolume: volume });
  },

  /**
   * Toggle mute/unmute
   */
  toggleMute: () => {
    const { isMuted, masterVolume, audioManager } = get();
    
    if (isMuted) {
      // Unmute
      audioManager.setMasterVolume(masterVolume);
      set({ isMuted: false });
    } else {
      // Mute
      audioManager.setMasterVolume(0);
      set({ isMuted: true });
    }
  },

  /**
   * Get audio statistics
   */
  getAudioStats: () => {
    const { audioManager } = get();
    return audioManager.getStats();
  },

  /**
   * Dispose audio system
   */
  disposeAudio: () => {
    const { audioManager } = get();
    audioManager.dispose();
  }
}));