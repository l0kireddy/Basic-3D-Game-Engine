import React, { useState } from 'react';
import { useAudioStore } from '../store/audioStore';

/**
 * AudioComponent - Component for managing audio properties of scene objects
 */
export const AudioComponent = ({ object, objectData, updateObjectData }) => {
  const {
    audioLibrary,
    playObjectSound,
    createObjectAudio,
    stopObjectSounds
  } = useAudioStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [testSound, setTestSound] = useState('');

  // Get current audio settings from object data
  const audioSettings = objectData?.audio || {
    enabled: false,
    soundOnCollision: '',
    ambientSound: '',
    volume: 1.0,
    loop: false,
    autoplay: false,
    refDistance: 1,
    rolloffFactor: 1,
    maxDistance: 1000
  };

  // Update audio settings
  const updateAudioSettings = (newSettings) => {
    const updatedData = {
      ...objectData,
      audio: { ...audioSettings, ...newSettings }
    };
    updateObjectData(object.uuid, updatedData);
  };

  // Test play a sound on the object
  const testPlaySound = (soundName) => {
    if (!soundName) return;
    
    playObjectSound(object, soundName, {
      volume: audioSettings.volume,
      refDistance: audioSettings.refDistance,
      rolloffFactor: audioSettings.rolloffFactor,
      maxDistance: audioSettings.maxDistance
    });
  };

  // Create ambient audio for the object
  const setupAmbientAudio = (soundName) => {
    if (!soundName) {
      stopObjectSounds(object);
      return;
    }

    // Remove existing ambient audio
    stopObjectSounds(object);

    // Create new ambient audio
    createObjectAudio(object, soundName, {
      volume: audioSettings.volume,
      loop: true,
      autoplay: audioSettings.autoplay,
      refDistance: audioSettings.refDistance,
      rolloffFactor: audioSettings.rolloffFactor,
      maxDistance: audioSettings.maxDistance
    });
  };

  // Get available sound names
  const availableSounds = Array.from(audioLibrary.keys());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300">🔊 Audio Component</h4>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={audioSettings.enabled}
            onChange={(e) => updateAudioSettings({ enabled: e.target.checked })}
            className="mr-2"
          />
          <span className="text-xs text-gray-400">Enable Audio</span>
        </label>
      </div>

      {audioSettings.enabled && (
        <div className="space-y-3 pl-4 border-l-2 border-blue-500">
          {/* Collision Sound */}
          <div>
            <label className="block text-gray-400 text-xs mb-1">
              Collision Sound
            </label>
            <select
              value={audioSettings.soundOnCollision}
              onChange={(e) => updateAudioSettings({ soundOnCollision: e.target.value })}
              className="w-full px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600"
            >
              <option value="">None</option>
              {availableSounds.map(sound => (
                <option key={sound} value={sound}>{sound}</option>
              ))}
            </select>
            {audioSettings.soundOnCollision && (
              <button
                onClick={() => testPlaySound(audioSettings.soundOnCollision)}
                className="mt-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                🔊 Test
              </button>
            )}
          </div>

          {/* Ambient Sound */}
          <div>
            <label className="block text-gray-400 text-xs mb-1">
              Ambient Sound
            </label>
            <select
              value={audioSettings.ambientSound}
              onChange={(e) => {
                const soundName = e.target.value;
                updateAudioSettings({ ambientSound: soundName });
                setupAmbientAudio(soundName);
              }}
              className="w-full px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600"
            >
              <option value="">None</option>
              {availableSounds.map(sound => (
                <option key={sound} value={sound}>{sound}</option>
              ))}
            </select>
          </div>

          {/* Volume Control */}
          <div>
            <label className="block text-gray-400 text-xs mb-1">
              Volume: {Math.round(audioSettings.volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audioSettings.volume}
              onChange={(e) => updateAudioSettings({ volume: parseFloat(e.target.value) })}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Auto-play for ambient */}
          {audioSettings.ambientSound && (
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={audioSettings.autoplay}
                  onChange={(e) => {
                    const autoplay = e.target.checked;
                    updateAudioSettings({ autoplay });
                    if (audioSettings.ambientSound) {
                      setupAmbientAudio(audioSettings.ambientSound);
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-xs text-gray-400">Auto-play ambient</span>
              </label>
            </div>
          )}

          {/* Advanced Settings */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-gray-400 text-xs hover:text-white"
            >
              {showAdvanced ? '▼' : '▶'} 3D Audio Settings
            </button>

            {showAdvanced && (
              <div className="mt-2 space-y-2 p-2 bg-gray-900 rounded border border-gray-700">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">
                    Reference Distance: {audioSettings.refDistance}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={audioSettings.refDistance}
                    onChange={(e) => updateAudioSettings({ refDistance: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Distance at which volume is 50%
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-xs mb-1">
                    Rolloff Factor: {audioSettings.rolloffFactor}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.1"
                    value={audioSettings.rolloffFactor}
                    onChange={(e) => updateAudioSettings({ rolloffFactor: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    How quickly sound fades with distance
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-xs mb-1">
                    Max Distance: {audioSettings.maxDistance}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="2000"
                    step="10"
                    value={audioSettings.maxDistance}
                    onChange={(e) => updateAudioSettings({ maxDistance: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Maximum distance audio can be heard
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-700">
            <button
              onClick={() => stopObjectSounds(object)}
              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
            >
              🔇 Stop All
            </button>
            
            {/* Test Sound Selector */}
            <div className="flex gap-1 flex-1">
              <select
                value={testSound}
                onChange={(e) => setTestSound(e.target.value)}
                className="flex-1 px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600"
              >
                <option value="">Select test sound...</option>
                {availableSounds.map(sound => (
                  <option key={sound} value={sound}>{sound}</option>
                ))}
              </select>
              <button
                onClick={() => testPlaySound(testSound)}
                disabled={!testSound}
                className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
              >
                ▶️
              </button>
            </div>
          </div>

          {/* Info */}
          {audioLibrary.size === 0 && (
            <div className="text-yellow-400 text-xs p-2 bg-yellow-900 bg-opacity-30 rounded">
              ⚠️ No audio files loaded. Use Audio Controls panel to load sounds.
            </div>
          )}
        </div>
      )}
    </div>
  );
};