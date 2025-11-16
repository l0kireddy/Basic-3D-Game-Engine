import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../store/sceneStore';

const CollisionFrameVisualizer = ({ scene, enabled }) => {
  const visualizersRef = useRef(new Map());
  const { getObjectData, objects } = useSceneStore();
  const updateTriggerRef = useRef(0);

  useEffect(() => {
    if (!scene || !enabled) {
      // Remove all visualizers
      visualizersRef.current.forEach((visualizerData) => {
        const { group, parent } = visualizerData;
        if (parent) {
          parent.remove(group);
        }
        group.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      });
      visualizersRef.current.clear();
      return;
    }

    // Increment update trigger
    updateTriggerRef.current++;

    // Update visualizers for all objects with collision frames
    scene.traverse((sceneObject) => {
      if (sceneObject.uuid) {
        const objData = getObjectData(sceneObject.uuid);
        if (objData && objData.collisionFrames && objData.collisionFrames.length > 0) {
          console.log(`🔍 Found object with collision frames: ${sceneObject.name} (${objData.collisionFrames.length} frames)`, objData.collisionFrames);
          // Skip ground plane - it should use static physics, not manual frames
          if (sceneObject.name === 'Ground' || sceneObject.name === 'GroundPlane') {
            console.warn(`⚠️ Skipping collision frame visualizer for ground plane: ${sceneObject.name}`);
            return;
          }
          updateVisualizer(sceneObject.uuid, objData.collisionFrames, sceneObject);
        } else {
          removeVisualizer(sceneObject.uuid);
        }
      }
    });

  }, [scene, enabled, objects]); // Update when objects array changes

  const updateVisualizer = (objectId, frames, sceneObject) => {
    // Remove old visualizer
    removeVisualizer(objectId);

    // Create new visualizer group
    const visualizerGroup = new THREE.Group();
    visualizerGroup.name = `CollisionFrameVisualizer_${objectId}`;

    console.log(`🔷 Creating collision frame visualizer for ${sceneObject.name}:`, frames);

    frames.forEach((frame, index) => {
      const frameMesh = createFrameMesh(frame);
      frameMesh.name = `Frame_${index}`;
      visualizerGroup.add(frameMesh);
    });

    // Position visualizer at local origin (since it's a child of the object)
    visualizerGroup.position.set(0, 0, 0);
    visualizerGroup.rotation.set(0, 0, 0);
    visualizerGroup.scale.set(1, 1, 1);
    
    // Ensure visualizer renders on top
    visualizerGroup.renderOrder = 999;

    // Add as child of the object so it follows the object's transform
    sceneObject.add(visualizerGroup);
    visualizersRef.current.set(objectId, { group: visualizerGroup, parent: sceneObject });
    
    console.log(`✅ Added collision frame visualizer with ${frames.length} frames as child of ${sceneObject.name}`, visualizerGroup);
  };

  const createFrameMesh = (frame) => {
    let geometry;
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false
    });

    switch (frame.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(
          frame.size.x,
          frame.size.y,
          frame.size.z
        );
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(frame.radius, 16, 16);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          frame.radius,
          frame.radius,
          frame.height,
          16
        );
        break;
      case 'capsule':
        // Create capsule as cylinder + spheres
        const capsuleGroup = new THREE.Group();
        
        const cylinder = new THREE.Mesh(
          new THREE.CylinderGeometry(frame.radius, frame.radius, frame.size?.y || 1, 16),
          material
        );
        capsuleGroup.add(cylinder);
        
        const topSphere = new THREE.Mesh(
          new THREE.SphereGeometry(frame.radius, 16, 16),
          material
        );
        topSphere.position.y = (frame.size?.y || 1) / 2;
        capsuleGroup.add(topSphere);
        
        const bottomSphere = new THREE.Mesh(
          new THREE.SphereGeometry(frame.radius, 16, 16),
          material
        );
        bottomSphere.position.y = -(frame.size?.y || 1) / 2;
        capsuleGroup.add(bottomSphere);
        
        capsuleGroup.position.set(frame.position.x, frame.position.y, frame.position.z);
        capsuleGroup.rotation.set(
          THREE.MathUtils.degToRad(frame.rotation.x),
          THREE.MathUtils.degToRad(frame.rotation.y),
          THREE.MathUtils.degToRad(frame.rotation.z)
        );
        
        return capsuleGroup;
      default:
        geometry = new THREE.BoxGeometry(
          frame.size.x,
          frame.size.y,
          frame.size.z
        );
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(frame.position.x, frame.position.y, frame.position.z);
    mesh.rotation.set(
      THREE.MathUtils.degToRad(frame.rotation.x),
      THREE.MathUtils.degToRad(frame.rotation.y),
      THREE.MathUtils.degToRad(frame.rotation.z)
    );
    
    // Render on top of everything
    mesh.renderOrder = 999;

    // Add a small sphere at the center point for positioning reference
    const centerPoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        depthTest: false,
        depthWrite: false
      })
    );
    centerPoint.position.set(0, 0, 0); // Relative to parent mesh
    centerPoint.renderOrder = 1000;
    mesh.add(centerPoint);

    return mesh;
  };

  const removeVisualizer = (objectId) => {
    const visualizerData = visualizersRef.current.get(objectId);
    if (visualizerData) {
      const { group, parent } = visualizerData;
      // Remove from parent object
      if (parent) {
        parent.remove(group);
      }
      // Clean up resources
      group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      visualizersRef.current.delete(objectId);
    }
  };

  // This component doesn't render anything to React DOM
  return null;
};

export default CollisionFrameVisualizer;
