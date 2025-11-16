import React from 'react';
import { useSceneStore } from '../store/sceneStore';
import { usePlayStore } from '../store/playStore';

export default function PhysicsControls() {
  const { enablePhysics, disablePhysics, setGravity, addGroundPlane } = useSceneStore();
  const { isPlaying } = usePlayStore();

  const handleGravityChange = (axis, value) => {
    const gravity = { x: 0, y: -9.82, z: 0 };
    gravity[axis] = parseFloat(value) || 0;
    setGravity(gravity.x, gravity.y, gravity.z);
  };

  const handleAddGroundPlane = () => {
    addGroundPlane(0);
    console.log('Added physics ground plane');
  };

  return (
    <div className="bg-gray-800 border-t border-gray-700 p-2">
      <div className="flex items-center gap-4 text-xs">
        <div className="text-gray-400 font-semibold">Physics:</div>
        
        <button 
          className={`px-2 py-1 rounded text-xs ${
            isPlaying 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
          onClick={isPlaying ? enablePhysics : () => console.log('Start playing to enable physics')}
          disabled={!isPlaying}
        >
          {isPlaying ? 'Physics On' : 'Physics (Play to Enable)'}
        </button>

        <div className="flex items-center gap-1">
          <span className="text-gray-400">Gravity Y:</span>
          <input 
            type="number" 
            step="0.1"
            defaultValue="-9.82"
            className="w-16 bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs" 
            onChange={(e) => handleGravityChange('y', e.target.value)}
          />
        </div>

        <button 
          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          onClick={handleAddGroundPlane}
        >
          Add Ground Plane
        </button>

        <div className="text-gray-500 text-xs">
          Enable physics on objects in Inspector panel
        </div>
      </div>
    </div>
  );
}