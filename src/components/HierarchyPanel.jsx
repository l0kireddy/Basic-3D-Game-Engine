import React, { useState, useEffect } from "react";
import { useSceneStore } from "../store/sceneStore";
import * as THREE from "three";
import { createPrefabObject } from "../engine/builtInPrefabs";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default function HierarchyPanel() {
  const { getObjectsArray, selectObject, selectedObject, scene, addObject } = useSceneStore();
  const objects = getObjectsArray();

  const handleObjectClick = (objectId) => {
    const sceneRef = useSceneStore.getState().scene;
    const object = sceneRef?.getObjectByProperty('uuid', objectId);
    if (object) {
      selectObject(object);
    }
  };

  const handleCreatePrefab = () => {
    if (selectedObject) {
      console.log('🎯 Creating prefab from:', selectedObject.name);
      // TODO: Implement prefab creation
      alert(`Prefab created from ${selectedObject.name}!\n(Feature coming soon)`);
    } else {
      alert('Please select an object first to create a prefab');
    }
  };
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem('gd3d_fav_prefabs');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [recent, setRecent] = useState(() => {
    try {
      const raw = localStorage.getItem('gd3d_recent_prefabs');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  const handleAddEntity = () => {
    // Open modal to choose prefab
    setShowAddModal(true);
  };

  const createEntityFromPrefab = (prefab, position = null) => {
    console.log('🎯 createEntityFromPrefab called with:', prefab, position);
    const sceneRef = useSceneStore.getState().scene;
    console.log('🎯 sceneRef:', sceneRef);
    if (!sceneRef) {
      console.warn('createEntityFromPrefab: scene not ready yet');
      alert('Scene not ready yet. Please wait a moment and try again.');
      return;
    }

    console.log('🎯 calling createPrefabObject with:', prefab);
    const obj = createPrefabObject(prefab);
    console.log('🎯 createPrefabObject returned:', obj);
    if (!obj) {
      console.error('🎯 createPrefabObject returned null/undefined for:', prefab);
      return;
    }

    // place at provided position or random nearby
    if (position && obj.position) {
      obj.position.set(position.x, position.y, position.z);
    } else if (obj.position) {
      const randPos = () => ({ x: (Math.random() - 0.5) * 6, y: Math.random() * 3 + 1, z: (Math.random() - 0.5) * 6 });
      const pos = randPos();
      obj.position.set(pos.x, pos.y, pos.z);
    }

    // store original transforms
    obj.userData = obj.userData || {};
    obj.userData.originalPosition = obj.position ? obj.position.clone() : new THREE.Vector3();
    obj.userData.originalRotation = obj.rotation ? obj.rotation.clone() : new THREE.Euler();

    // If prefab points to a GLTF asset, load it instead
    if (obj.userData && obj.userData._prefabGLTF) {
      console.log('createEntityFromPrefab: lazy-loading GLTF prefab ->', obj.userData._prefabGLTF);
      // Create a placeholder group so user gets immediate feedback in the scene
      const placeholder = new THREE.Group();
      placeholder.name = `${prefab}_loading_${Date.now()}`;
      placeholder.position.set(position?.x || 0, position?.y || 1, position?.z || 0);
      placeholder.userData = placeholder.userData || {};
      placeholder.userData._isPlaceholder = true;
      sceneRef.add(placeholder);
      addObject(placeholder, { type: 'gltf', primitive: prefab, filename: obj.userData._prefabGLTF, loading: true });
      selectObject(placeholder);

      const loader = new GLTFLoader();
      loader.load(obj.userData._prefabGLTF, (gltf) => {
        const root = gltf.scene;
        root.name = prefab;
        // position root where placeholder was
        root.position.copy(placeholder.position);

        // Setup shadows and detect collision mesh
        let collisionMesh = null;
        root.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (/collision/i.test(child.name || '')) {
              collisionMesh = child;
              child.userData.isCollisionMesh = true;
              child.visible = false;
            }
          }
        });

        // Animations
        try {
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(root);
            const actions = {};
            gltf.animations.forEach((clip, i) => { 
              const action = mixer.clipAction(clip);
              actions[clip.name || `anim_${i}`] = action;
            });
            
            // Don't auto-play animations - let the user control them
            // const first = Object.values(actions)[0]; if (first) first.play();
            
            root.userData.mixer = mixer;
            root.userData.actions = actions;
            console.log(`🎬 Character loaded with ${Object.keys(actions).length} animations:`, Object.keys(actions));
          }
        } catch (err) { /* ignore */ }

        // Replace placeholder with real root
        try {
          // remove placeholder from scene and store
          sceneRef.remove(placeholder);
          // remove placeholder entry from objects map
          const state = useSceneStore.getState();
          const objs = new Map(state.objects);
          objs.delete(placeholder.uuid);
          state.setObjects && state.setObjects(objs);
        } catch (e) { /* ignore */ }

        sceneRef.add(root);
        const metadata = { type: 'gltf', primitive: prefab, filename: obj.userData._prefabGLTF };
        if (collisionMesh) metadata.collisionMesh = collisionMesh.uuid;
        addObject(root, metadata);
        selectObject(root);
        setShowAddModal(false);
        console.log('createEntityFromPrefab: GLTF prefab loaded and added:', prefab);
      }, undefined, (err) => {
        console.error('Failed to load prefab GLTF', err);
        // keep placeholder but mark error
        placeholder.name = `${prefab}_load_failed`;
        placeholder.userData.loadError = true;
        alert(`Failed to load prefab ${prefab}: see console for details.`);
      });
      return;
    }

    sceneRef.add(obj);

    // metadata
    const metadata = { type: obj.type === 'Mesh' ? 'primitive' : obj.type.toLowerCase(), primitive: prefab };
    if (prefab === 'platform' || prefab === 'solidPlatform') {
      metadata.physics = {
        enabled: false,
        bodyType: prefab === 'platform' ? 'platform' : 'solidPlatform',
        mass: 0,
        size: obj.geometry ? (() => { const b = new THREE.Box3().setFromObject(obj); const s = new THREE.Vector3(); b.getSize(s); return { x: s.x, y: s.y, z: s.z }; })() : { x: 1, y: 0.2, z: 1 }
      };
    }

    addObject(obj, metadata);
    selectObject(obj);
    setShowAddModal(false);

    // Update recent list (most recent first, unique, limit 8)
    try {
      const newRecent = [prefab].concat(recent.filter((r) => r !== prefab)).slice(0, 8);
      setRecent(newRecent);
      localStorage.setItem('gd3d_recent_prefabs', JSON.stringify(newRecent));
    } catch (e) {
      // ignore
    }
  };

  const toggleFavorite = (prefab) => {
    try {
      const exists = favorites.includes(prefab);
      const next = exists ? favorites.filter((f) => f !== prefab) : [prefab, ...favorites];
      setFavorites(next);
      localStorage.setItem('gd3d_fav_prefabs', JSON.stringify(next));
    } catch (e) {
      // ignore
    }
  };

  const handleImportAsset = () => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gltf,.glb';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('📁 Importing asset:', file.name);
        // For now, just show an alert - the drag & drop in viewport already works
        alert(`Asset import: ${file.name}\nUse drag & drop in the 3D viewport for now`);
      }
    };
    input.click();
  };
  
  // Helper: human readable label
  const prefabLabel = (key) => {
    switch (key) {
      case 'cube': return 'Cube';
      case 'sphere': return 'Sphere';
      case 'cylinder': return 'Cylinder';
      case 'plane': return 'Plane';
      case 'platform': return 'Platform (Trigger)';
      case 'solidPlatform': return 'Solid Platform';
      case 'directionalLight': return 'Directional Light';
      case 'empty': return 'Empty Group';
      case 'droide': return 'Droide (Character)';
      case 'armour': return 'Armour (Character)';
      default: return key;
    }
  };

  // Inline SVG thumbnails (data URIs) for small, sharp UI thumbnails
  const prefabThumbnail = (key) => {
    const svgs = {
      cube: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='12' y='16' width='40' height='32' rx='4' fill='%2366ccff' stroke='%23000000' stroke-opacity='0.1'/></svg>`,
      sphere: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='18' fill='%23ffcc66' stroke='%23000000' stroke-opacity='0.08'/></svg>`,
      cylinder: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><ellipse cx='32' cy='18' rx='14' ry='6' fill='%23d19c97' /><rect x='18' y='18' width='28' height='28' fill='%23d19c97' /></svg>`,
      plane: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='8' y='28' width='48' height='8' fill='%23444444' /></svg>`,
      platform: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='14' y='30' width='36' height='6' rx='2' fill='%238b5cf6'/></svg>`,
      solidPlatform: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='10' y='28' width='44' height='10' rx='2' fill='%2310b981'/></svg>`,
      directionalLight: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='20' r='6' fill='%23ffff66'/></svg>`,
      empty: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='14' y='18' width='36' height='28' rx='3' fill='%23bbbbbb'/></svg>`
    ,
    droide: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='18' y='8' width='28' height='36' rx='6' fill='%23b3e5ff' /></svg>`,
    armour: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='14' y='6' width='36' height='44' rx='6' fill='%23c7c7ff' /></svg>`,
    };
    return svgs[key] ? `data:image/svg+xml;utf8,${encodeURIComponent(svgs[key])}` : '';
  };

  // Prefab button component (local)
  function PrefabButton({ prefab, createEntity, isFavAction, favorites = [] }) {
    const isFav = favorites && favorites.includes(prefab);
    const imgSrc = prefabThumbnail(prefab);

    const onDragStart = (e) => {
      // Mark drag payload so viewport knows it's a prefab drop
      try { e.dataTransfer.setData('text/plain', `gd3d-prefab:${prefab}`); } catch (err) { /* older browsers */ }
      // set drag image for nicer UX
      if (e.dataTransfer.setDragImage) {
        const img = new Image();
        img.src = imgSrc;
        img.width = 64;
        img.height = 64;
        e.dataTransfer.setDragImage(img, 16, 16);
      }
    };

    return (
      <div className="relative" draggable onDragStart={onDragStart}>
        <button
          onClick={() => {
            console.log('🎯 PrefabButton clicked for:', prefab);
            createEntity(prefab);
          }}
          className="p-3 bg-gray-700 hover:bg-gray-600 rounded w-full h-full flex flex-col items-center justify-center"
          title={prefabLabel(prefab)}
        >
          <img src={imgSrc} alt={prefab} className="mb-2" style={{ width: 40, height: 40 }} />
          <div className="text-xs text-gray-200">{prefabLabel(prefab)}</div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (isFavAction) isFavAction(prefab); }}
          className={`absolute top-1 right-1 text-sm rounded px-1 ${isFav ? 'text-yellow-400' : 'text-gray-400 hover:text-white'}`}
          title={isFav ? 'Unfavorite' : 'Favorite'}
        >
          ★
        </button>
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="mb-4">
        <h4 className="text-sm font-semibold mb-2 text-gray-300">Assets</h4>
        <p className="text-xs text-gray-400 mb-2">
          Drop GLTF files into the viewport to import
        </p>
        <button 
          onClick={handleImportAsset}
          className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
        >
          Import Asset
        </button>
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2 text-gray-300">Scene Hierarchy</h4>
        <ul className="text-sm space-y-1">
          <li className="flex items-center">
            <span className="mr-1">📁</span>
            <span>Scene ({objects.length} objects)</span>
          </li>
          {objects.map((obj) => (
            <li 
              key={obj.id}
              className={`flex items-center ml-4 cursor-pointer hover:bg-gray-700 px-1 rounded ${
                selectedObject?.uuid === obj.id ? 'bg-blue-600' : ''
              }`}
              onClick={() => handleObjectClick(obj.id)}
            >
              <span className="mr-1">
                {obj.type === 'Mesh' ? '�' : 
                 obj.type === 'Group' ? '📦' :
                 obj.type === 'HemisphereLight' ? '💡' :
                 obj.type === 'DirectionalLight' ? '☀️' :
                 obj.type === 'GridHelper' ? '🌐' : '❓'}
              </span>
              <span className="truncate">{obj.name}</span>
            </li>
          ))}
          {objects.length === 0 && (
            <li className="flex items-center ml-4 text-gray-500 text-xs">
              <span>No objects in scene</span>
            </li>
          )}
        </ul>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-700">
        <button 
          onClick={handleCreatePrefab}
          className="w-full px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs mb-2"
        >
          Create Prefab
        </button>
        <button 
          onClick={handleAddEntity}
          className="w-full px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
        >
          Add Entity
        </button>
      </div>

      {/* Add Entity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowAddModal(false)} />
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-3/4 max-w-2xl z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Add Entity</h3>
              <button className="text-gray-300 hover:text-white" onClick={() => setShowAddModal(false)}>Close ✖</button>
            </div>

            <div className="mb-3 flex gap-2">
              <input
                type="text"
                placeholder="Search prefabs..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className={`px-3 py-2 rounded ${showOnlyFavorites ? 'bg-yellow-600 text-black' : 'bg-gray-700 text-white'}`}
                onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                title="Show only favorites"
              >
                ★
              </button>
            </div>

            {/* Favorites section */}
            {favorites.length > 0 && !showOnlyFavorites && (
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Favorites</h4>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {favorites.map((pf) => (
                    <PrefabButton key={pf} prefab={pf} createEntity={createEntityFromPrefab} isFavorite isFavAction={toggleFavorite} />
                  ))}
                </div>
              </div>
            )}

            {/* Recent section */}
            {recent.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Recent</h4>
                <div className="grid grid-cols-6 gap-2 mb-2">
                  {recent.map((pf) => (
                    <PrefabButton key={pf} prefab={pf} createEntity={createEntityFromPrefab} isFavAction={toggleFavorite} favorites={favorites} />
                  ))}
                </div>
              </div>
            )}

              <div className="grid grid-cols-3 gap-3">
                {['cube','sphere','cylinder','plane','platform','solidPlatform','directionalLight','droide','armour','empty'].filter(pf => {
                  if (showOnlyFavorites && !favorites.includes(pf)) return false;
                  if (!searchQuery) return true;
                  return pf.toLowerCase().includes(searchQuery.toLowerCase()) || prefabLabel(pf).toLowerCase().includes(searchQuery.toLowerCase());
                }).map((pf) => (
                  <PrefabButton key={pf} prefab={pf} createEntity={createEntityFromPrefab} isFavAction={toggleFavorite} favorites={favorites} />
                ))}
                <button onClick={() => { alert('More prefabs coming soon'); }} className="p-3 bg-gray-700 hover:bg-gray-600 rounded text-center">More...</button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}