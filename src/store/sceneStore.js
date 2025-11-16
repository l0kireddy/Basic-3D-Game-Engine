import { create } from 'zustand';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';

// Store for managing the 3D scene state
export const useSceneStore = create((set, get) => ({
  // Scene objects
  scene: null,
  selectedObject: null,
  objects: new Map(),
  // Show collision frames overlay in viewport
  showCollisionFrames: true,
  // When true, writes to collisionFrames via updateObjectData will be ignored.
  suppressCollisionFrameUpdates: false,
  
  // Physics world
  physicsWorld: new PhysicsWorld(),
  
  // Audio collision system initialized flag
  audioSystemInitialized: false,
  
  // Set the Three.js scene reference
  setScene: (scene) => {
    set({ scene });
    
    // Initialize audio collision system if not already done
    const state = get();
    if (!state.audioSystemInitialized) {
      state.initializeAudioCollisionSystem();
      set({ audioSystemInitialized: true });
    }
  },

  // Initialize audio collision system
  initializeAudioCollisionSystem: () => {
    const { physicsWorld } = get();
    
    // Add collision audio callback
    const audioCollisionCallback = (objectA, objectB) => {
      const state = get();
      
      // Get object data for both collision objects
      const dataA = state.objects.get(objectA.uuid);
      const dataB = state.objects.get(objectB.uuid);
      
      // Trigger collision sound for objectA
      if (dataA?.audio?.enabled && dataA?.audio?.soundOnCollision) {
        console.log(`🔊 Collision sound for ${objectA.name}: ${dataA.audio.soundOnCollision}`);
        // Get audio store and play sound
        import('../store/audioStore').then(({ useAudioStore }) => {
          const audioStore = useAudioStore.getState();
          audioStore.playObjectSound(objectA, dataA.audio.soundOnCollision, {
            volume: dataA.audio.volume || 1.0
          });
        });
      }
      
      // Trigger collision sound for objectB
      if (dataB?.audio?.enabled && dataB?.audio?.soundOnCollision) {
        console.log(`🔊 Collision sound for ${objectB.name}: ${dataB.audio.soundOnCollision}`);
        // Get audio store and play sound
        import('../store/audioStore').then(({ useAudioStore }) => {
          const audioStore = useAudioStore.getState();
          audioStore.playObjectSound(objectB, dataB.audio.soundOnCollision, {
            volume: dataB.audio.volume || 1.0
          });
        });
      }
    };
    
    physicsWorld.addAudioCallback(audioCollisionCallback);

    // Add platform event callback
    const platformEventCallback = (eventType, platform, object) => {
      console.log(`🟫 Platform ${eventType}: ${object.name} ${eventType}ed platform ${platform.name}`);
      
      // You can add custom platform behavior here
      // For example: play sounds, trigger animations, change object properties, etc.
      const state = get();
      const platformData = state.objects.get(platform.uuid);
      
      if (platformData?.audio?.enabled) {
        // Play different sounds for different platform events
        let soundName = null;
        
        switch (eventType) {
          case 'enter':
            soundName = platformData.audio.soundOnCollision || 'beep.wav';
            break;
          case 'exit':
            soundName = platformData.audio.ambientSound || 'click.wav';
            break;
          case 'land':
            // Solid platform landing sound
            soundName = platformData.audio.soundOnCollision || 'jump.wav';
            break;
        }
          
        if (soundName) {
          import('../store/audioStore').then(({ useAudioStore }) => {
            const audioStore = useAudioStore.getState();
            audioStore.playObjectSound(platform, soundName, {
              volume: (platformData.audio.volume || 1.0) * (eventType === 'land' ? 0.8 : 0.5)
            });
          });
        }
      }
    };
    
    physicsWorld.addPlatformCallback(platformEventCallback);
    console.log('🎧 Audio collision system and platform events initialized');
  },
  
  // Select an object
  selectObject: (object) => {
    set({ selectedObject: object });
  },

  // Toggle collision frame visuals
  setShowCollisionFrames: (flag) => {
    set({ showCollisionFrames: !!flag });
    console.log(`👁️ showCollisionFrames = ${!!flag}`);
  },

  // Suppress or allow collision frame updates (used during Play startup to avoid accidental auto-generation)
  setSuppressCollisionFrameUpdates: (flag) => {
    set({ suppressCollisionFrameUpdates: !!flag });
    console.log(`🔒 suppressCollisionFrameUpdates = ${!!flag}`);
  },
  
  // Update object transform
  updateObjectTransform: (objectId, transform) => {
    const { scene, objects } = get();
    const object = scene?.getObjectByProperty('uuid', objectId);
    
    if (object && transform) {
      if (transform.position) {
        object.position.set(transform.position.x, transform.position.y, transform.position.z);
      }
      if (transform.rotation) {
        object.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
      }
      if (transform.scale) {
        object.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
      }
      
      // Update the objects map
      const updatedObjects = new Map(objects);
      const objectData = updatedObjects.get(objectId) || {};
      updatedObjects.set(objectId, { ...objectData, transform });
      
      set({ objects: updatedObjects });
    }
  },
  
  // Update object material
  updateObjectMaterial: (objectId, materialProps) => {
    const { scene, objects } = get();
    const object = scene?.getObjectByProperty('uuid', objectId);
    
    if (object && object.material && materialProps) {
      // Store current values before updating
      const currentColor = object.material.color.getHex();
      const currentMetalness = object.material.metalness;
      const currentRoughness = object.material.roughness;
      
      // Update properties while preserving others
      if (materialProps.color !== undefined) {
        object.material.color.setHex(materialProps.color);
      }
      if (materialProps.metalness !== undefined) {
        object.material.metalness = materialProps.metalness;
      }
      if (materialProps.roughness !== undefined) {
        object.material.roughness = materialProps.roughness;
      }
      
      // Force material update
      object.material.needsUpdate = true;
      
      // Update the objects map with complete material state
      const updatedObjects = new Map(objects);
      const objectData = updatedObjects.get(objectId) || {};
      updatedObjects.set(objectId, { 
        ...objectData, 
        material: {
          color: materialProps.color !== undefined ? materialProps.color : currentColor,
          metalness: materialProps.metalness !== undefined ? materialProps.metalness : currentMetalness,
          roughness: materialProps.roughness !== undefined ? materialProps.roughness : currentRoughness
        }
      });
      
      set({ objects: updatedObjects });
    }
  },

  // Update physics properties
  updatePhysicsProperties: (objectId, physicsProps) => {
    const { scene, objects, physicsWorld } = get();
    const object = scene?.getObjectByProperty('uuid', objectId);
    
    if (object && physicsProps) {
      // Get current physics body
      const existingBody = physicsWorld.getBody(object);
      
      // If enabling physics and no body exists, create one
      if (physicsProps.enabled && !existingBody) {
        const objectData = objects.get(objectId) || {};
        // If the object has a collision mesh and user requested using it, pass that mesh as collision source
        let collisionSource = null;
        if (physicsProps.useCollisionMesh && objectData.collisionMesh) {
          collisionSource = scene.getObjectByProperty('uuid', objectData.collisionMesh);
        }
        // Allow explicit auto-create request (convex/trimesh) to override the selected bodyType
        let requestedType = physicsProps.autoCreate ? physicsProps.autoCreate : (physicsProps.useCollisionMesh ? 'trimesh' : (physicsProps.bodyType || 'box'));
        // If object is a skinned mesh (animated character), avoid trimesh for dynamic bodies
        try {
          let hasSkinned = false;
          object.traverse((c) => { if (c.isSkinnedMesh) hasSkinned = true; });
          if (hasSkinned && requestedType === 'trimesh') {
            console.log('⚠️ Object contains SkinnedMesh - overriding trimesh -> convex for stability');
            requestedType = 'convex';
          }
        } catch (err) { /* ignore */ }
        const bodyOptions = {
          type: requestedType,
          mass: physicsProps.mass ?? 1,
          size: physicsProps.size || { x: 1, y: 1, z: 1 },
          isTrigger: physicsProps.isTrigger || false,
          isStatic: physicsProps.isStatic || false,
          collisionMesh: collisionSource
        };
        physicsWorld.addBody(object, bodyOptions);
      }
      // If disabling physics and body exists, remove it
      else if (!physicsProps.enabled && existingBody) {
        physicsWorld.removeBody(object);
      }
      // If body exists and we're updating properties
      else if (existingBody && physicsProps.enabled) {
        // Remove and recreate body with new properties
        physicsWorld.removeBody(object);
        const objectData = objects.get(objectId) || {};
        let collisionSource = null;
        if (physicsProps.useCollisionMesh && objectData.collisionMesh) {
          collisionSource = scene.getObjectByProperty('uuid', objectData.collisionMesh);
        }
        // Respect autoCreate request if present
        let requestedType = physicsProps.autoCreate ? physicsProps.autoCreate : (physicsProps.useCollisionMesh ? 'trimesh' : (physicsProps.bodyType || 'box'));
        try {
          let hasSkinned = false;
          object.traverse((c) => { if (c.isSkinnedMesh) hasSkinned = true; });
          if (hasSkinned && requestedType === 'trimesh') {
            console.log('⚠️ Object contains SkinnedMesh - overriding trimesh -> convex for stability');
            requestedType = 'convex';
          }
        } catch (err) { /* ignore */ }
        const bodyOptions = {
          type: requestedType,
          mass: physicsProps.mass ?? 1,
          size: physicsProps.size || { x: 1, y: 1, z: 1 },
          isTrigger: physicsProps.isTrigger || false,
          isStatic: physicsProps.isStatic || false,
          collisionMesh: collisionSource
        };
        physicsWorld.addBody(object, bodyOptions);
      }
      
      // Update the objects map
      const updatedObjects = new Map(objects);
      const objectData = updatedObjects.get(objectId) || {};
        updatedObjects.set(objectId, { 
        ...objectData, 
        physics: {
          enabled: physicsProps.enabled ?? false,
          bodyType: physicsProps.bodyType || 'box',
          mass: physicsProps.mass ?? 1,
          size: physicsProps.size || { x: 1, y: 1, z: 1 },
          isTrigger: physicsProps.isTrigger || false,
          isStatic: physicsProps.isStatic || false,
          useCollisionMesh: physicsProps.useCollisionMesh || false,
          autoCreate: physicsProps.autoCreate || null
        }
      });
      
      set({ objects: updatedObjects });
    }
  },

  // Update light properties
  updateLightProperties: (objectId, lightProps) => {
    const { scene, objects } = get();
    const light = scene?.getObjectByProperty('uuid', objectId);
    
    if (light && lightProps) {
      // Update light properties based on type
      if (light.type === 'DirectionalLight') {
        if (lightProps.color !== undefined) {
          light.color.setHex(lightProps.color);
        }
        if (lightProps.intensity !== undefined) {
          light.intensity = lightProps.intensity;
        }
        if (lightProps.castShadow !== undefined) {
          light.castShadow = lightProps.castShadow;
        }
      } else if (light.type === 'HemisphereLight') {
        if (lightProps.skyColor !== undefined) {
          light.color.setHex(lightProps.skyColor);
        }
        if (lightProps.groundColor !== undefined) {
          light.groundColor.setHex(lightProps.groundColor);
        }
        if (lightProps.intensity !== undefined) {
          light.intensity = lightProps.intensity;
        }
      }
      
      // Update the objects map
      const updatedObjects = new Map(objects);
      const objectData = updatedObjects.get(objectId) || {};
      updatedObjects.set(objectId, { ...objectData, lightProps });
      
      set({ objects: updatedObjects });
    }
  },
  
  // Add object to scene
  addObject: (object, metadata = {}) => {
    const { objects } = get();
    const updatedObjects = new Map(objects);
    
    const objectData = {
      id: object.uuid,
      name: object.name || 'Unnamed Object',
      type: object.type,
      transform: {
        position: { x: object.position.x, y: object.position.y, z: object.position.z },
        rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
        scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z }
      },
      ...metadata
    };

    // Add material properties for mesh objects
    if (object.material) {
      objectData.material = {
        color: object.material.color?.getHex() || 0xffffff,
        metalness: object.material.metalness || 0,
        roughness: object.material.roughness || 0.5
      };
    }

    // Add light properties for light objects
    if (object.type.includes('Light')) {
      objectData.lightProps = {
        intensity: object.intensity || 1,
        castShadow: object.castShadow || false
      };

      if (object.type === 'DirectionalLight') {
        objectData.lightProps.color = object.color?.getHex() || 0xffffff;
      } else if (object.type === 'HemisphereLight') {
        objectData.lightProps.skyColor = object.color?.getHex() || 0xffffff;
        objectData.lightProps.groundColor = object.groundColor?.getHex() || 0x444444;
      }
    }

    // Add default physics properties for mesh objects
    if (object.type === 'Mesh') {
      objectData.physics = {
        enabled: false,
        bodyType: 'box',
        mass: 1,
        size: { x: 1, y: 1, z: 1 },
        ...metadata.physics // Override defaults with metadata
      };
    }
    
    updatedObjects.set(object.uuid, objectData);
    set({ objects: updatedObjects });
    
    // If physics is enabled in metadata, create physics body immediately
    if (object.type === 'Mesh' && objectData.physics && objectData.physics.enabled) {
      const { physicsWorld } = get();
      const bodyOptions = {
        type: objectData.physics.bodyType || 'box',
        mass: objectData.physics.mass || 1,
        size: objectData.physics.size || { x: 1, y: 1, z: 1 }
      };
      physicsWorld.addBody(object, bodyOptions);
      console.log(`🔧 Physics body created for ${object.name || 'object'}`);
    }
  },
  
  // Remove object from scene
  removeObject: (objectId) => {
    const { scene, objects, selectedObject, physicsWorld } = get();
    const object = scene?.getObjectByProperty('uuid', objectId);
    
    if (object) {
      // Remove physics body if it exists
      physicsWorld.removeBody(object);
      
      scene.remove(object);
      
      const updatedObjects = new Map(objects);
      updatedObjects.delete(objectId);
      
      set({ 
        objects: updatedObjects,
        selectedObject: selectedObject?.uuid === objectId ? null : selectedObject
      });
    }
  },

  // Physics control methods
  enablePhysics: () => {
    const { physicsWorld } = get();
    physicsWorld.setEnabled(true);
  },

  disablePhysics: () => {
    const { physicsWorld } = get();
    physicsWorld.setEnabled(false);
  },

  stepPhysics: (deltaTime) => {
    const { physicsWorld } = get();
    if (physicsWorld.enabled) {
      console.log('🔄 Stepping physics with deltaTime:', deltaTime);
    }
    physicsWorld.step(deltaTime);
  },

  setGravity: (x, y, z) => {
    const { physicsWorld } = get();
    physicsWorld.setGravity(x, y, z);
  },

  addGroundPlane: (y = 0) => {
    const { physicsWorld } = get();
    return physicsWorld.addGroundPlane(y);
  },

  // Reset physics bodies to match visual positions
  resetPhysics: () => {
    const { physicsWorld } = get();
    physicsWorld.resetAllBodies();
    console.log('🔄 Physics bodies reset to visual positions');
  },

  // Reset specific object physics
  resetObjectPhysics: (objectId) => {
    const { scene, physicsWorld } = get();
    const object = scene?.getObjectByProperty('uuid', objectId);
    if (object) {
      physicsWorld.resetBodyPosition(object);
      console.log(`🔄 Reset physics for ${object.name}`);
    }
  },

  // Activate physics bodies for all objects that have physics enabled
  activateAllPhysicsBodies: () => {
    const { scene, objects, physicsWorld } = get();
    
    if (!scene) {
      console.warn('❌ No scene available for physics activation');
      return;
    }
    
    let activatedCount = 0;
    
    console.log('🔍 Checking objects for physics activation:', objects.size);
    
    objects.forEach((objectData, objectId) => {
      console.log(`- Object ${objectData.name} (${objectId}):`);
      console.log(`  - Type: ${objectData.type}`);
      console.log(`  - Physics: ${JSON.stringify(objectData.physics)}`);
      
      if (objectData.physics && objectData.physics.enabled) {
        const threeObject = scene.getObjectByProperty('uuid', objectId);
        console.log(`  - Found Three.js object:`, !!threeObject);
        
        if (threeObject && threeObject.type === 'Mesh') {
          // Check if physics body already exists
          const existingBody = physicsWorld.getBody(threeObject);
          console.log(`  - Existing physics body:`, !!existingBody);
          
          if (!existingBody) {
            // Create physics body
            const bodyOptions = {
              type: objectData.physics.bodyType || 'box',
              mass: objectData.physics.mass || 1,
              size: objectData.physics.size || { x: 1, y: 1, z: 1 }
            };
            physicsWorld.addBody(threeObject, bodyOptions);
            activatedCount++;
            console.log(`🔧 Activated physics for ${threeObject.name || 'object'}`);
          } else {
            console.log(`⚠️ Physics body already exists for ${threeObject.name}`);
          }
        } else {
          console.log(`❌ Three.js object not found or not a Mesh for ${objectData.name}`);
        }
      } else {
        console.log(`  - Physics not enabled or not found`);
      }
    });
    
    console.log(`🎯 Activated physics for ${activatedCount} objects`);
  },

  // Deactivate all physics bodies (for stop/pause)
  deactivateAllPhysicsBodies: () => {
    const { scene, objects, physicsWorld } = get();
    
    if (!scene) return;
    
    let deactivatedCount = 0;
    
    objects.forEach((objectData, objectId) => {
      if (objectData.physics && objectData.physics.enabled) {
        const threeObject = scene.getObjectByProperty('uuid', objectId);
        if (threeObject) {
          const existingBody = physicsWorld.getBody(threeObject);
          if (existingBody) {
            physicsWorld.removeBody(threeObject);
            deactivatedCount++;
          }
        }
      }
    });
    
    console.log(`🛑 Deactivated physics for ${deactivatedCount} objects`);
  },
  
  // Get object data
  getObjectData: (objectId) => {
    const { objects } = get();
    return objects.get(objectId);
  },

  // Update object data
  updateObjectData: (objectId, newData) => {
    const { objects } = get();
    const { suppressCollisionFrameUpdates } = get();
    const updatedObjects = new Map(objects);
    const existingData = updatedObjects.get(objectId) || {};
    
    // If caller is trying to update collisionFrames while suppression is enabled, ignore that portion
    if (suppressCollisionFrameUpdates && newData && Object.prototype.hasOwnProperty.call(newData, 'collisionFrames')) {
      console.log(`⛔ Suppressed collisionFrames update for ${objectId} because suppression is active`);
      // Remove collisionFrames from newData clone so other fields can still be merged
      const clone = { ...newData };
      delete clone.collisionFrames;
      updatedObjects.set(objectId, { ...existingData, ...clone });
      set({ objects: updatedObjects });
      // Also print stack to help trace who attempted the update
      console.trace('Suppressed collisionFrames update stack trace');
      return;
    }

    // If updating collisionFrames, add a trace to help debug unexpected writes
    if (newData && Object.prototype.hasOwnProperty.call(newData, 'collisionFrames')) {
      console.log(`📝 updateObjectData called for collisionFrames on ${objectId} - new length: ${(newData.collisionFrames || []).length}`);
      console.trace();
    }

    // Merge existing data with new data
    updatedObjects.set(objectId, { ...existingData, ...newData });
    
    set({ objects: updatedObjects });
    console.log(`📝 Updated object data for ${objectId}`, newData);
  },
  
  // Get all objects as array
  getObjectsArray: () => {
    const { objects } = get();
    return Array.from(objects.values());
  }
}));