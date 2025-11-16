import React, { useEffect, useRef } from 'react';
import { useSceneStore } from '../store/sceneStore';
import * as THREE from 'three';

// Adds Edges wireframe overlays to all Mesh/SkinnedMesh objects so they are easy to see.
// - Auto-applies to newly added objects (periodic sync)
// - Toggle visibility with F2
export default function WireframeDebugger() {
  const { scene } = useSceneStore();
  const overlaysRef = useRef([]);
  const visibleRef = useRef(true);
  const materialRef = useRef(null);
  const timerRef = useRef(null);

  // Helper: ensure an overlay exists on a mesh
  const ensureOverlay = (obj) => {
    if (!obj || (!obj.isMesh && !obj.isSkinnedMesh) || !obj.geometry) return;
    // Skip if already added
    if (obj.children && obj.children.find((c) => c.name === '__wireframeHelper')) {
      return;
    }
    try {
      const edges = new THREE.EdgesGeometry(obj.geometry, 20);
      const mat = (materialRef.current || new THREE.LineBasicMaterial({ color: 0x00ffff, depthTest: true, depthWrite: false, transparent: true, opacity: 0.6 }));
      materialRef.current = mat;
      const lines = new THREE.LineSegments(edges, mat.clone());
      lines.name = '__wireframeHelper';
      lines.renderOrder = 999;
      lines.frustumCulled = false;
      lines.visible = visibleRef.current;
      obj.add(lines);
      overlaysRef.current.push(lines);
    } catch { /* ignore geometry types that fail */ }
  };

  useEffect(() => {
    if (!scene) return;

    // Initial pass
    scene.traverse(ensureOverlay);

    // Periodic sync to catch newly added objects
    timerRef.current = setInterval(() => {
      try {
        scene.traverse(ensureOverlay);
      } catch { /* ignore */ }
    }, 800);

    // Toggle visibility
    const onKey = (e) => {
      if (e.key === 'F2' || e.key === 'f2') {
        visibleRef.current = !visibleRef.current;
        overlaysRef.current.forEach((h) => (h.visible = visibleRef.current));
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      if (timerRef.current) clearInterval(timerRef.current);
      // Remove and dispose overlays
      overlaysRef.current.forEach((h) => {
        if (h.parent) h.parent.remove(h);
        if (h.geometry) h.geometry.dispose();
        if (h.material) h.material.dispose();
      });
      overlaysRef.current = [];
    };
  }, [scene]);

  return null;
}
