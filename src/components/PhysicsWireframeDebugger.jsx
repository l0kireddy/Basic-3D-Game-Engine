import React, { useEffect, useRef } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { usePlayStore } from '../store/playStore';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * PhysicsWireframeDebugger
 * Visualizes physics collision bodies as wireframes
 * - Shows capsules, boxes, spheres, cylinders, etc.
 * - Toggle with F3 key
 * - Updates in real-time during play mode
 */
export default function PhysicsWireframeDebugger() {
  const { scene, physicsWorld } = useSceneStore();
  const { isPlaying } = usePlayStore();
  const helpersRef = useRef(new Map()); // body -> helper mesh
  const visibleRef = useRef(true);
  const rafRef = useRef(null);

  // Create wireframe mesh for a physics body
  const createHelper = (body) => {
    const shape = body.shapes[0];
    if (!shape) return null;

    let geometry = null;
    const material = new THREE.LineBasicMaterial({ 
      color: 0x00ff00, 
      linewidth: 2,
      transparent: true,
      opacity: 0.6
    });

    // Handle different shape types
    if (shape instanceof CANNON.Box) {
      const size = shape.halfExtents;
      geometry = new THREE.BoxGeometry(size.x * 2, size.y * 2, size.z * 2);
    } 
    else if (shape instanceof CANNON.Sphere) {
      geometry = new THREE.SphereGeometry(shape.radius, 16, 12);
    }
    else if (shape instanceof CANNON.Cylinder) {
      geometry = new THREE.CylinderGeometry(
        shape.radiusTop,
        shape.radiusBottom,
        shape.height,
        shape.numSegments || 8
      );
    }
    else if (shape instanceof CANNON.Plane) {
      geometry = new THREE.PlaneGeometry(100, 100, 10, 10);
    }
    else {
      // For complex shapes, use a simple sphere as placeholder
      geometry = new THREE.SphereGeometry(0.5, 8, 6);
    }

    const edges = new THREE.EdgesGeometry(geometry);
    const helper = new THREE.LineSegments(edges, material);
    helper.name = '__physicsHelper';
    helper.renderOrder = 1000;
    
    geometry.dispose();
    return helper;
  };

  // Update helper positions to match physics bodies
  const updateHelpers = () => {
    if (!scene || !physicsWorld || !isPlaying) return;

    physicsWorld.world.bodies.forEach((body) => {
      let helper = helpersRef.current.get(body);
      
      // Create helper if doesn't exist
      if (!helper) {
        helper = createHelper(body);
        if (helper) {
          scene.add(helper);
          helpersRef.current.set(body, helper);
        }
      }

      // Update position and rotation
      if (helper) {
        helper.position.copy(body.position);
        helper.quaternion.copy(body.quaternion);
        helper.visible = visibleRef.current;
      }
    });

    // Remove helpers for bodies that no longer exist
    const bodiesToRemove = [];
    helpersRef.current.forEach((helper, body) => {
      if (!physicsWorld.world.bodies.includes(body)) {
        scene.remove(helper);
        helper.geometry.dispose();
        helper.material.dispose();
        bodiesToRemove.push(body);
      }
    });
    bodiesToRemove.forEach(body => helpersRef.current.delete(body));
  };

  // Toggle visibility
  const onKeyDown = (e) => {
    if (e.key === 'F3') {
      e.preventDefault();
      visibleRef.current = !visibleRef.current;
      helpersRef.current.forEach(helper => {
        helper.visible = visibleRef.current;
      });
      console.log(`🔧 Physics Wireframes: ${visibleRef.current ? 'ON' : 'OFF'}`);
    }
  };

  useEffect(() => {
    if (!scene || !physicsWorld) return;

    // Default off — show only when explicitly toggled (F3)
    visibleRef.current = false;

    // Key listener
    document.addEventListener('keydown', onKeyDown);

    // Animation loop for real-time updates
    const loop = () => {
      if (isPlaying) {
        updateHelpers();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      
      // Cleanup all helpers
      helpersRef.current.forEach((helper) => {
        if (scene) scene.remove(helper);
        helper.geometry.dispose();
        helper.material.dispose();
      });
      helpersRef.current.clear();
    };
  }, [scene, physicsWorld, isPlaying]);

  return null;
}
