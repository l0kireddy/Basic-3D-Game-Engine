import React from 'react';
import { usePostProcessingStore } from '../store/postProcessingStore';
import { useSceneStore } from '../store/sceneStore';

export function PostProcessingInspector() {
  const { bloom, ssao, setBloomEnabled, setBloomSettings, setSSAOEnabled, setSSAOSettings } = usePostProcessingStore();
  const { scene } = useSceneStore();

  // Get the scene viewport state to access passes
  const updatePasses = () => {
    // This will be called from SceneViewport through a ref or effect
    console.log('Post-processing settings updated');
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">✨ Post-Processing</h3>
      
      {/* Bloom Effect */}
      <div className="space-y-3 p-3 bg-gray-750 rounded border border-gray-700">
        <div className="flex items-center justify-between">
          <label className="text-white font-medium flex items-center gap-2">
            <span>💫 Bloom</span>
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={bloom.enabled}
              onChange={(e) => setBloomEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        {bloom.enabled && (
          <div className="space-y-2 pl-2">
            <div>
              <label className="text-xs text-gray-400">Strength</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={bloom.strength}
                  onChange={(e) => setBloomSettings({ strength: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-white text-xs w-12 text-right">{bloom.strength.toFixed(1)}</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400">Radius</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bloom.radius}
                  onChange={(e) => setBloomSettings({ radius: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-white text-xs w-12 text-right">{bloom.radius.toFixed(2)}</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400">Threshold</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bloom.threshold}
                  onChange={(e) => setBloomSettings({ threshold: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-white text-xs w-12 text-right">{bloom.threshold.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* SSAO Effect */}
      <div className="space-y-3 p-3 bg-gray-750 rounded border border-gray-700">
        <div className="flex items-center justify-between">
          <label className="text-white font-medium flex items-center gap-2">
            <span>🌫️ Ambient Occlusion (SSAO)</span>
          </label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={ssao.enabled}
              onChange={(e) => setSSAOEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        {ssao.enabled && (
          <div className="space-y-2 pl-2">
            <div>
              <label className="text-xs text-gray-400">Kernel Radius</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="32"
                  step="1"
                  value={ssao.kernelRadius}
                  onChange={(e) => setSSAOSettings({ kernelRadius: parseInt(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-white text-xs w-12 text-right">{ssao.kernelRadius}</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400">Min Distance</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.001"
                  max="0.02"
                  step="0.001"
                  value={ssao.minDistance}
                  onChange={(e) => setSSAOSettings({ minDistance: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-white text-xs w-12 text-right">{ssao.minDistance.toFixed(3)}</span>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-gray-400">Max Distance</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={ssao.maxDistance}
                  onChange={(e) => setSSAOSettings({ maxDistance: parseFloat(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-white text-xs w-12 text-right">{ssao.maxDistance.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="text-xs text-gray-500 mt-4 p-2 bg-gray-900 rounded">
        <p>💡 <strong>Bloom:</strong> Makes bright areas glow</p>
        <p>💡 <strong>SSAO:</strong> Adds depth with ambient shadows</p>
      </div>
    </div>
  );
}
