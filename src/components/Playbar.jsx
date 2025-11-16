import React from "react";
import * as THREE from 'three';
import { useSceneStore } from '../store/sceneStore';
import { usePlayStore } from '../store/playStore';
import { ExportGameButton } from './ExportGameButton';

export default function Playbar() {
  const { selectedObject } = useSceneStore();
  const { isPlaying } = usePlayStore();

  function AnimationControls() {
    if (!selectedObject) return <div className="text-xs text-gray-400">No selection</div>;
    const actions = selectedObject.userData?.actions || null;
    const mixer = selectedObject.userData?.mixer || null;
    const active = selectedObject.userData?._activeAction || null;

    const play = () => {
      try {
        if (!mixer && actions) {
          selectedObject.userData.mixer = new THREE.AnimationMixer(selectedObject);
        }
        const act = Object.values(selectedObject.userData.actions || {})[0];
        if (act) { act.play(); selectedObject.userData._activeAction = act; }
      } catch (err) { console.warn(err); }
    };
    const pause = () => { try { if (mixer) mixer.timeScale = mixer.timeScale === 0 ? 1 : 0; } catch (e) {} };
    const stop = () => { try { if (selectedObject.userData._activeAction) selectedObject.userData._activeAction.stop(); } catch (e) {} };

    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="text-gray-300">{selectedObject.name}</div>
        <button onClick={play} className="px-2 py-1 bg-green-600 rounded">Play</button>
        <button onClick={pause} className="px-2 py-1 bg-yellow-600 rounded">Pause</button>
        <button onClick={stop} className="px-2 py-1 bg-red-600 rounded">Stop</button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-white">
      <div className="flex items-center gap-4">
        <div className="text-sm">
          <span className="text-gray-400">FPS:</span>
          <span className="ml-1 font-mono">60</span>
        </div>
        <div className="text-sm">
          <span className="text-gray-400">Time:</span>
          <span className="ml-1 font-mono">00:00</span>
        </div>
        <div className="text-sm">
          <span className="text-gray-400">Objects:</span>
          <span className="ml-1 font-mono">5</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <ExportGameButton />
        <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
          Physics: On
        </button>
        <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
          Wireframe
        </button>
        <button className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">
          Stats
        </button>
      </div>

      {/* Animation quick controls for selected object */}
      <div className="flex-1 px-4">
        <div className="flex items-center justify-center gap-3">
          <AnimationControls />
        </div>
      </div>
      
      <div className="text-sm">
        <span className="text-gray-400">Project:</span>
        <span className="ml-1">MyPlatformer</span>
      </div>
    </div>
  );
}