import React, { useEffect, useState } from "react";
import * as THREE from "three";
import { useSceneStore } from "../store/sceneStore";
import { usePlayStore } from "../store/playStore";

export default function PhysicsInspector() {
  const { selectedObject, getObjectData, updatePhysicsProperties, updateObjectData } = useSceneStore();
  const { isPlaying } = usePlayStore();
  const [physics, setPhysics] = useState({
    enabled: false,
    bodyType: 'box',
    isStatic: false,
    isTrigger: false,
    mass: 1,
    size: { x: 1, y: 1, z: 1 }
  });
  const [useCollisionMesh, setUseCollisionMesh] = useState(false);
  const [autoCreateMode, setAutoCreateMode] = useState('convex');
  const [lastManualSizeChange, setLastManualSizeChange] = useState(0);
  const [collisionFrames, setCollisionFrames] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);

  // Get the effective body type (including character overrides)
  const getEffectiveBodyType = (objectData) => {
    if (!objectData) return 'box';
    
    // If this is a player character with collision body type override
    if (objectData.isPlayer && objectData.characterSettings?.collisionBodyType) {
      return objectData.characterSettings.collisionBodyType;
    }
    
    // Otherwise use the regular physics body type
    return objectData.physics?.bodyType || 'box';
  };

  useEffect(() => {
    if (selectedObject) {
      const latest = getObjectData(selectedObject.uuid);
      if (latest && latest.physics) {
        const effectiveBodyType = getEffectiveBodyType(latest);
        setPhysics({
          enabled: latest.physics.enabled ?? false,
          bodyType: effectiveBodyType, // Use effective body type including character overrides
          isStatic: latest.physics.isStatic ?? false,
          isTrigger: latest.physics.isTrigger ?? false,
          mass: latest.physics.mass ?? 1,
          size: latest.physics.size || { x: 1, y: 1, z: 1 }
        });
        setUseCollisionMesh(!!latest.useCollisionMesh || !!latest.collisionMesh);
        // Load collision frames with default values
        const loadedFrames = (latest.collisionFrames || []).map(frame => ({
          id: frame.id ?? Date.now(),
          type: frame.type || 'box',
          position: { 
            x: frame.position?.x ?? 0, 
            y: frame.position?.y ?? 0, 
            z: frame.position?.z ?? 0 
          },
          size: { 
            x: frame.size?.x ?? 1, 
            y: frame.size?.y ?? 1, 
            z: frame.size?.z ?? 1 
          },
          rotation: { 
            x: frame.rotation?.x ?? 0, 
            y: frame.rotation?.y ?? 0, 
            z: frame.rotation?.z ?? 0 
          },
          radius: frame.radius ?? 0.5
        }));
        setCollisionFrames(loadedFrames);
        
        // Auto-clear collision frames from ground objects
        const isGroundObject = selectedObject.name === 'Ground' || 
                              selectedObject.name === 'GroundPlane' || 
                              selectedObject.name.toLowerCase().includes('ground') ||
                              selectedObject.name.toLowerCase().includes('plane');
        if (isGroundObject && loadedFrames.length > 0) {
          console.log(`🧹 Auto-clearing ${loadedFrames.length} collision frames from ground object: ${selectedObject.name}`);
          setCollisionFrames([]);
          updateObjectData(selectedObject.uuid, { collisionFrames: [] });
        }
      } else if (selectedObject.type === 'Mesh' || selectedObject.type === 'Group') {
        // Compute bounding box size from the object so collision size matches object size by default
        try {
          const box = new THREE.Box3().setFromObject(selectedObject);
          const sizeVec = new THREE.Vector3();
          box.getSize(sizeVec);
          const safeSize = {
            x: Math.max(sizeVec.x, 0.001),
            y: Math.max(sizeVec.y, 0.001),
            z: Math.max(sizeVec.z, 0.001)
          };
          setPhysics({ enabled: false, bodyType: 'box', isStatic: false, isTrigger: false, mass: 1, size: safeSize });
        } catch (err) {
          // fallback
          setPhysics({ enabled: false, bodyType: 'box', isStatic: false, isTrigger: false, mass: 1, size: { x: 1, y: 1, z: 1 } });
        }
      }
    } else {
      setPhysics({ enabled: false, bodyType: 'box', isStatic: false, isTrigger: false, mass: 1, size: { x: 1, y: 1, z: 1 } });
    }
  }, [selectedObject, getObjectData]);

  const handlePhysicsChange = (property, value) => {
    const newPhysics = { ...physics };
    if (property === 'enabled') {
      newPhysics.enabled = value;
      // When enabling physics, default collision size should match object bounding box
      if (value && selectedObject) {
        try {
          const box = new THREE.Box3().setFromObject(selectedObject);
          const sizeVec = new THREE.Vector3();
          box.getSize(sizeVec);
          newPhysics.size = {
            x: Math.max(sizeVec.x, 0.001),
            y: Math.max(sizeVec.y, 0.001),
            z: Math.max(sizeVec.z, 0.001)
          };
        } catch (err) {
          // ignore and keep existing size
        }
      }
    } else if (property === 'bodyType') {
      newPhysics.bodyType = value;
    } else if (property === 'isStatic') {
      newPhysics.isStatic = !!value;
      // Static objects have mass = 0
      if (value) {
        newPhysics.mass = 0;
        // Ensure physics is enabled for static platforms
        newPhysics.enabled = true;
        console.log(`🏔️ Setting object to STATIC: mass=${newPhysics.mass}, enabled=${newPhysics.enabled}, isStatic=${newPhysics.isStatic}`);
      } else if (newPhysics.mass === 0) {
        newPhysics.mass = 1; // Reset to default dynamic mass
        console.log(`🏃 Setting object to DYNAMIC: mass=${newPhysics.mass}, isStatic=${newPhysics.isStatic}`);
      }
    } else if (property === 'isTrigger') {
      newPhysics.isTrigger = !!value;
    } else if (property === 'mass') {
      const parsedMass = parseFloat(value);
      newPhysics.mass = isNaN(parsedMass) ? 1 : parsedMass;
    } else if (property.startsWith('size.')) {
      const axis = property.split('.')[1];
      newPhysics.size[axis] = parseFloat(value) || 1;
      setLastManualSizeChange(Date.now());
    }
    setPhysics(newPhysics);

    if (selectedObject) {
      // Allow updating physics for groups or meshes; store handles collisionMesh usage in store
      updatePhysicsProperties(selectedObject.uuid, { ...newPhysics, useCollisionMesh });
    }
  };

  const handleToggleCollisionMesh = (checked) => {
    setUseCollisionMesh(checked);
    if (selectedObject) {
      updatePhysicsProperties(selectedObject.uuid, { ...physics, useCollisionMesh: checked });
    }
  };

  const handleAutoCreate = () => {
    if (!selectedObject) return;
    // Request the store to create a physics body using an auto-generated collision shape
    updatePhysicsProperties(selectedObject.uuid, { ...physics, useCollisionMesh: false, autoCreate: autoCreateMode, enabled: true });
  };

  // Poll selected object's bounding box periodically to sync size when user hasn't manually edited
  useEffect(() => {
    let interval;
    if (selectedObject && !isPlaying) { // Don't update during play mode
      interval = setInterval(() => {
        // Don't overwrite if user changed size recently (allow manual edits)
        if (Date.now() - lastManualSizeChange < 1000) return;
        try {
          const box = new THREE.Box3().setFromObject(selectedObject);
          const sizeVec = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(sizeVec);
          box.getCenter(center);
          // Convert world bbox size to local object-space size so frames stay consistent
          const worldScale = selectedObject.getWorldScale(new THREE.Vector3());
          const localSizeVec = new THREE.Vector3(
            sizeVec.x / Math.max(worldScale.x, 1e-6),
            sizeVec.y / Math.max(worldScale.y, 1e-6),
            sizeVec.z / Math.max(worldScale.z, 1e-6)
          );
          const computed = {
            x: Math.max(localSizeVec.x, 0.001),
            y: Math.max(localSizeVec.y, 0.001),
            z: Math.max(localSizeVec.z, 0.001)
          };
          // Only update if different
          if (!selectedObject) return;
          if (Math.abs(computed.x - physics.size.x) > 0.001 || Math.abs(computed.y - physics.size.y) > 0.001 || Math.abs(computed.z - physics.size.z) > 0.001) {
            setPhysics((p) => ({ ...p, size: computed }));
            
            // Auto-update collision frames for primitive objects (if they have auto-generated frames)
            const selectedData = getObjectData(selectedObject.uuid);
            if (selectedData && (selectedData.type === 'primitive' || selectedData.type === 'mesh') && collisionFrames.length > 0) {
              // Check if any frames are marked as auto-generated
              const autoFrames = collisionFrames.filter(frame => frame.autoGenerated);
              
              if (autoFrames.length > 0) {
                console.log(`🔄 Auto-updating ${autoFrames.length} collision frames for ${selectedObject.name}`);
                const localCenter = selectedObject.worldToLocal(center.clone());
                
                const updatedFrames = collisionFrames.map(frame => {
                  if (frame.autoGenerated) {
                    // Store frame sizes in local object space (invert world scale)
                    const worldScale = selectedObject.getWorldScale(new THREE.Vector3());
                    const localSize = {
                      x: Math.max(sizeVec.x / Math.max(worldScale.x, 1e-6), 0.001),
                      y: Math.max(sizeVec.y / Math.max(worldScale.y, 1e-6), 0.001),
                      z: Math.max(sizeVec.z / Math.max(worldScale.z, 1e-6), 0.001)
                    };
                    return {
                      ...frame,
                      position: { x: localCenter.x, y: localCenter.y, z: localCenter.z },
                      size: localSize
                    };
                  }
                  return frame; // Keep manual frames unchanged
                });
                
                setCollisionFrames(updatedFrames);
                updateObjectData(selectedObject.uuid, { collisionFrames: updatedFrames });
              }
            }
          }
        } catch (err) {
          // ignore
        }
      }, 300);
    }
    return () => clearInterval(interval);
  }, [selectedObject, lastManualSizeChange, physics.size.x, physics.size.y, physics.size.z, collisionFrames, getObjectData, updateObjectData, isPlaying]);

  // Collision Frame Editor Functions
  const autoGenerateFrame = () => {
    if (!selectedObject || isPlaying) {
      console.warn('⚠️ Cannot modify collision frames during Play mode');
      return;
    }
    const bbox = new THREE.Box3().setFromObject(selectedObject);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);
    const localCenter = selectedObject.worldToLocal(center.clone());

    // Convert world bbox size to local object-space size before storing
    const worldScale = selectedObject.getWorldScale(new THREE.Vector3());
    const localSize = {
      x: Math.max(size.x / Math.max(worldScale.x, 1e-6), 0.001),
      y: Math.max(size.y / Math.max(worldScale.y, 1e-6), 0.001),
      z: Math.max(size.z / Math.max(worldScale.z, 1e-6), 0.001)
    };

    // Strict behavior: do not auto-generate if any frames already exist
    if (collisionFrames && collisionFrames.length > 0) {
      console.log('Auto-generate skipped: object already has collision frames');
      return;
    }

    let frame;
    const geometryType = selectedObject.geometry ? selectedObject.geometry.type : 'BoxGeometry';

    switch (geometryType) {
      case 'SphereGeometry':
        frame = {
          id: Date.now(),
          type: 'sphere',
          position: { x: localCenter.x, y: localCenter.y, z: localCenter.z },
          radius: localSize.x / 2,
          rotation: { x: 0, y: 0, z: 0 },
          autoGenerated: true
        };
        break;
      case 'CylinderGeometry':
        frame = {
          id: Date.now(),
          type: 'cylinder',
          position: { x: localCenter.x, y: localCenter.y, z: localCenter.z },
          radius: localSize.x / 2,
          height: localSize.y,
          rotation: { x: 0, y: 0, z: 0 },
          autoGenerated: true
        };
        break;
      case 'BoxGeometry':
      default:
        frame = {
          id: Date.now(),
          type: 'box',
          position: { x: localCenter.x, y: localCenter.y, z: localCenter.z },
          size: localSize,
          rotation: { x: 0, y: 0, z: 0 },
          autoGenerated: true // Mark as auto-generated for dynamic updates
        };
        break;
    }
    const newFrames = [frame];
    console.log(`🎯 Auto-generating collision frame for ${selectedObject.name}`, frame);
    setCollisionFrames(newFrames);
    updateObjectData(selectedObject.uuid, { collisionFrames: newFrames });
  };

  const addManualFrame = (type = 'box') => {
    if (isPlaying) {
      console.warn('⚠️ Cannot modify collision frames during Play mode');
      return;
    }
    const frame = {
      id: Date.now(),
      type: type,
      position: { x: 0, y: 1, z: 0 },
      size: { x: 0.5, y: 1, z: 0.5 },
      rotation: { x: 0, y: 0, z: 0 },
      radius: 0.3
    };
    const newFrames = [...collisionFrames, frame];
    console.log(`➕ Adding manual collision frame (${type}). Total frames: ${newFrames.length}`, newFrames);
    setCollisionFrames(newFrames);
    updateObjectData(selectedObject.uuid, { collisionFrames: newFrames });
  };

  const updateFrame = (frameId, property, axis, value) => {
    if (isPlaying) {
      console.warn('⚠️ Cannot modify collision frames during Play mode');
      return;
    }
    const newFrames = collisionFrames.map(frame => {
      if (frame.id === frameId) {
        return { ...frame, [property]: { ...frame[property], [axis]: parseFloat(value) } };
      }
      return frame;
    });
    setCollisionFrames(newFrames);
    updateObjectData(selectedObject.uuid, { collisionFrames: newFrames });
  };

  const updateFrameRadius = (frameId, value) => {
    if (isPlaying) {
      console.warn('⚠️ Cannot modify collision frames during Play mode');
      return;
    }
    const newFrames = collisionFrames.map(frame => {
      if (frame.id === frameId) {
        return { ...frame, radius: parseFloat(value) };
      }
      return frame;
    });
    setCollisionFrames(newFrames);
    updateObjectData(selectedObject.uuid, { collisionFrames: newFrames });
  };

  const deleteFrame = (frameId) => {
    if (isPlaying) {
      console.warn('⚠️ Cannot modify collision frames during Play mode');
      return;
    }
    const newFrames = collisionFrames.filter(f => f.id !== frameId);
    console.log(`🗑️ Deleting collision frame ${frameId}. Remaining frames: ${newFrames.length}`, newFrames);
    setCollisionFrames(newFrames);
    updateObjectData(selectedObject.uuid, { collisionFrames: newFrames });
    if (selectedFrame === frameId) {
      setSelectedFrame(null);
    }
  };

  // Allow editing physics for Meshes, Groups (GLTF root) or when a collision mesh is present in metadata
  const selectedData = selectedObject ? getObjectData(selectedObject.uuid) : null;
  const canEditPhysics = !!selectedObject && (
    selectedObject.type === 'Mesh' ||
    selectedObject.type === 'Group' ||
    !!(selectedData && selectedData.collisionMesh)
  );

  const isPrimitive = selectedData && (selectedData.type === 'mesh' || selectedData.type === 'primitive');
  const isCharacter = selectedData && (selectedData.type === 'gltf' || selectedData.isPlayer);
  const isGround = selectedObject && (
    selectedObject.name === 'Ground' || 
    selectedObject.name === 'GroundPlane' || 
    selectedObject.name.toLowerCase().includes('ground') ||
    selectedObject.name.toLowerCase().includes('plane')
  );

  if (!canEditPhysics) {
    return (
      <div className="text-sm text-gray-400">Select a mesh or GLTF group with a collision mesh to edit physics properties</div>
    );
  }

  return (
    <div className="mb-4">
      <h5 className="text-xs font-semibold mb-2 text-gray-300">Physics</h5>
      <div className="space-y-2">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="physicsEnabled_left"
            className="mr-2"
            checked={physics.enabled}
            onChange={(e) => handlePhysicsChange('enabled', e.target.checked)}
          />
          <label htmlFor="physicsEnabled_left" className="text-xs text-gray-400">Enable Physics</label>
        </div>

        {physics.enabled && (
          <>
            {/* Show notice if manual collision frames are being used */}
            {collisionFrames.length > 0 && (
              <div className="bg-blue-900/30 border border-blue-700 rounded p-2 text-xs text-blue-300">
                ℹ️ Using {collisionFrames.length} manual collision frame{collisionFrames.length > 1 ? 's' : ''}. Auto-detection disabled.
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Body Type</label>
              <div className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-green-400">
                {collisionFrames.length > 0 ? 'Manual Frames' : 'Auto-detected from mesh'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {collisionFrames.length > 0 
                  ? '✋ Using manual collision frames defined below'
                  : '✨ Collision shape is automatically detected (Box, Sphere, Cylinder, Convex, or Trimesh)'
                }
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="physicsStatic"
                className="mr-2"
                checked={physics.isStatic}
                onChange={(e) => handlePhysicsChange('isStatic', e.target.checked)}
              />
              <label htmlFor="physicsStatic" className="text-xs text-gray-400">
                Static (Mass = 0, immovable platform)
              </label>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Mass: {physics.isStatic ? '0 (Static)' : physics.mass}
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                className="w-full"
                value={physics.mass}
                disabled={physics.isStatic}
                onChange={(e) => handlePhysicsChange('mass', e.target.value)}
              />
              {physics.isStatic && (
                <div className="text-xs text-gray-500 mt-1">Static objects don't move (mass = 0)</div>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Collision Size</label>
              <div className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-green-400">
                Auto-sized from mesh bounds
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ✨ Size is automatically computed to match mesh geometry
              </p>
            </div>

            {/* If GLTF provided a collision mesh, allow using it */}
            {selectedObject && getObjectData(selectedObject.uuid)?.collisionMesh && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="useCollisionMesh"
                  className="mr-2"
                  checked={useCollisionMesh}
                  onChange={(e) => handleToggleCollisionMesh(e.target.checked)}
                />
                <label htmlFor="useCollisionMesh" className="text-xs text-gray-400">Use Collision Mesh (accurate)</label>
              </div>
            )}

            {/* Auto-create collision shapes from geometry */}
            <div className="mt-2">
              <label className="block text-xs text-gray-400 mb-1">Auto-create Collision</label>
              <div className="flex gap-2 items-center">
                <select
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                  value={autoCreateMode}
                  onChange={(e) => setAutoCreateMode(e.target.value)}
                >
                  <option value="convex">Convex Hull (best for dynamic objects)</option>
                  <option value="trimesh">Trimesh (exact, best for static)</option>
                </select>
                <button
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded"
                  onClick={handleAutoCreate}
                >
                  Auto-create collision
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1">Generates a collision shape from the object's geometry and enables physics.</div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isTrigger_left"
                className="mr-2"
                checked={physics.isTrigger}
                onChange={(e) => handlePhysicsChange('isTrigger', e.target.checked)}
              />
              <label htmlFor="isTrigger_left" className="text-xs text-gray-400">Trigger (no physical response; invisible in play)</label>
            </div>

            {/* Collision Frame Editor Section - Hidden for ground objects */}
            {!isGround && (
              <div className="mt-4 pt-4 border-t border-gray-600">
                <h6 className="text-xs font-semibold mb-2 text-gray-300">Collision Frames</h6>
                <p className="text-xs text-gray-400 mb-3">
                  {isPrimitive && '📦 For characters i will edit the collision frame and frame nodes by manually placing'}
                  {isCharacter && '🎮 For characters i will edit the collision frame and frame nodes by manually placing'}
                  {!isPrimitive && !isCharacter && 'Define collision boundaries for this object'}
                </p>

              {/* Auto-generate for primitives */}
              {isPrimitive && (
                <button
                  onClick={autoGenerateFrame}
                  className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors mb-2"
                >
                  🎯 Auto-Generate Frame
                </button>
              )}

              {/* Manual frame creation for characters */}
              {isCharacter && (
                <div className="mb-3">
                  <label className="text-xs text-gray-400 mb-1 block">Add Frame Node:</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => addManualFrame('box')}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                    >
                      📦 Box
                    </button>
                    <button
                      onClick={() => addManualFrame('sphere')}
                      className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition-colors"
                    >
                      ⚪ Sphere
                    </button>
                    <button
                      onClick={() => addManualFrame('capsule')}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs transition-colors"
                    >
                      💊 Capsule
                    </button>
                  </div>
                </div>
              )}

              {/* Frame List */}
              <div className="space-y-2">
                {collisionFrames.length === 0 ? (
                  <div className="text-xs text-gray-500 italic p-2 bg-gray-800 rounded">
                    No collision frames defined
                  </div>
                ) : (
                  collisionFrames.map((frame, index) => (
                    <div
                      key={frame.id}
                      className={`p-2 rounded border ${
                        selectedFrame === frame.id ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800'
                      }`}
                      onClick={() => setSelectedFrame(frame.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-white font-medium">
                          Frame {index + 1} ({frame.type})
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFrame(frame.id); }}
                          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* Position */}
                      <div className="mb-2">
                        <label className="text-xs text-gray-400 block mb-1">Position</label>
                        <div className="grid grid-cols-3 gap-1">
                          {['x', 'y', 'z'].map(axis => (
                            <div key={axis}>
                              <label className="text-xs text-gray-500">{axis.toUpperCase()}</label>
                              <input
                                type="number"
                                step="0.1"
                                value={frame.position?.[axis] ?? 0}
                                onChange={(e) => updateFrame(frame.id, 'position', axis, e.target.value)}
                                className="w-full px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-white text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Size or Radius */}
                      {frame.type === 'box' && (
                        <div className="mb-2">
                          <label className="text-xs text-gray-400 block mb-1">Size</label>
                          <div className="grid grid-cols-3 gap-1">
                            {['x', 'y', 'z'].map(axis => (
                              <div key={axis}>
                                <label className="text-xs text-gray-500">{axis.toUpperCase()}</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={frame.size?.[axis] ?? 1}
                                  onChange={(e) => updateFrame(frame.id, 'size', axis, e.target.value)}
                                  className="w-full px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-white text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(frame.type === 'sphere' || frame.type === 'capsule') && (
                        <div className="mb-2">
                          <label className="text-xs text-gray-400 block mb-1">Radius</label>
                          <input
                            type="number"
                            step="0.1"
                            value={frame.radius ?? 0.5}
                            onChange={(e) => updateFrameRadius(frame.id, e.target.value)}
                            className="w-full px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-white text-xs"
                          />
                        </div>
                      )}

                      {frame.type === 'capsule' && (
                        <div className="mb-2">
                          <label className="text-xs text-gray-400 block mb-1">Height</label>
                          <input
                            type="number"
                            step="0.1"
                            value={frame.size?.y || 1}
                            onChange={(e) => updateFrame(frame.id, 'size', 'y', e.target.value)}
                            className="w-full px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-white text-xs"
                          />
                        </div>
                      )}

                      {/* Rotation */}
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Rotation (deg)</label>
                        <div className="grid grid-cols-3 gap-1">
                          {['x', 'y', 'z'].map(axis => (
                            <div key={axis}>
                              <label className="text-xs text-gray-500">{axis.toUpperCase()}</label>
                              <input
                                type="number"
                                step="1"
                                value={frame.rotation?.[axis] ?? 0}
                                onChange={(e) => updateFrame(frame.id, 'rotation', axis, e.target.value)}
                                className="w-full px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-white text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            )}

            {/* Ground objects get a special message instead of collision frames */}
            {isGround && (
              <div className="mt-4 pt-4 border-t border-gray-600">
                <h6 className="text-xs font-semibold mb-2 text-gray-300">Static Platform</h6>
                <div className="bg-blue-900/30 border border-blue-700 rounded p-3 text-xs text-blue-300">
                  🏔️ <strong>Ground/Platform detected!</strong><br/>
                  This object uses automatic static collision detection.<br/>
                  Use "Static" checkbox above to make it immovable.
                </div>
              </div>
            )}

            {isPlaying && (
              <div className="text-xs text-green-400 bg-green-900 p-2 rounded mt-2">⚡ Physics simulation running</div>
            )}

            {/* Debug info - only in development */}
            {!isPlaying && (
              <div className="mt-4 pt-4 border-t border-gray-600">
                <details className="text-xs">
                  <summary className="text-gray-400 cursor-pointer hover:text-gray-300">🔍 Debug Info</summary>
                  <div className="mt-2 text-gray-500">
                    <div>Selected: {selectedObject?.name || 'None'}</div>
                    <div>Physics enabled: {physics.enabled ? 'Yes' : 'No'}</div>
                    <div>Collision frames: {collisionFrames.length}</div>
                    <div>Object type: {selectedData?.type || 'Unknown'}</div>
                  </div>
                </details>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
