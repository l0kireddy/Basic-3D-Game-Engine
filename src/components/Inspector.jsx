import React, { useEffect, useState } from "react";
import { useSceneStore } from "../store/sceneStore";
import { usePlayStore } from "../store/playStore";
import { AudioComponent } from "./AudioComponent";
import { PostProcessingInspector } from "./PostProcessingInspector";
import * as THREE from 'three';

export default function Inspector() {
  const { selectedObject, updateObjectTransform, updateObjectMaterial, updatePhysicsProperties, getObjectData, updateObjectData } = useSceneStore();
  const { isPlaying } = usePlayStore();
  const [objectData, setObjectData] = useState(null);
  const [transform, setTransform] = useState({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  });
  const [material, setMaterial] = useState({
    color: '#66ccff',
    metalness: 0,
    roughness: 0.5
  });
  const [shadowSettings, setShadowSettings] = useState({
    castShadow: true,
    receiveShadow: true
  });
  const [physics, setPhysics] = useState({
    enabled: false,
    bodyType: 'box',
    mass: 1,
    size: { x: 1, y: 1, z: 1 }
  });
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [animPlaying, setAnimPlaying] = useState(false);
  const [isSkinned, setIsSkinned] = useState(false);

  // Update local state when selected object changes
  useEffect(() => {
    if (selectedObject) {
      const data = getObjectData(selectedObject.uuid);
      setObjectData(data);
      
      // Update transform state from actual object position (real-time)
      const updateTransformFromObject = () => {
        setTransform({
          position: {
            x: selectedObject.position.x,
            y: selectedObject.position.y,
            z: selectedObject.position.z
          },
          rotation: {
            x: selectedObject.rotation.x,
            y: selectedObject.rotation.y,
            z: selectedObject.rotation.z
          },
          scale: {
            x: selectedObject.scale.x,
            y: selectedObject.scale.y,
            z: selectedObject.scale.z
          }
        });
      };

      // Initial update
      updateTransformFromObject();

      // Set up real-time monitoring for transform changes
      const monitorInterval = setInterval(updateTransformFromObject, 100); // Update every 100ms
      
      // Update material state
      if (selectedObject.material) {
        setMaterial({
          color: `#${selectedObject.material.color.getHexString()}`,
          metalness: selectedObject.material.metalness || 0,
          roughness: selectedObject.material.roughness !== undefined ? selectedObject.material.roughness : 0.5
        });
      }
      
      // Update shadow settings
      setShadowSettings({
        castShadow: selectedObject.castShadow || false,
        receiveShadow: selectedObject.receiveShadow || false
      });
      
      // Update physics settings with real-time refresh
      const updatePhysicsFromStore = () => {
        const latestData = getObjectData(selectedObject.uuid);
        if (latestData && latestData.physics) {
          setPhysics({
            enabled: latestData.physics.enabled || false,
            bodyType: latestData.physics.bodyType || 'box',
            mass: latestData.physics.mass || 1,
            size: latestData.physics.size || { x: 1, y: 1, z: 1 }
          });
        } else if (selectedObject.type === 'Mesh') {
          // Default physics settings for mesh objects
          setPhysics({
            enabled: false,
            bodyType: 'box',
            mass: 1,
            size: { x: 1, y: 1, z: 1 }
          });
        }
      };

      // Initial physics update
      updatePhysicsFromStore();

      // Monitor physics changes every 200ms
      const physicsMonitor = setInterval(updatePhysicsFromStore, 200);

      // Detect animations on the selected object
      try {
        const animSources = selectedObject.userData?._gltfAnimations || selectedObject.userData?.actions || (selectedObject.animations || null);
        if (animSources && animSources.length) {
          // Normalize to clip list
          const clipList = Array.isArray(animSources) ? animSources : Object.values(animSources);
          setClips(clipList.map((c, i) => ({ name: c.name || `anim_${i}`, clip: c })));
          setSelectedClip(clipList[0]?.name || null);
        } else {
          setClips([]);
          setSelectedClip(null);
        }
      } catch (err) { setClips([]); setSelectedClip(null); }

      // Detect if this object contains skinned meshes
      try {
        let sk = false;
        selectedObject.traverse((c) => { if (c.isSkinnedMesh) sk = true; });
        setIsSkinned(sk);
      } catch (err) { setIsSkinned(false); }

      // Cleanup function
      return () => {
        clearInterval(monitorInterval);
        clearInterval(physicsMonitor);
      };
    } else {
      setObjectData(null);
      // Reset to default values when no object selected
      setTransform({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      });
      setMaterial({
        color: '#66ccff',
        metalness: 0,
        roughness: 0.5
      });
      setShadowSettings({
        castShadow: true,
        receiveShadow: true
      });
      setPhysics({
        enabled: false,
        bodyType: 'box',
        mass: 1,
        size: { x: 1, y: 1, z: 1 }
      });
    }
  }, [selectedObject, getObjectData]);

  useEffect(() => {
    // Cleanup on deselect: stop any playing action attached to the object
    return () => {
      try {
        if (selectedObject && selectedObject.userData && selectedObject.userData._activeAction) {
          try { selectedObject.userData._activeAction.stop(); } catch (e) {}
          delete selectedObject.userData._activeAction;
        }
      } catch (err) {}
    };
  }, [selectedObject]);

  // Handle transform updates
  const handleTransformChange = (type, axis, value) => {
    const newTransform = { ...transform };
    newTransform[type][axis] = parseFloat(value) || 0;
    setTransform(newTransform);
    
    if (selectedObject) {
      // Update the Three.js object immediately for real-time feedback
      if (type === 'position') {
        selectedObject.position[axis] = parseFloat(value) || 0;
      } else if (type === 'rotation') {
        selectedObject.rotation[axis] = parseFloat(value) || 0;
      } else if (type === 'scale') {
        selectedObject.scale[axis] = parseFloat(value) || 0;
      }
      
      // Update the store
      updateObjectTransform(selectedObject.uuid, newTransform);
    }
  };

  // Handle material updates
  const handleMaterialChange = (property, value) => {
    const newMaterial = { ...material };
    
    if (property === 'color') {
      newMaterial.color = value;
    } else {
      newMaterial[property] = parseFloat(value);
    }
    
    setMaterial(newMaterial);
    
    if (selectedObject) {
      // Create update object with only the changed property
      const materialUpdate = {};
      
      if (property === 'color') {
        materialUpdate.color = parseInt(value.replace('#', ''), 16);
      } else {
        materialUpdate[property] = parseFloat(value);
      }
      
      updateObjectMaterial(selectedObject.uuid, materialUpdate);
    }
  };

  // Handle shadow updates
  const handleShadowChange = (property, value) => {
    const newShadowSettings = { ...shadowSettings };
    newShadowSettings[property] = value;
    setShadowSettings(newShadowSettings);
    
    if (selectedObject) {
      selectedObject[property] = value;
      console.log(`${property} set to ${value} for ${selectedObject.name}`);
    }
  };

  // Handle physics updates
  const handlePhysicsChange = (property, value) => {
    const newPhysics = { ...physics };
    
    if (property === 'enabled') {
      newPhysics.enabled = value;
    } else if (property === 'bodyType') {
      newPhysics.bodyType = value;
    } else if (property === 'mass') {
      newPhysics.mass = parseFloat(value) || 1;
    } else if (property.startsWith('size.')) {
      const axis = property.split('.')[1];
      newPhysics.size[axis] = parseFloat(value) || 1;
    }
    
    setPhysics(newPhysics);
    
    if (selectedObject && selectedObject.type === 'Mesh') {
      updatePhysicsProperties(selectedObject.uuid, newPhysics);
    }
  };

  if (!selectedObject) {
    return (
      <div className="text-white text-sm p-4 space-y-4">
        <div>
          <p className="text-gray-400">No object selected</p>
          <p className="text-xs text-gray-500 mt-2">Click on an object in the 3D viewport to select it</p>
        </div>
        
        <div className="border-t border-gray-700 pt-4">
          <PostProcessingInspector />
        </div>
      </div>
    );
  }
  return (
    <div className="text-white text-sm">
      <div className="mb-4">
        <h4 className="font-semibold mb-2 text-gray-300">Selected Object</h4>
        <p className="text-xs text-gray-400 mb-3">{selectedObject.name || 'Unnamed Object'}</p>
        
        {/* Player Character Designation */}
        <div className="mb-4 p-2 bg-gray-800 rounded">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="isPlayer"
              checked={objectData?.isPlayer || false}
              onChange={(e) => {
                const newData = { ...objectData, isPlayer: e.target.checked };
                updateObjectData(selectedObject.uuid, newData);
                setObjectData(newData);
              }}
              className="rounded"
            />
            <label htmlFor="isPlayer" className="text-xs text-gray-300">
              🎮 Player Character
            </label>
          </div>
          {objectData?.isPlayer && (
            <p className="text-xs text-blue-400 mt-1">
              This character will be controllable with WASD in Play mode
            </p>
          )}
        </div>

        {/* Character Controller Settings */}
        {objectData?.isPlayer && (
          <div className="mb-4 p-2 bg-gray-700 rounded">
            <h5 className="text-xs font-semibold mb-2 text-gray-300">Character Settings</h5>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Move Speed</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs" 
                    value={objectData?.characterSettings?.moveSpeed || 5.0}
                    onChange={(e) => {
                      const newData = { 
                        ...objectData, 
                        characterSettings: { 
                          ...objectData?.characterSettings, 
                          moveSpeed: parseFloat(e.target.value) || 5.0 
                        } 
                      };
                      updateObjectData(selectedObject.uuid, newData);
                      setObjectData(newData);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Jump Force</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs" 
                    value={objectData?.characterSettings?.jumpForce || 8.0}
                    onChange={(e) => {
                      const newData = { 
                        ...objectData, 
                        characterSettings: { 
                          ...objectData?.characterSettings, 
                          jumpForce: parseFloat(e.target.value) || 8.0 
                        } 
                      };
                      updateObjectData(selectedObject.uuid, newData);
                      setObjectData(newData);
                    }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Coyote Time</label>
                  <input 
                    type="number" 
                    step="0.05"
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs" 
                    value={objectData?.characterSettings?.coyoteTime || 0.15}
                    onChange={(e) => {
                      const newData = { 
                        ...objectData, 
                        characterSettings: { 
                          ...objectData?.characterSettings, 
                          coyoteTime: parseFloat(e.target.value) || 0.15 
                        } 
                      };
                      updateObjectData(selectedObject.uuid, newData);
                      setObjectData(newData);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Jump Buffer</label>
                  <input 
                    type="number" 
                    step="0.05"
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs" 
                    value={objectData?.characterSettings?.jumpBufferTime || 0.1}
                    onChange={(e) => {
                      const newData = { 
                        ...objectData, 
                        characterSettings: { 
                          ...objectData?.characterSettings, 
                          jumpBufferTime: parseFloat(e.target.value) || 0.1 
                        } 
                      };
                      updateObjectData(selectedObject.uuid, newData);
                      setObjectData(newData);
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Camera Mode</label>
                <select 
                  className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs"
                  value={objectData?.characterSettings?.cameraMode || 'third-person'}
                  onChange={(e) => {
                    const newData = { 
                      ...objectData, 
                      characterSettings: { 
                        ...objectData?.characterSettings, 
                        cameraMode: e.target.value 
                      } 
                    };
                    updateObjectData(selectedObject.uuid, newData);
                    setObjectData(newData);
                  }}
                >
                  <option value="third-person">Third Person</option>
                  <option value="first-person">First Person</option>
                </select>
              </div>

              {objectData?.characterSettings?.cameraMode === 'third-person' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Camera Distance</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-xs" 
                    value={objectData?.characterSettings?.cameraDistance || 8.0}
                    onChange={(e) => {
                      const newData = { 
                        ...objectData, 
                        characterSettings: { 
                          ...objectData?.characterSettings, 
                          cameraDistance: parseFloat(e.target.value) || 8.0 
                        } 
                      };
                      updateObjectData(selectedObject.uuid, newData);
                      setObjectData(newData);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Transform */}
        <div className="mb-4">
          <h5 className="text-xs font-semibold mb-2 text-gray-300">Transform</h5>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Position</label>
              <div className="flex gap-1">
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="X" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={transform.position.x.toFixed(2)}
                  onChange={(e) => handleTransformChange('position', 'x', e.target.value)}
                />
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="Y" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={transform.position.y.toFixed(2)}
                  onChange={(e) => handleTransformChange('position', 'y', e.target.value)}
                />
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="Z" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={transform.position.z.toFixed(2)}
                  onChange={(e) => handleTransformChange('position', 'z', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rotation</label>
              <div className="flex gap-1">
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="X" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={(transform.rotation.x * 180 / Math.PI).toFixed(1)}
                  onChange={(e) => handleTransformChange('rotation', 'x', e.target.value * Math.PI / 180)}
                />
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="Y" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={(transform.rotation.y * 180 / Math.PI).toFixed(1)}
                  onChange={(e) => handleTransformChange('rotation', 'y', e.target.value * Math.PI / 180)}
                />
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="Z" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={(transform.rotation.z * 180 / Math.PI).toFixed(1)}
                  onChange={(e) => handleTransformChange('rotation', 'z', e.target.value * Math.PI / 180)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Scale</label>
              <div className="flex gap-1">
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="X" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={transform.scale.x.toFixed(2)}
                  onChange={(e) => handleTransformChange('scale', 'x', e.target.value)}
                />
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="Y" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={transform.scale.y.toFixed(2)}
                  onChange={(e) => handleTransformChange('scale', 'y', e.target.value)}
                />
                <input 
                  type="number" 
                  step="0.1"
                  placeholder="Z" 
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" 
                  value={transform.scale.z.toFixed(2)}
                  onChange={(e) => handleTransformChange('scale', 'z', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Material */}
        {selectedObject.material && (
          <div className="mb-4">
            <h5 className="text-xs font-semibold mb-2 text-gray-300">Material</h5>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Color</label>
                <input 
                  type="color" 
                  className="w-full h-8 bg-gray-700 border border-gray-600 rounded" 
                  value={material.color}
                  onChange={(e) => handleMaterialChange('color', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Metalness: {material.metalness.toFixed(1)}</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  className="w-full" 
                  value={material.metalness}
                  onChange={(e) => handleMaterialChange('metalness', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Roughness: {material.roughness.toFixed(1)}</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  className="w-full" 
                  value={material.roughness}
                  onChange={(e) => handleMaterialChange('roughness', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Physics moved to left panel for easier access */}
        <div className="mb-4">
          <h5 className="text-xs font-semibold mb-2 text-gray-300">Physics</h5>
          <div className="text-xs text-gray-400">Physics controls have been moved to the left <strong>Physics</strong> tab for easier access.</div>
          {isSkinned && (
            <div className="text-xs text-yellow-300 mt-2">⚠️ This object contains skinning (bones). Trimesh colliders are not recommended for skinned characters — use convex or simplified primitives (capsules) for stability.</div>
          )}
        </div>

        {/* Shadows */}
        <div className="mb-4">
          <h5 className="text-xs font-semibold mb-2 text-gray-300">Shadows</h5>
          <div className="space-y-2">
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="castShadow" 
                className="mr-2" 
                checked={shadowSettings.castShadow}
                onChange={(e) => handleShadowChange('castShadow', e.target.checked)}
              />
              <label htmlFor="castShadow" className="text-xs text-gray-400">Cast Shadow</label>
            </div>
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="receiveShadow" 
                className="mr-2" 
                checked={shadowSettings.receiveShadow}
                onChange={(e) => handleShadowChange('receiveShadow', e.target.checked)}
              />
              <label htmlFor="receiveShadow" className="text-xs text-gray-400">Receive Shadow</label>
            </div>
          </div>
        </div>

        {/* Audio Component */}
        <div className="mb-4">
          <AudioComponent 
            object={selectedObject}
            objectData={objectData}
            updateObjectData={updateObjectData}
          />
        </div>
      </div>

      {/* Animations */}
      {clips.length > 0 && (
        <div className="mb-4">
          <h5 className="text-xs font-semibold mb-2 text-gray-300">Animations</h5>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Clip</label>
              <select
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
                value={selectedClip || ''}
                onChange={(e) => setSelectedClip(e.target.value)}
              >
                {clips.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                className="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded"
                onClick={() => {
                  try {
                    // Ensure mixer exists
                    if (!selectedObject.userData.mixer) {
                      selectedObject.userData.mixer = new THREE.AnimationMixer(selectedObject);
                      console.log('Created mixer for selected object');
                    }
                    const mixer = selectedObject.userData.mixer;
                    // Resolve clip
                    const clipEntry = clips.find(c => c.name === selectedClip) || clips[0];
                    if (!clipEntry) return;
                    const clip = clipEntry.clip;
                    const action = mixer.clipAction(clip);
                    if (selectedObject.userData._activeAction && selectedObject.userData._activeAction !== action) {
                      try { selectedObject.userData._activeAction.stop(); } catch (e) {}
                    }
                    action.reset();
                    action.play();
                    selectedObject.userData._activeAction = action;
                    // Ensure mixer runs in the viewport (SceneViewport updates per-object mixers)
                    setAnimPlaying(true);
                  } catch (err) { console.error('Play animation failed', err); }
                }}
              >Play</button>

              <button
                className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs px-2 py-1 rounded"
                onClick={() => {
                  try {
                    const mixer = selectedObject.userData.mixer;
                    if (mixer) {
                      mixer.timeScale = mixer.timeScale === 0 ? 1 : 0;
                      setAnimPlaying(mixer.timeScale !== 0);
                    }
                  } catch (err) {}
                }}
              >{animPlaying ? 'Pause' : 'Pause/Resume'}</button>

              <button
                className="bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1 rounded"
                onClick={() => {
                  try {
                    if (selectedObject.userData._activeAction) {
                      selectedObject.userData._activeAction.stop();
                      delete selectedObject.userData._activeAction;
                    }
                    if (selectedObject.userData.mixer) selectedObject.userData.mixer.timeScale = 1;
                    setAnimPlaying(false);
                  } catch (err) {}
                }}
              >Stop</button>
            </div>
            <div className="mt-2">
              <label className="block text-xs text-gray-400 mb-1">Speed: <span className="text-xs text-gray-200">{(selectedObject.userData?.mixer?.timeScale ?? 1).toFixed(2)}x</span></label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                className="w-full"
                value={selectedObject.userData?.mixer?.timeScale ?? 1}
                onChange={(e) => {
                  try {
                    const v = parseFloat(e.target.value);
                    if (!selectedObject.userData.mixer) selectedObject.userData.mixer = new THREE.AnimationMixer(selectedObject);
                    selectedObject.userData.mixer.timeScale = v;
                    setAnimPlaying(v !== 0);
                  } catch (err) {}
                }}
              />

              <label className="block text-xs text-gray-400 mb-1 mt-2">Scrub</label>
              <input
                type="range"
                min="0"
                max={(() => {
                  const clipEntry = clips.find(c => c.name === selectedClip) || clips[0];
                  return clipEntry ? (clipEntry.clip.duration || 1) : 1;
                })()}
                step="0.01"
                className="w-full"
                onChange={(e) => {
                  try {
                    const t = parseFloat(e.target.value);
                    const action = selectedObject.userData._activeAction;
                    if (action) {
                      action.time = t;
                      // force mixer update to apply time change immediately
                      try { selectedObject.userData.mixer.update(0); } catch (e) {}
                    }
                  } catch (err) {}
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Event Sheets Tab */}
      <div className="border-t border-gray-700 pt-4">
        <h4 className="font-semibold mb-2 text-gray-300">Event Sheets</h4>
        <button 
          onClick={() => {
            console.log('📝 Adding event sheet for:', selectedObject.name);
            alert(`Event Sheet creation for ${selectedObject.name}\n(Visual scripting system coming soon!)`);
          }}
          className="w-full px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs"
        >
          Add Event Sheet
        </button>
      </div>
    </div>
  );
}