import React, { useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { usePlayStore } from '../store/playStore';

export default function PhysicsDebugger() {
  const { physicsWorld, objects, enablePhysics, disablePhysics, stepPhysics, resetPhysics } = useSceneStore();
  const { isPlaying } = usePlayStore();

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying) {
        console.log('🔍 Physics Debug Info:');
        console.log('- Physics World Enabled:', physicsWorld?.enabled);
        console.log('- Physics Bodies Count:', physicsWorld?.bodies?.size || 0);
        console.log('- Scene Objects Count:', objects?.size || 0);
        console.log('- Is Playing:', isPlaying);
        
        // List objects with physics
        if (objects) {
          objects.forEach((obj, id) => {
            if (obj.physics?.enabled) {
              console.log(`- Object ${obj.name}: Physics enabled, type: ${obj.physics.bodyType}`);
            }
          });
        }
      }
    }, 2000); // Log every 2 seconds when playing

    return () => clearInterval(interval);
  }, [isPlaying, physicsWorld, objects]);

  const handleManualPhysicsTest = () => {
    console.log('🧪 Manual Physics Test Started');
    
    // Show detailed debug info first
    console.log('=== DETAILED PHYSICS DEBUG ===');
    console.log('Objects in store:', objects?.size || 0);
    
    if (objects) {
      objects.forEach((obj, id) => {
        console.log(`Object: ${obj.name} (${id})`);
        console.log('- Type:', obj.type);
        console.log('- Physics:', obj.physics);
        console.log('- Physics enabled:', obj.physics?.enabled);
      });
    }
    
    console.log('Physics World Bodies:', physicsWorld?.bodies?.size || 0);
    console.log('Physics World Enabled:', physicsWorld?.enabled);
    
    // First reset physics to current visual positions
    resetPhysics();
    
    // Enable physics
    enablePhysics();
    
    // Try to manually activate physics bodies
    const { activateAllPhysicsBodies } = useSceneStore.getState();
    activateAllPhysicsBodies();
    
    console.log('After activation - Bodies:', physicsWorld?.bodies?.size || 0);
    
    // Manual step test
    for (let i = 0; i < 120; i++) { // 2 seconds at 60 FPS
      setTimeout(() => {
        stepPhysics(1/60); // 60 FPS
        if (i % 30 === 0) console.log(`Physics step ${i + 1}/120`);
      }, i * 16); // ~60 FPS timing
    }
    
    // Stop after test
    setTimeout(() => {
      disablePhysics();
      console.log('🧪 Manual Physics Test Complete');
    }, 120 * 16 + 100);
  };

  const handleResetPhysics = () => {
    resetPhysics();
    console.log('🔄 Physics Reset to Visual Positions');
  };

  const handleForcePhysicsOnCube = () => {
    console.log('🔧 Force Physics on Cube Test');
    
    // Get the scene store
    const sceneStore = useSceneStore.getState();
    const { scene, physicsWorld } = sceneStore;
    
    if (scene) {
      // Find the demo cube
      const cube = scene.getObjectByName('DemoCube');
      if (cube) {
        console.log('Found DemoCube:', cube);
        
        // Force enable physics on this cube
        const bodyOptions = {
          type: 'box',
          mass: 1,
          size: { x: 1, y: 1, z: 1 }
        };
        
        // Remove existing body if any
        physicsWorld.removeBody(cube);
        
        // Add new physics body
        physicsWorld.addBody(cube, bodyOptions);
        console.log('Added physics body to cube');
        
        // Enable physics world
        physicsWorld.setEnabled(true);
        console.log('Physics world enabled');
        
        // Test physics for a few seconds with detailed logging
        console.log('Initial cube position:', cube.position);
        
        for (let i = 0; i < 180; i++) { // 3 seconds
          setTimeout(() => {
            physicsWorld.step(1/60);
            
            // Log position every second
            if (i % 60 === 0) {
              const body = physicsWorld.getBody(cube);
              console.log(`Step ${i/60 + 1}/3:`);
              console.log('- Cube visual position:', cube.position);
              console.log('- Physics body position:', body ? body.position : 'No body');
              console.log('- Bodies in physics world:', physicsWorld.bodies.size);
            }
          }, i * 16);
        }
        
        setTimeout(() => {
          physicsWorld.setEnabled(false);
          console.log('Force physics test complete');
        }, 180 * 16 + 100);
        
      } else {
        console.error('DemoCube not found in scene');
      }
    } else {
      console.error('Scene not available');
    }
  };

  return (
    <div className="bg-red-900 text-white p-2 text-xs">
      <div className="font-bold mb-1">Physics Debugger</div>
      <div>Playing: {isPlaying ? 'YES' : 'NO'}</div>
      <div>Physics Enabled: {physicsWorld?.enabled ? 'YES' : 'NO'}</div>
      <div>Bodies: {physicsWorld?.bodies?.size || 0}</div>
      <div className="flex gap-1 mt-1">
        <button 
          className="px-2 py-1 bg-red-700 rounded text-xs"
          onClick={handleManualPhysicsTest}
        >
          Test Physics
        </button>
        <button 
          className="px-2 py-1 bg-blue-700 rounded text-xs"
          onClick={handleResetPhysics}
        >
          Reset
        </button>
        <button 
          className="px-2 py-1 bg-green-700 rounded text-xs"
          onClick={handleForcePhysicsOnCube}
        >
          Force Cube
        </button>
      </div>
    </div>
  );
}