import { create } from 'zustand';

export const usePostProcessingStore = create((set) => ({
  // Bloom settings
  bloom: {
    enabled: false,
    strength: 0.5,
    radius: 0.4,
    threshold: 0.85
  },
  
  // SSAO settings
  ssao: {
    enabled: false,
    kernelRadius: 16,
    minDistance: 0.005,
    maxDistance: 0.1,
    intensity: 1.0
  },
  
  // Actions
  setBloomEnabled: (enabled) => set((state) => ({
    bloom: { ...state.bloom, enabled }
  })),
  
  setBloomSettings: (settings) => set((state) => ({
    bloom: { ...state.bloom, ...settings }
  })),
  
  setSSAOEnabled: (enabled) => set((state) => ({
    ssao: { ...state.ssao, enabled }
  })),
  
  setSSAOSettings: (settings) => set((state) => ({
    ssao: { ...state.ssao, ...settings }
  })),
  
  // Export all settings
  exportSettings: () => {
    const state = usePostProcessingStore.getState();
    return {
      bloom: { ...state.bloom },
      ssao: { ...state.ssao }
    };
  },
  
  // Import settings
  importSettings: (settings) => {
    if (settings.bloom) {
      set((state) => ({ bloom: { ...state.bloom, ...settings.bloom } }));
    }
    if (settings.ssao) {
      set((state) => ({ ssao: { ...state.ssao, ...settings.ssao } }));
    }
  }
}));
