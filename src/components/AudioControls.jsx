import React, { useState, useEffect } from 'react';
import { useAudioStore } from '../store/audioStore';
import { AudioGenerator } from '../audio/AudioGenerator';

/**
 * AudioControls - UI component for managing audio settings and playback
 */
export const AudioControls = () => {
  const {
    masterVolume,
    sfxVolume,
    musicVolume,
    isMuted,
    currentMusic,
    audioLibrary,
    isLoading,
    setMasterVolume,
    setSFXVolume,
    setMusicVolume,
    toggleMute,
    playMusic,
    stopMusic,
    loadAudio,
    getAudioStats
  } = useAudioStore();

  const [audioStats, setAudioStats] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update audio stats periodically
  useEffect(() => {
    const updateStats = () => {
      setAudioStats(getAudioStats());
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [getAudioStats]);

  // Generate test sounds using AudioGenerator
  const generateTestSounds = async () => {
    try {
      console.log('🎵 Generating test audio sounds...');
      
      const generator = new AudioGenerator();
      const testSounds = generator.generateTestSounds();
      
      // Load each generated sound into the audio system
      let loadedCount = 0;
      for (const [filename, audioBuffer] of testSounds) {
        try {
          // Directly add to audio manager
          audioManager.loadedSounds.set(filename, audioBuffer);
          
          // Update the store using the audioStore method
          const audioStore = useAudioStore.getState();
          const newLibrary = new Map(audioStore.audioLibrary);
          newLibrary.set(filename, {
            buffer: audioBuffer,
            url: 'generated',
            loadedAt: Date.now()
          });
          
          // Use the store's setState to update
          useAudioStore.setState({ audioLibrary: newLibrary });
          loadedCount++;
          console.log(`✅ Generated ${filename}`);
        } catch (error) {
          console.error(`Failed to generate ${filename}:`, error);
        }
      }
      
      alert(`🎵 Generated ${loadedCount} test sounds!\nYou can now use them in the Audio Components.`);
      
    } catch (error) {
      console.error('Failed to generate test sounds:', error);
      alert('Error generating test sounds. Check console for details.');
    }
  };

  // Load audio files from public folder
  const loadDefaultAudio = async () => {
    try {
      console.log('📁 Loading default audio files...');
      
      // Example audio files that you can add to public/audio/
      const defaultAudio = [
        { filename: 'click.mp3', url: '/audio/click.mp3' },
        { filename: 'explosion.mp3', url: '/audio/explosion.mp3' },
        { filename: 'ambient.mp3', url: '/audio/ambient.mp3' },
        { filename: 'jump.mp3', url: '/audio/jump.mp3' }
      ];

      // Try to load each audio file
      const loadPromises = defaultAudio.map(async ({ filename, url }) => {
        try {
          await loadAudio(filename, url);
          return { filename, success: true };
        } catch (error) {
          console.warn(`Failed to load ${filename}:`, error);
          return { filename, success: false, error };
        }
      });

      const results = await Promise.all(loadPromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length > 0) {
        alert(`✅ Loaded ${successful.length} audio files:\n${successful.map(r => r.filename).join(', ')}`);
      }
      
      if (failed.length > 0) {
        alert(`⚠️ Failed to load ${failed.length} files:\n${failed.map(r => r.filename).join(', ')}\n\nAdd these files to public/audio/ folder to use them.`);
      }
      
    } catch (error) {
      console.error('Failed to load default audio:', error);
      alert('Error loading audio files. Check console for details.');
    }
  };

  // Load audio from file input
  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      // Check if it's an audio file
      if (!file.type.startsWith('audio/')) {
        alert(`${file.name} is not an audio file!`);
        return;
      }

      // Create a URL for the file
      const url = URL.createObjectURL(file);
      const filename = file.name;

      // Load the audio
      loadAudio(filename, url)
        .then(() => {
          console.log(`✅ Loaded ${filename} from file upload`);
        })
        .catch(error => {
          console.error(`Failed to load ${filename}:`, error);
          alert(`Failed to load ${filename}: ${error.message}`);
        });
    });

    // Clear the input
    event.target.value = '';
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
      <h3 className="text-white text-lg font-semibold mb-4 flex items-center">
        🔊 Audio Controls
        <button
          onClick={toggleMute}
          className={`ml-2 px-2 py-1 rounded text-xs ${
            isMuted ? 'bg-red-600 text-white' : 'bg-gray-600 text-gray-300'
          }`}
        >
          {isMuted ? '🔇 MUTED' : '🔊'}
        </button>
      </h3>

      {/* Volume Controls */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Master Volume: {Math.round(masterVolume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-gray-300 text-sm mb-1">
            SFX Volume: {Math.round(sfxVolume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sfxVolume}
            onChange={(e) => setSFXVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-gray-300 text-sm mb-1">
            Music Volume: {Math.round(musicVolume * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={musicVolume}
            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Music Controls */}
      <div className="mb-4">
        <h4 className="text-gray-300 text-sm font-medium mb-2">Background Music</h4>
        <div className="flex gap-2">
          <button
            onClick={() => playMusic('ambient', { fadeIn: true })}
            disabled={currentMusic === 'ambient'}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50"
          >
            🎵 Play Ambient
          </button>
          <button
            onClick={() => stopMusic(true)}
            disabled={!currentMusic}
            className="px-3 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-50"
          >
            ⏹️ Stop
          </button>
        </div>
        {currentMusic && (
          <div className="text-green-400 text-xs mt-1">
            ♪ Playing: {currentMusic}
          </div>
        )}
      </div>

      {/* Audio Library */}
      <div className="mb-4">
        <h4 className="text-gray-300 text-sm font-medium mb-2">
          Audio Library ({audioLibrary.size} files)
        </h4>
        
        <div className="flex gap-2 mb-2">
          <button
            onClick={generateTestSounds}
            disabled={isLoading}
            className="px-3 py-1 bg-purple-600 text-white rounded text-xs disabled:opacity-50 hover:bg-purple-700"
          >
            🎵 Generate Test Sounds
          </button>
          
          <button
            onClick={loadDefaultAudio}
            disabled={isLoading}
            className="px-3 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50 hover:bg-green-700"
          >
            {isLoading ? '📥 Loading...' : '📁 Load Files'}
          </button>
          
          <label className="px-3 py-1 bg-blue-600 text-white rounded text-xs cursor-pointer hover:bg-blue-700">
            📤 Upload
            <input
              type="file"
              multiple
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {audioLibrary.size > 0 && (
          <div className="mt-2 max-h-20 overflow-y-auto">
            {Array.from(audioLibrary.keys()).map(filename => (
              <div key={filename} className="text-gray-400 text-xs flex justify-between items-center">
                <span>• {filename}</span>
                <button
                  onClick={() => {
                    // Test play the sound
                    import('../store/audioStore').then(({ useAudioStore }) => {
                      const audioStore = useAudioStore.getState();
                      const audio = audioStore.audioManager.createAudio(filename, { autoplay: true });
                      if (!audio) {
                        alert(`Failed to play ${filename}`);
                      }
                    });
                  }}
                  className="text-blue-400 hover:text-blue-300 ml-2"
                  title="Test play"
                >
                  ▶️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Settings */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-gray-400 text-xs hover:text-white"
        >
          {showAdvanced ? '▼' : '▶'} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="mt-2 p-2 bg-gray-900 rounded border border-gray-700">
            <div className="text-gray-400 text-xs space-y-1">
              <div>Context: {audioStats.contextState || 'Unknown'}</div>
              <div>Loaded Sounds: {audioStats.loadedSounds || 0}</div>
              <div>Active Objects: {audioStats.activeObjects || 0}</div>
              <div>Active Sounds: {audioStats.totalActiveSounds || 0}</div>
              <div>Background Music: {audioStats.hasBackgroundMusic ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-4 p-2 bg-blue-900 bg-opacity-30 rounded border border-blue-600">
        <div className="text-blue-300 text-xs">
          💡 <strong>How to add audio:</strong>
          <br />• 🎵 <strong>Generate Test Sounds</strong> - Creates demo sounds instantly
          <br />• 📤 <strong>Upload</strong> - Add your own .mp3/.wav files
          <br />• 📁 <strong>Load Files</strong> - Load from public/audio/ folder
          <br />• Use sounds in Inspector → Audio Component
          <br />• Click anywhere first to enable audio (browser requirement)
        </div>
      </div>
    </div>
  );
};