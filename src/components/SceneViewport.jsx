import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TransformControls } from "three/examples/jsm/controls/TransformControls";
import { DirectionalLightHelper, HemisphereLightHelper } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";
import { useSceneStore } from "../store/sceneStore";
import { usePostProcessingStore } from "../store/postProcessingStore";
import { createPrefabObject } from "../engine/builtInPrefabs";
import { usePlayStore, setSceneStoreRef } from "../store/playStore";
import { useAudioStore } from "../store/audioStore";
import CollisionFrameVisualizer from "./CollisionFrameVisualizer";

export default function SceneViewport() {
  const mountRef = useRef();
  const [sceneState] = useState(() => ({ 
    scene: null, 
    renderer: null, 
    camera: null, 
    controls: null,
    composer: null,
    bloomPass: null,
    ssaoPass: null
  }));
  const clockRef = useRef(new THREE.Clock());
  const mixersRef = useRef([]);
  const { setScene, selectObject, addObject, selectedObject, stepPhysics, addGroundPlane, removeObject, showCollisionFrames, setShowCollisionFrames } = useSceneStore();
  const { isPlaying } = usePlayStore();
  const { initAudio } = useAudioStore();
  const { bloom, ssao } = usePostProcessingStore();

  // Initialize the scene store reference for the play store
  useEffect(() => {
    setSceneStoreRef(useSceneStore);
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);

    // Initialize audio system with camera
    initAudio(camera);
    console.log('🎧 Audio system initialized with camera');

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Setup post-processing
    const composer = new EffectComposer(renderer);
    
    // Base render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Bloom pass (disabled by default)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight),
      0.5,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    bloomPass.enabled = false;
    composer.addPass(bloomPass);
    
    // SSAO pass (disabled by default)
    const ssaoPass = new SSAOPass(scene, camera, mount.clientWidth, mount.clientHeight);
    ssaoPass.kernelRadius = 16;
    ssaoPass.minDistance = 0.005;
    ssaoPass.maxDistance = 0.1;
    ssaoPass.enabled = false;
    composer.addPass(ssaoPass);
    
    // Output pass for color correction
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    
    console.log('✨ Post-processing initialized (Bloom + SSAO)');

    // lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemi.name = "HemisphereLight";
    hemi.position.set(0, 10, 0);
    scene.add(hemi);
    
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.name = "DirectionalLight";
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    scene.add(dir);

    // Add light helpers for visualization and selection
    const dirHelper = new DirectionalLightHelper(dir, 1);
    dirHelper.name = "DirectionalLightHelper";
    dirHelper.visible = false; // Hidden by default
    scene.add(dirHelper);

    const hemiHelper = new HemisphereLightHelper(hemi, 1);
    hemiHelper.name = "HemisphereLightHelper";
    hemiHelper.visible = false; // Hidden by default
    scene.add(hemiHelper);

    // Note: bundles prefabs (droide/armour) are available via the Add Entity prefab modal

    // grid + ground
    const grid = new THREE.GridHelper(50, 50, 0x888888, 0x222222);
    grid.name = 'GridHelper';
    scene.add(grid);

    // ground plane for shadows
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.name = 'GroundPlane';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

    // orbit controls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.05;

    // transform controls
    const transform = new TransformControls(camera, renderer.domElement);
    transform.addEventListener("change", () => {});
    transform.addEventListener("dragging-changed", (event) => {
      orbit.enabled = !event.value;
    });
    scene.add(transform);

    // small demo cube
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
    const cubeMat = new THREE.MeshStandardMaterial({ 
      color: 0x66ccff,
      metalness: 0,
      roughness: 0.5
    });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.set(0, 5, 0); // Start higher up so we can see it fall
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.name = "DemoCube";
    
    // Store original position in userData for physics reset
    cube.userData.originalPosition = cube.position.clone();
    cube.userData.originalRotation = cube.rotation.clone();
    
    scene.add(cube);

    // Load Soldier character with animations
    const soldierLoader = new GLTFLoader();
    soldierLoader.load('/src/assets/threejs-character-controls-example-main/threejs-character-controls-example-main/src/models/Soldier.glb', (gltf) => {
      const soldier = gltf.scene;
      soldier.name = 'Soldier';
      soldier.position.set(3, 0, 0);
      soldier.scale.set(1, 1, 1);
      
      // Setup shadows
      soldier.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Setup animations
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(soldier);
        const actions = {};
        
        gltf.animations.forEach((clip) => {
          const action = mixer.clipAction(clip);
          actions[clip.name] = action;
          console.log(`🎬 Soldier animation: ${clip.name}`);
        });
        
        // Play idle by default
        const idleAction = actions['Idle'] || actions['idle'] || actions['TPose'] || Object.values(actions)[0];
        if (idleAction) {
          idleAction.play();
          soldier.userData.currentAction = idleAction.getClip().name;
        }
        
        soldier.userData.mixer = mixer;
        soldier.userData.actions = actions;
        mixersRef.current.push(mixer);
      }

      scene.add(soldier);
      
      // Add to store with player character flag and physics enabled
      addObject(soldier, { 
        type: 'gltf', 
        filename: 'Soldier.glb',
        isPlayer: true,
        physics: {
          enabled: true,
          mass: 1,
          isStatic: false
        },
        characterSettings: {
          moveSpeed: 5,
          jumpForce: 8,
          coyoteTime: 0.15,
          jumpBuffer: 0.1,
          cameraMode: 'Third Person'
        }
      });
      
      console.log('✅ Soldier model loaded with animations:', Object.keys(soldier.userData.actions || {}));
      console.log('✅ Soldier physics auto-enabled');
    }, undefined, (err) => {
      console.error('❌ Failed to load soldier.glb:', err);
    });

    // allow selecting object with click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onPointerDown(e) {
      // Disable object selection and transform controls in play mode
      if (isPlaying) return;
      
      if (transform.dragging) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      
      const selectableObjects = scene.children.filter(obj => 
        obj.type === 'Mesh' || 
        (obj.type === 'Group' && obj.name !== '') ||
        obj.type === 'DirectionalLight' ||
        obj.type === 'HemisphereLight' ||
        obj.type === 'PointLight' ||
        obj.type === 'SpotLight'
      );
      
      let hits = raycaster.intersectObjects(selectableObjects, true);
      // Ignore helper overlays (wireframes and physics debug) and pick the first real object
      hits = hits.filter(h => 
        h.object && 
        h.object.name !== '__wireframeHelper' && 
        h.object.name !== '__physicsHelper' &&
        h.object.type !== 'LineSegments'
      );
      if (hits.length) {
        const picked = hits[0].object;
        // attach transform controls to the root mesh
        let root = picked;
        while (root.parent && root.parent.type !== "Scene") root = root.parent;
        transform.attach(root);
        
        // Update store with selected object
        selectObject(root);
        console.log("Selected:", root.name || "Unnamed object");
      } else {
        transform.detach();
        selectObject(null);
        console.log("Deselected");
      }
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);

    // drag & drop gltf
    function handleDrop(e) {
      e.preventDefault();
      // First, check for prefab payloads
      try {
        const text = e.dataTransfer.getData('text/plain') || '';
        if (text && text.startsWith('gd3d-prefab:')) {
          const prefab = text.split(':')[1];
          // Compute drop world position by raycasting to the ground plane
          const rect = renderer.domElement.getBoundingClientRect();
          const mouse = new THREE.Vector2();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          const raycaster2 = new THREE.Raycaster();
          raycaster2.setFromCamera(mouse, camera);
          // try to intersect the ground (plane mesh added earlier)
          const ground = scene.getObjectByName('GroundDropHelper') || scene.getObjectByName('GridHelper') || scene.getObjectByName('Plane_0');
          let pos = null;
          if (ground) {
            const hits = raycaster2.intersectObject(ground, true);
            if (hits.length) pos = hits[0].point;
          }
          // fallback: place at some distance in front of camera
          if (!pos) {
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            pos = camera.position.clone().add(dir.multiplyScalar(6));
          }

          const newObj = createPrefabObject(prefab);
          if (newObj) {
            // If this prefab references a GLTF asset, load that GLTF lazily instead of adding the placeholder
            if (newObj.userData && newObj.userData._prefabGLTF) {
              const loader = new GLTFLoader();
              loader.load(newObj.userData._prefabGLTF, (gltf) => {
                const root = gltf.scene;
                root.name = prefab;
                root.position.copy(pos);
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

                // Create mixer for preview if there are animations
                try {
                  if (gltf.animations && gltf.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(root);
                    const actions = {};
                    gltf.animations.forEach((clip, i) => { actions[clip.name || `anim_${i}`] = mixer.clipAction(clip); });
                    const first = Object.values(actions)[0]; if (first) first.play();
                    root.userData.mixer = mixer;
                    root.userData.actions = actions;
                    mixersRef.current.push(mixer);
                  }
                } catch (err) { /* ignore */ }

                scene.add(root);
                const metadata = { type: 'gltf', filename: newObj.userData._prefabGLTF };
                if (collisionMesh) metadata.collisionMesh = collisionMesh.uuid;
                addObject(root, metadata);
                selectObject(root);
              }, undefined, (err) => { console.error('Failed to load prefab GLTF', err); });
            } else {
              newObj.position.copy(pos);
              newObj.userData = newObj.userData || {};
              newObj.userData.originalPosition = newObj.position.clone();
              scene.add(newObj);
              // Add metadata similar to createEntityFromPrefab
              const metadata = { type: newObj.type === 'Mesh' ? 'primitive' : newObj.type.toLowerCase(), primitive: prefab };
              if (prefab === 'platform' || prefab === 'solidPlatform') {
                metadata.physics = {
                  enabled: false,
                  bodyType: prefab === 'platform' ? 'platform' : 'solidPlatform',
                  mass: 0,
                  size: newObj.geometry ? (() => { const b = new THREE.Box3().setFromObject(newObj); const s = new THREE.Vector3(); b.getSize(s); return { x: s.x, y: s.y, z: s.z }; })() : { x: 1, y: 0.2, z: 1 }
                };
              }
              addObject(newObj, metadata);
              selectObject(newObj);
            }
          }
          return;
        }
      } catch (err) {
        // ignore and fall back to file handling below
      }

      // File drop behavior (glTF/GLB)
      const file = e.dataTransfer.files[0];
      if (!file) return;
      
      const isGLTF = file.name.toLowerCase().endsWith('.gltf') || 
                     file.name.toLowerCase().endsWith('.glb');
      
      if (!isGLTF) {
        alert('Please drop a GLTF (.gltf) or GLB (.glb) file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const arrayBuffer = ev.target.result;
        const loader = new GLTFLoader();
        loader.parse(arrayBuffer, "", (gltf) => {
          const root = gltf.scene;
          root.name = file.name.replace(/\.(gltf|glb)$/i, '');
          root.position.set(0, 0, 0);
          
          // Detect collision meshes inside the GLTF (nodes named "collision" or containing "collision")
          let collisionMesh = null;
          root.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (/collision/i.test(child.name || '')) {
                collisionMesh = child;
                child.userData.isCollisionMesh = true;
                // Hide collision meshes by default in the editor
                child.visible = false;
              }
            }
          });

          // If the GLTF contained animations, create an AnimationMixer for preview/playback
          try {
            if (gltf.animations && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(root);
              const actions = {};
              gltf.animations.forEach((clip, i) => {
                const name = clip.name || `anim_${i}`;
                actions[name] = mixer.clipAction(clip);
              });
              // Start playing the first animation for quick preview
              const firstAction = Object.values(actions)[0];
              if (firstAction) {
                firstAction.play();
              }
              root.userData.mixer = mixer;
              root.userData.actions = actions;
              mixersRef.current.push(mixer);
              console.log(`🎞️ Created AnimationMixer for ${root.name}, clips: ${gltf.animations.length}`);
            }
          } catch (err) {
            console.warn('Failed to create AnimationMixer for GLTF', err);
          }
          
          scene.add(root);

          // Add to store with original position. If there was a collision mesh, reference it in metadata so physics inspector can use it.
          const metadata = {
            type: 'gltf',
            filename: file.name,
            originalPosition: { x: 0, y: 0, z: 0 }
          };
          if (collisionMesh) metadata.collisionMesh = collisionMesh.uuid;
          addObject(root, metadata);
          console.log("Loaded:", root.name);
        }, (err) => {
          console.error("Error loading GLTF:", err);
          alert("Error loading GLTF file");
        });
      };
      reader.readAsArrayBuffer(file);
    }
    
    function handleDragOver(e) { 
      e.preventDefault(); 
      e.dataTransfer.dropEffect = 'copy';
    }
    
    renderer.domElement.addEventListener("drop", handleDrop);
    renderer.domElement.addEventListener("dragover", handleDragOver);

    // animation loop
    let raf;
    let frameCount = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      frameCount++;

      // Compute delta once per frame and use for mixers and physics
      let delta = 0;
      try {
        delta = clockRef.current.getDelta();

        // Update mixers we explicitly track
        mixersRef.current.forEach((m) => {
          try { m.update(delta); } catch (err) { /* ignore per-mixer errors */ }
        });
        // Also update any mixer attached to objects in the scene (created by Inspector or other code)
        try {
          scene.traverse((obj) => {
            if (obj.userData && obj.userData.mixer) {
              try { obj.userData.mixer.update(delta); } catch (err) { /* ignore per-object mixer errors */ }
            }
          });
        } catch (err) { /* ignore scene traversal errors */ }
      } catch (err) { /* ignore */ }

      // Get current playing state
      const currentIsPlaying = usePlayStore.getState().isPlaying;

      // Update physics simulation when playing
      if (currentIsPlaying) {
  // Use the same delta computed above for physics stepping
  const deltaTime = delta || 1/60;

  // Clamp deltaTime to prevent physics explosions (max 30 FPS step)
  const clampedDeltaTime = Math.min(deltaTime, 1/30);

        // Add debug every 60 frames (1 second)
        if (frameCount % 60 === 0) {
          console.log('🎬 Animation loop - Physics active, deltaTime:', clampedDeltaTime);
        }

        // Get physics world directly and step it
        const sceneStore = useSceneStore.getState();
        const { physicsWorld } = sceneStore;

        if (physicsWorld && physicsWorld.enabled) {
          physicsWorld.step(clampedDeltaTime);

          // Log physics activity every 60 frames
          if (frameCount % 60 === 0) {
            console.log('🔄 Physics step executed, bodies:', physicsWorld.bodies.size);
          }
        } else if (frameCount % 60 === 0) {
          console.log('⚠️ Physics world not enabled or not found');
        }
      } else if (frameCount % 120 === 0) {
        console.log('⏸️ Animation loop - Not playing, physics disabled');
      }

      orbit.update();
      composer.render();
    }
    animate();

    // resize
    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      composer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", onResize);

    // save references for cleanup
    sceneState.scene = scene;
    sceneState.renderer = renderer;
    sceneState.camera = camera;
    sceneState.controls = { orbit, transform };
    sceneState.composer = composer;
    sceneState.bloomPass = bloomPass;
    sceneState.ssaoPass = ssaoPass;

    // Set scene in store
    setScene(scene);
    
    // Add a physics ground plane for testing
    addGroundPlane(0);
    console.log('🌍 Added physics ground plane at Y=0');
    
    // Add initial objects to store
    addObject(cube, { 
      type: 'primitive', 
      primitive: 'box',
      originalPosition: { x: 0, y: 5, z: 0 }, // Store original position
      physics: { 
        enabled: true,  // Enable physics by default for testing
        bodyType: 'box',
        mass: 1,
        size: { x: 1, y: 1, z: 1 }
      }
    });
    addObject(hemi, { type: 'light', lightType: 'hemisphere' });
    addObject(dir, { type: 'light', lightType: 'directional' });

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("drop", handleDrop);
      renderer.domElement.removeEventListener("dragover", handleDragOver);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [sceneState]);

  // Effect to handle play mode state changes
  useEffect(() => {
    if (sceneState.scene && sceneState.controls?.transform) {
      const transform = sceneState.controls.transform;

      if (isPlaying) {
        // Disable transform controls in play mode
        try { transform.detach(); } catch (e) {}
        transform.visible = false;
        selectObject(null); // Clear selection

        // Hide grid and helpers in play mode
        const grid = sceneState.scene.getObjectByName('GridHelper');
        if (grid) grid.visible = false;

        const dirHelper = sceneState.scene.getObjectByName('DirectionalLightHelper');
        if (dirHelper) dirHelper.visible = false;

        const hemiHelper = sceneState.scene.getObjectByName('HemisphereLightHelper');
        if (hemiHelper) hemiHelper.visible = false;

        console.log('🎮 Play mode: Transform controls and gizmos disabled');
        // Hide trigger/collision visuals during play
        try {
          const state = useSceneStore.getState();
          state.objects.forEach((objData, objId) => {
            try {
              const threeObj = sceneState.scene.getObjectByProperty('uuid', objId);
              if (!threeObj) return;
              const isTrigger = objData?.physics?.isTrigger;
              const usedCollision = objData?.collisionMesh;
              if (isTrigger && threeObj.visible) {
                threeObj.userData._prevVisible = threeObj.visible;
                threeObj.visible = false;
              }
              if (usedCollision) {
                const col = sceneState.scene.getObjectByProperty('uuid', usedCollision);
                if (col) {
                  col.userData._prevVisible = col.visible;
                  col.visible = false;
                }
              }
            } catch (err) { /* ignore per-object errors */ }
          });
        } catch (err) { /* ignore */ }
      } else {
        // Re-enable transform controls in edit mode only if an object is selected
        if (selectedObject) {
          try { transform.attach(selectedObject); } catch (e) {}
          transform.visible = true;
          console.log('✏️ Edit mode: Transform controls enabled for selected object');
        } else {
          // No selection - keep transform controls detached and hidden
          try { transform.detach(); } catch (e) {}
          transform.visible = false;
          console.log('✏️ Edit mode: No selection, transform controls remain hidden');
        }

        // Show grid and keep helpers hidden (they can be toggled manually)
        const grid = sceneState.scene.getObjectByName('GridHelper');
        if (grid) grid.visible = true;
        // Restore trigger/collision visuals visibility
        try {
          const state = useSceneStore.getState();
          state.objects.forEach((objData, objId) => {
            try {
              const threeObj = sceneState.scene.getObjectByProperty('uuid', objId);
              if (!threeObj) return;
              if (threeObj.userData && threeObj.userData._prevVisible !== undefined) {
                threeObj.visible = threeObj.userData._prevVisible;
                delete threeObj.userData._prevVisible;
              }
              const usedCollision = objData?.collisionMesh;
              if (usedCollision) {
                const col = sceneState.scene.getObjectByProperty('uuid', usedCollision);
                if (col && col.userData && col.userData._prevVisible !== undefined) {
                  col.visible = col.userData._prevVisible;
                  delete col.userData._prevVisible;
                }
              }
            } catch (err) { /* ignore */ }
          });
        } catch (err) { /* ignore */ }
      }
    }
  }, [isPlaying, sceneState.scene, sceneState.controls, selectedObject, selectObject]);

  // Keyboard shortcuts for transform controls: G = translate, S = scale, R = rotate
  useEffect(() => {
    function onKeyDown(e) {
      // ignore when playing
      if (isPlaying) return;

      const transform = sceneState.controls?.transform;
      if (!transform) return;

      const key = (e.key || '').toLowerCase();
      if (!['g', 's', 'r'].includes(key)) return;

      // Only allow when an object is selected
      if (!selectedObject) {
        console.log('No object selected - cannot change transform mode');
        return;
      }

      try {
        // Attach transform to selected object if not already
        transform.attach(selectedObject);
      } catch (err) {
        // ignore attach errors
      }

      if (key === 'g') {
        transform.setMode('translate');
        console.log('G pressed — transform mode: translate');
      } else if (key === 's') {
        transform.setMode('scale');
        console.log('S pressed — transform mode: scale');
      } else if (key === 'r') {
        transform.setMode('rotate');
        console.log('R pressed — transform mode: rotate');
      }

      // ensure transform visible when switching modes
      transform.visible = true;
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, sceneState.controls, selectedObject]);

  // Keyboard handler for deleting selected object (Delete / Backspace)
  useEffect(() => {
    function onDeleteKey(e) {
      if (isPlaying) return;
      if (!selectedObject) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const name = selectedObject.name || 'Unnamed object';
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
          removeObject(selectedObject.uuid);
          console.log(`Deleted object via keyboard: ${name}`);
        } catch (err) {
          console.error('Failed to delete object:', err);
        }
      }
    }

    window.addEventListener('keydown', onDeleteKey);
    return () => window.removeEventListener('keydown', onDeleteKey);
  }, [isPlaying, selectedObject, removeObject]);

  // Update post-processing effects when settings change
  useEffect(() => {
    if (!sceneState.bloomPass || !sceneState.ssaoPass) return;
    
    const { bloomPass, ssaoPass } = sceneState;
    
    // Update Bloom
    bloomPass.enabled = bloom.enabled;
    bloomPass.strength = bloom.strength;
    bloomPass.radius = bloom.radius;
    bloomPass.threshold = bloom.threshold;
    
    // Update SSAO
    ssaoPass.enabled = ssao.enabled;
    ssaoPass.kernelRadius = ssao.kernelRadius;
    ssaoPass.minDistance = ssao.minDistance;
    ssaoPass.maxDistance = ssao.maxDistance;
    
    console.log('✨ Post-processing updated:', {
      bloom: bloom.enabled ? 'ON' : 'OFF',
      ssao: ssao.enabled ? 'ON' : 'OFF'
    });
  }, [bloom, ssao, sceneState.bloomPass, sceneState.ssaoPass]);

  return (
    <div 
      ref={mountRef} 
      className="relative w-full h-full"
    >
      {/* Collision Frame Visualizer - Only show in editor mode, not during play */}
      {sceneState.scene && !isPlaying && (
        <CollisionFrameVisualizer 
          scene={sceneState.scene} 
          enabled={showCollisionFrames} 
        />
      )}
      
      {/* Drop zone overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-2 rounded text-sm z-10">
        Drop GLTF/GLB files here to import
      </div>

      {/* Toggle collision frames button - Only show in editor mode */}
      {!isPlaying && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => setShowCollisionFrames(!showCollisionFrames)}
            className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
              showCollisionFrames 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {showCollisionFrames ? '👁️ Collision Frames ON' : '🚫 Collision Frames OFF'}
          </button>
        </div>
      )}

      {/* Delete selected object button (editor only) */}
      {!isPlaying && (
        <div className="absolute top-16 right-4 z-10">
          <button
            onClick={() => {
              if (!selectedObject) return;
              const name = selectedObject.name || 'Unnamed object';
              if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
              removeObject(selectedObject.uuid);
              console.log(`Deleted object: ${name}`);
            }}
            className={`px-3 py-2 rounded text-xs font-medium transition-colors bg-red-600 hover:bg-red-700 text-white`}
            title="Delete selected object"
          >
            🗑️ Delete Selected
          </button>
        </div>
      )}
    </div>
  );
}