import { create } from 'zustand';
import * as THREE from 'three';
import { autoDetectCollisionShape, autoDetectCharacterCollision } from '../utils/physicsShapeDetection';

// Store reference will be set during initialization
let sceneStoreRef = null;

export const setSceneStoreRef = (storeRef) => {
  sceneStoreRef = storeRef;
};

export const usePlayStore = create((set, get) => ({
  isPlaying: false,
  isPaused: false,
  
  play: () => {
    console.log('🎮 Play mode starting - creating physics bodies first...');
    
    // Create physics bodies BEFORE setting isPlaying = true
    if (sceneStoreRef) {
      const sceneStore = sceneStoreRef.getState();
      // Suppress any accidental writes to collisionFrames while we create bodies
      try { sceneStore.setSuppressCollisionFrameUpdates && sceneStore.setSuppressCollisionFrameUpdates(true); } catch (err) { /* ignore */ }
      const { scene, physicsWorld, objects } = sceneStore;
      
      if (scene) {
        console.log('🔧 Enabling physics only for objects with physics.enabled = true...');
        console.log(`🔍 Total objects in scene store: ${objects.size}`);
        
        // Log all objects to see what we have
        objects.forEach((objectData, uuid) => {
          console.log(`🔍 Object ${uuid.substr(0,8)} (${objectData.name || 'unnamed'}):`, {
            hasPhysics: !!objectData.physics,
            physicsEnabled: objectData.physics?.enabled,
            isPlayer: objectData.isPlayer,
            type: objectData.type,
            hasCollisionFrames: !!(objectData.collisionFrames && objectData.collisionFrames.length > 0)
          });
        });
        
        let activatedCount = 0;
        
        // Check each object in the store to see if it has physics enabled (objects is a Map)
        objects.forEach((objectData, uuid) => {
          if (objectData.physics && objectData.physics.enabled) {
            console.log(`🎯 Processing object with physics enabled: ${objectData.name || 'unnamed'} (${uuid.substr(0,8)})`);
            
            // Special logging for Soldier
            if (objectData.name === 'Soldier' || objectData.isPlayer) {
              console.log(`🎮 SOLDIER FOUND in store:`, {
                name: objectData.name,
                uuid: uuid.substr(0,8),
                physicsEnabled: objectData.physics.enabled,
                isPlayer: objectData.isPlayer,
                hasCollisionFrames: !!(objectData.collisionFrames && objectData.collisionFrames.length > 0),
                collisionFrameCount: objectData.collisionFrames?.length || 0
              });
            }
            // Find the actual Three.js object in the scene
            let threeObject = null;
            scene.traverse((object) => {
              if (object.uuid === uuid) {
                threeObject = object;
              }
            });

            if (!threeObject) {
              console.warn(`⚠️ Could not find Three.js object for UUID: ${uuid}`);
              return;
            }

            // If the object is a Mesh, create a body for that mesh (existing flow)
            if (threeObject.isMesh) {
              console.log(`Found mesh object with physics enabled: ${threeObject.name}`);
              console.log(`   - Current mesh position BEFORE storing original: ${threeObject.position.x.toFixed(2)}, ${threeObject.position.y.toFixed(2)}, ${threeObject.position.z.toFixed(2)}`);
              
              // Store original position BEFORE any physics modifications
              threeObject.userData.originalPosition = threeObject.position.clone();
              threeObject.userData.originalRotation = threeObject.rotation.clone();
              
              console.log(`   - Stored original position: ${threeObject.userData.originalPosition.x.toFixed(2)}, ${threeObject.userData.originalPosition.y.toFixed(2)}, ${threeObject.userData.originalPosition.z.toFixed(2)}`);

              console.log(`🔍 Creating physics body for ${threeObject.name}:`);
              console.log(`   - Position: ${threeObject.position.x.toFixed(2)}, ${threeObject.position.y.toFixed(2)}, ${threeObject.position.z.toFixed(2)}`);
              console.log(`   - Physics enabled: ${objectData.physics.enabled}`);
              console.log(`   - Is player: ${objectData.isPlayer}`);
              console.log(`   - Object data:`, objectData);

              // Check if manual collision frames are defined
              const hasManualFrames = objectData.collisionFrames && objectData.collisionFrames.length > 0;

              if (hasManualFrames) {
                // Create a single physics body with compound shape from manual collision frames
                console.log(`📋 Creating compound physics body from ${objectData.collisionFrames.length} manual collision frames for ${threeObject.name}`);
                
                // Remove existing body if any
                physicsWorld.removeBody(threeObject);
                
                const mass = objectData.physics.isStatic ? 0 : (objectData.physics.mass || 1);
                
                console.log(`🔍 Compound body physics settings for ${threeObject.name}:`);
                console.log(`   - objectData.physics.isStatic: ${objectData.physics.isStatic}`);
                console.log(`   - objectData.physics.mass: ${objectData.physics.mass}`);
                console.log(`   - calculated mass: ${mass}`);
                console.log(`   - isPlayer: ${objectData.isPlayer}`);
                
                // Create compound body options
                const bodyOptions = {
                  type: 'compound', // Special type for compound shapes
                  mass: mass,
                  isCharacter: objectData.isPlayer,
                  isStatic: objectData.physics.isStatic || false,
                  frames: objectData.collisionFrames // Pass all frames
                };
                
                console.log(`   🎯 Creating compound body with ${objectData.collisionFrames.length} frames:`, bodyOptions);
                physicsWorld.addBody(threeObject, bodyOptions);
                activatedCount++;
              } else {
                // DO NOT auto-create collision frames/bodies during Play unless explicitly requested.
                // This prevents unexpected auto-generation when the user has manually created frames in the editor.
                if (objectData.physics && objectData.physics.autoCreate) {
                  // Auto-create was explicitly requested via the editor UI (autoCreate: 'convex'|'trimesh')
                  let shapeInfo;
                  if (objectData.isPlayer) {
                    shapeInfo = autoDetectCharacterCollision(threeObject);
                    console.log(`🎮 Auto-detected CHARACTER collision (explicit autoCreate): ${shapeInfo.type}`, shapeInfo);
                  } else {
                    shapeInfo = autoDetectCollisionShape(threeObject);
                    console.log(`🔧 Auto-detected collision shape (explicit autoCreate): ${shapeInfo.type}`, shapeInfo);
                  }

                  const mass = objectData.physics.isStatic ? 0 : (objectData.physics.mass || 1);
                  const bodyOptions = {
                    type: shapeInfo.type,
                    mass: mass,
                    size: shapeInfo.size,
                    radius: shapeInfo.radius,
                    height: shapeInfo.height,
                    mesh: shapeInfo.mesh,
                    offset: shapeInfo.offset,
                    isCharacter: objectData.isPlayer,
                    isStatic: objectData.physics.isStatic || false
                  };

                  console.log(`🔧 Final body options (explicit):`, bodyOptions);
                  physicsWorld.removeBody(threeObject);
                  try {
                    let hasSkinned = false;
                    threeObject.traverse((c) => { if (c.isSkinnedMesh) hasSkinned = true; });
                    if (hasSkinned && bodyOptions.type === 'trimesh') {
                      console.log('⚠️ SkinnedMesh detected on', threeObject.name, '- switching trimesh -> convex for stability');
                      bodyOptions.type = 'convex';
                    }
                  } catch (err) { /* ignore */ }

                  physicsWorld.addBody(threeObject, bodyOptions);
                  activatedCount++;
                  console.log(`🔧 Activated physics for ${threeObject.name} (explicit autoCreate)`);
                } else {
                  console.log(`⏭️ Skipping auto-creation of collision body for ${threeObject.name} during Play (no manual frames and no explicit autoCreate)`);
                }
              }
            } else {
              console.log(`🔍 Found non-mesh object with physics: ${threeObject.name} (type: ${threeObject.type}, constructor: ${threeObject.constructor.name})`);
              console.log(`🔍 Object properties:`, {
                isGroup: threeObject.isGroup,
                isObject3D: threeObject.isObject3D,
                type: threeObject.type,
                children: threeObject.children?.length || 0
              });
              // For GLTF/group/scene roots: create a single approximation body on the root (box based on group's bounding box)
              console.log(`Found Group/GLTF root with physics enabled: ${threeObject.name} - creating root approximation body`);

              // Store original transform for the root
              threeObject.userData.originalPosition = threeObject.position.clone ? threeObject.position.clone() : { x: threeObject.position.x, y: threeObject.position.y, z: threeObject.position.z };
              threeObject.userData.originalRotation = threeObject.rotation ? threeObject.rotation.clone() : { x: threeObject.rotation.x, y: threeObject.rotation.y, z: threeObject.rotation.z };

              // Check if manual collision frames are defined
              const hasManualFramesGltf = objectData.collisionFrames && objectData.collisionFrames.length > 0;

              if (hasManualFramesGltf) {
                // Skip auto-detection if user has manually defined collision frames
                console.log(`📋 Using manual collision frames (${objectData.collisionFrames.length} frames) for GLTF - skipping auto-physics creation`);
                // Don't create automatic physics body - manual frames will be used instead
              } else {
                // DO NOT auto-create collision bodies for GLTF roots during Play unless explicitly requested
                if (objectData.physics && objectData.physics.autoCreate) {
                  let shapeInfo;
                  if (objectData.isPlayer) {
                    shapeInfo = autoDetectCharacterCollision(threeObject);
                    console.log(`🎮 Auto-detected CHARACTER collision (GLTF explicit): ${shapeInfo.type}`, shapeInfo);
                  } else {
                    shapeInfo = autoDetectCollisionShape(threeObject);
                    console.log(`🔧 Auto-detected collision shape (GLTF explicit): ${shapeInfo.type}`, shapeInfo);
                  }

                  const mass = objectData.physics.isStatic ? 0 : (objectData.physics.mass || 1);
                  const bodyOptions = {
                    type: shapeInfo.type,
                    mass: mass,
                    size: shapeInfo.size,
                    radius: shapeInfo.radius,
                    height: shapeInfo.height,
                    mesh: shapeInfo.mesh,
                    isCharacter: objectData.isPlayer,
                    isStatic: objectData.physics.isStatic || false
                  };

                  physicsWorld.removeBody(threeObject);
                  if (bodyOptions.type === 'trimesh') {
                    console.log('⚠️ Group/GLTF root requested trimesh - switching to convex for stability');
                    bodyOptions.type = 'convex';
                  }
                  physicsWorld.addBody(threeObject, bodyOptions);
                  activatedCount++;
                  console.log(`🔧 Activated physics for root ${threeObject.name} (explicit autoCreate)`);
                } else {
                  console.log(`⏭️ Skipping auto-creation for GLTF root ${threeObject.name} during Play (no manual frames and no explicit autoCreate)`);
                }
              }
            }
          }
        });
        
        // Re-enable collision frame writes now that body creation is done
        try { sceneStore.setSuppressCollisionFrameUpdates && sceneStore.setSuppressCollisionFrameUpdates(false); } catch (err) { /* ignore */ }

        // Enable physics world
        // Ensure any remaining physics bodies are activated via scene store helper (safe-guard)
        try {
          sceneStore.activateAllPhysicsBodies && sceneStore.activateAllPhysicsBodies();
        } catch (err) { /* ignore */ }
        physicsWorld.setEnabled(true);
        console.log(`🎯 Activated physics for ${activatedCount} objects with physics.enabled = true`);
        console.log('🔧 Physics world enabled');
        
        // NOW set playing to true - after all physics bodies are created
        set({ isPlaying: true, isPaused: false });
        console.log('✅ Play mode fully activated - character controller can now find physics bodies');
      } else {
        console.error('Scene not available');
      }
    } else {
      console.warn('Scene store not available');
    }
  },
  
  pause: () => {
    const { isPlaying } = get();
    if (isPlaying) {
      set({ isPaused: true });
      console.log('⏸️ Game paused');
      
      // Just disable physics simulation, keep bodies
      if (sceneStoreRef) {
        const sceneStore = sceneStoreRef.getState();
        const { physicsWorld } = sceneStore;
        physicsWorld.setEnabled(false);
        console.log('⏸️ Physics simulation paused');
      }
    }
  },
  
  stop: () => {
    set({ isPlaying: false, isPaused: false });
    console.log('⏹️ Game stopped');
    
    // Force disable physics and reset positions
    if (sceneStoreRef) {
      const sceneStore = sceneStoreRef.getState();
      const { scene, physicsWorld, objects } = sceneStore;
      
      if (scene) {
        console.log('🛑 Force stopping physics...');
        console.log(`📊 Total objects in store: ${objects.size}`);
        
        // First, disable physics world
        physicsWorld.setEnabled(false);
        console.log('🔧 Physics world disabled');
        
        // Debug: Check what objects have physics enabled
        let physicsEnabledCount = 0;
        objects.forEach((objectData, uuid) => {
          if (objectData.physics && objectData.physics.enabled) {
            physicsEnabledCount++;
            console.log(`📋 Object with physics enabled: UUID=${uuid.substr(0,8)}, data=`, objectData);
          }
        });
        console.log(`📊 Found ${physicsEnabledCount} objects with physics enabled`);
        
        // Only reset objects that had physics enabled (objects is a Map)
        let resetCount = 0;
        objects.forEach((objectData, uuid) => {
          if (objectData.physics && objectData.physics.enabled) {
            // Find the actual Three.js object in the scene
            let threeObject = null;
            scene.traverse((object) => {
              if (object.uuid === uuid) {
                threeObject = object;
              }
            });
            
            if (threeObject && threeObject.type === 'Mesh') {
              console.log(`🔄 Resetting physics object: ${threeObject.name}`);
              console.log(`   Current position: (${threeObject.position.x.toFixed(2)}, ${threeObject.position.y.toFixed(2)}, ${threeObject.position.z.toFixed(2)})`);
              console.log(`   Has originalPosition: ${!!threeObject.userData.originalPosition}`);
              
              // Remove physics body first
              const hadBody = physicsWorld.getBody(threeObject);
              if (hadBody) {
                physicsWorld.removeBody(threeObject);
                console.log(`   ✅ Removed physics body`);
              } else {
                console.log(`   ⚠️ No physics body found to remove`);
              }
              
              // Reset to original position if available
              if (threeObject.userData.originalPosition) {
                threeObject.position.copy(threeObject.userData.originalPosition);
                threeObject.rotation.copy(threeObject.userData.originalRotation || { x: 0, y: 0, z: 0 });
                console.log(`   ✅ Reset ${threeObject.name} to original position: (${threeObject.position.x}, ${threeObject.position.y}, ${threeObject.position.z})`);
              } else {
                // Fallback reset logic for objects without stored original position
                console.log(`   ⚠️ No original position stored for ${threeObject.name}, using fallback`);
                if (threeObject.name === 'DemoCube') {
                  threeObject.position.set(0, 5, 0);
                  threeObject.rotation.set(0, 0, 0);
                  console.log(`   ✅ Reset ${threeObject.name} to default position: (0, 5, 0)`);
                } else {
                  // Keep current position but ensure it's above ground
                  threeObject.position.y = Math.max(threeObject.position.y, 3);
                  threeObject.rotation.set(0, 0, 0);
                  console.log(`   ⚠️ Reset ${threeObject.name} with fallback logic`);
                }
              }
              
              // Reset velocity
              threeObject.userData.velocity = { x: 0, y: 0, z: 0 };
              
              resetCount++;
            } else {
              console.warn(`⚠️ Could not find Three.js object for UUID: ${uuid.substr(0,8)}`);
            }
          }
        });
        
        console.log(`🔄 Reset ${resetCount} physics-enabled objects`);
        console.log(`📊 Physics world has ${physicsWorld.bodies.size} bodies after stop`);
      }
    }
  },
  
  resume: () => {
    set({ isPaused: false });
    console.log('▶️ Game resumed');
    
    // Re-enable physics simulation
    if (sceneStoreRef) {
      const sceneStore = sceneStoreRef.getState();
      const { physicsWorld } = sceneStore;
      physicsWorld.setEnabled(true);
      console.log('▶️ Physics simulation resumed');
    }
  }
}));