import React, { useEffect, useRef } from 'react';
import { usePlayStore } from '../store/playStore';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

export default function CharacterController() {
  const { isPlaying } = usePlayStore();
  const { scene } = useSceneStore();
  const keysRef = useRef({});
  const playerRef = useRef(null);
  
  // Movement vectors
  const walkDirection = useRef(new THREE.Vector3());
  const rotateAngle = useRef(new THREE.Vector3(0, 1, 0));
  const rotateQuaternion = useRef(new THREE.Quaternion());
  
  // Constants
  const walkVelocity = 2;
  const runVelocity = 5;
  const fadeDuration = 0.2;
  
  // Key mappings
  const W = 'w';
  const A = 'a';
  const S = 's';
  const D = 'd';
  const SHIFT = 'shift';
  const DIRECTIONS = [W, A, S, D];

  // Find player character
  const findPlayer = () => {
    if (!scene) return null;
    
    let player = null;
    scene.traverse((child) => {
      if (!player && child.name && child.name.toLowerCase().includes('droide')) {
        player = child;
      }
    });
    
    console.log(' Found player:', player?.name);
    return player;
  };

  // Direction offset calculation
  const directionOffset = (keysPressed) => {
    let offset = 0;
    
    if (keysPressed[W]) {
      if (keysPressed[A]) offset = Math.PI / 4;
      else if (keysPressed[D]) offset = -Math.PI / 4;
    } else if (keysPressed[S]) {
      if (keysPressed[A]) offset = Math.PI / 4 + Math.PI / 2;
      else if (keysPressed[D]) offset = -Math.PI / 4 - Math.PI / 2;
      else offset = Math.PI;
    } else if (keysPressed[A]) {
      offset = Math.PI / 2;
    } else if (keysPressed[D]) {
      offset = -Math.PI / 2;
    }
    
    return offset;
  };

  // Animation helpers
  const stopAllActions = (player) => {
    const actions = player?.userData?.actions;
    if (!actions) return;
    for (const action of Object.values(actions)) {
      try {
        action.stop();
      } catch {}
    }
  };

  // Animation player (handles models with only a single 'motion' clip)
  const playAnimation = (player, animName) => {
    if (!player?.userData?.mixer || !player?.userData?.actions) return;

    const actions = player.userData.actions;
    const available = Object.keys(actions);

    // If requesting idle but there's no idle clip, stop animations so the model stays still
    if (animName === 'idle' && !actions['idle'] && !actions['Idle']) {
      if (player.userData.currentAction !== 'none') {
        stopAllActions(player);
        player.userData.currentAction = 'none';
        // console.log(' Idle (no idle clip) -> animations stopped');
      }
      return;
    }

    // Map anim names to available clips with sensible fallbacks
    let targetAction = null;
    if (animName === 'idle') {
      targetAction = actions['idle'] || actions['Idle'] || null;
    } else if (animName === 'walk') {
      targetAction = actions['walk'] || actions['Walk'] || actions['motion'] || null;
    } else if (animName === 'run') {
      // Prefer a run clip, else reuse walk/motion with faster timeScale
      targetAction = actions['run'] || actions['Run'] || actions['walk'] || actions['Walk'] || actions['motion'] || null;
    }

    // If nothing matched, try first available
    if (!targetAction && available.length > 0) {
      targetAction = actions[available[0]];
    }

    // Handle switching/fading
    const currentName = player.userData.currentAction;
    const current = actions[currentName];
    if (targetAction) {
      // Adjust speed for run vs walk when using same clip
      if (animName === 'run') {
        targetAction.timeScale = 1.5; // speed up
      } else {
        targetAction.timeScale = 1.0;
      }

      if (current && current !== targetAction) {
        current.fadeOut(fadeDuration);
      }
      if (current !== targetAction || currentName === 'none') {
        targetAction.reset().fadeIn(fadeDuration).play();
      }
      player.userData.currentAction = animName;
      // console.log(' Playing:', animName, 'available:', available);
    }
  };

  // Update loop
  const update = (delta) => {
    if (!isPlaying || !playerRef.current) return;
    
    const player = playerRef.current;
    const anyKeyPressed = DIRECTIONS.some(key => keysRef.current[key]);
    
    // Animation
    let animName = 'idle';
    if (anyKeyPressed) {
      animName = keysRef.current[SHIFT] ? 'run' : 'walk';
    }
    playAnimation(player, animName);
    
    // Update mixer
    if (player.userData?.mixer) {
      player.userData.mixer.update(delta);
    }
    
    // Movement
    if (!anyKeyPressed) return;
    
    const camera = scene.children.find(c => c.isCamera);
    if (!camera) return;
    
    // Calculate movement direction
    const angleYCameraDirection = Math.atan2(
      camera.position.x - player.position.x,
      camera.position.z - player.position.z
    );
    
    const offset = directionOffset(keysRef.current);
    
    // Rotate player
    rotateQuaternion.current.setFromAxisAngle(rotateAngle.current, angleYCameraDirection + offset);
    player.quaternion.rotateTowards(rotateQuaternion.current, 0.2);
    
    // Move player
    camera.getWorldDirection(walkDirection.current);
    walkDirection.current.y = 0;
    walkDirection.current.normalize();
    walkDirection.current.applyAxisAngle(rotateAngle.current, offset);
    
    const velocity = keysRef.current[SHIFT] ? runVelocity : walkVelocity;
    const moveX = walkDirection.current.x * velocity * delta;
    const moveZ = walkDirection.current.z * velocity * delta;
    
    player.position.x += moveX;
    player.position.z += moveZ;
    
    // Move camera
    camera.position.x += moveX;
    camera.position.z += moveZ;
    
    // Avoid per-frame logs to prevent stutter
    // console.log(' Moving:', moveX.toFixed(3), moveZ.toFixed(3));
  };

  // Keyboard handlers
  const onKeyDown = (e) => {
    if (!isPlaying) return;
    const key = e.key?.toLowerCase();
    if (!key) return;
    if (DIRECTIONS.includes(key) || key === SHIFT) {
      keysRef.current[key] = true;
      e.preventDefault();
    }
  };

  const onKeyUp = (e) => {
    if (!isPlaying) return;
    const key = e.key?.toLowerCase();
    if (!key) return;
    if (DIRECTIONS.includes(key) || key === SHIFT) {
      keysRef.current[key] = false;
      e.preventDefault();
    }
  };

  // Lifecycle: set up listeners and RAF loop only in play mode
  useEffect(() => {
    if (!scene) return; // wait until scene exists

    if (isPlaying) {
      // Locate player once when play starts
      const player = findPlayer();
      if (player) {
        playerRef.current = player;
        // Start from idle if animations exist
        playAnimation(player, 'idle');
      }

      // Input listeners
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);

      // Animation/movement loop
      let rafId = 0;
      let last = performance.now();
      const loop = (now) => {
        const dt = Math.max(0, Math.min((now - last) / 1000, 0.05)); // clamp to 50ms
        last = now;
        update(dt);
        if (isPlaying) rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);

      // Cleanup when leaving play mode
      return () => {
        cancelAnimationFrame(rafId);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        keysRef.current = {};
        playerRef.current = null;
      };
    }

    // If not playing: ensure clean state
    keysRef.current = {};
    playerRef.current = null;
  }, [isPlaying, scene]);

  return null;
}
