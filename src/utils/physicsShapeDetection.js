import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Auto-detect the best physics collision shape from a Three.js mesh
 * Returns { type, size, vertices, indices } for physics body creation
 */
export function autoDetectCollisionShape(object) {
  // Get all meshes in the object
  const meshes = [];
  object.traverse((child) => {
    if (child.isMesh && child.geometry && !child.name.includes('wireframe')) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) {
    console.log(`⚠️ No meshes found in object ${object.name}, using default box`);
    return { type: 'box', size: { x: 0.5, y: 0.5, z: 0.5 } };
  }

  // Get bounding box of the entire object
  const bbox = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  console.log(`🔍 Auto-detecting collision for "${object.name}": size=(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}), meshes=${meshes.length}`);

  // Analyze geometry to determine best shape
  const mainMesh = meshes[0];
  const geometry = mainMesh.geometry;

  // Check if it's a simple primitive shape
  const shapeType = detectPrimitiveShape(geometry, size);
  
  if (shapeType) {
    console.log(`✅ Detected primitive: ${shapeType.type}`, shapeType);
    return {
      type: shapeType.type,
      size: shapeType.size,
      radius: shapeType.radius,
      height: shapeType.height
    };
  }

  // For complex shapes, decide between convex and trimesh
  const vertexCount = geometry.attributes.position?.count || 0;
  
  // Use convex hull for moderate complexity (better performance)
  if (vertexCount < 500) {
    console.log(`✅ Using convex hull (${vertexCount} vertices)`);
    return {
      type: 'convex',
      mesh: mainMesh,
      size: { x: size.x / 2, y: size.y / 2, z: size.z / 2 }
    };
  }

  // Use trimesh for very complex shapes
  console.log(`✅ Using trimesh (${vertexCount} vertices)`);
  return {
    type: 'trimesh',
    mesh: mainMesh,
    size: { x: size.x / 2, y: size.y / 2, z: size.z / 2 }
  };
}

/**
 * Detect if geometry matches a primitive shape (box, sphere, cylinder)
 */
function detectPrimitiveShape(geometry, worldSize) {
  if (!geometry.attributes.position) return null;

  const positions = geometry.attributes.position.array;
  const vertexCount = positions.length / 3;

  // Too many vertices = not a primitive
  if (vertexCount > 200) return null;

  // Get all vertices
  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    vertices.push(new THREE.Vector3(
      positions[i * 3],
      positions[i * 3 + 1],
      positions[i * 3 + 2]
    ));
  }

  // Get local bounding box from vertices
  const localBBox = new THREE.Box3().setFromPoints(vertices);
  const localSize = new THREE.Vector3();
  localBBox.getSize(localSize);

  // Check for box (8 vertices at corners)
  if (isBox(vertices, localSize)) {
    return {
      type: 'box',
      size: { x: worldSize.x / 2, y: worldSize.y / 2, z: worldSize.z / 2 } // Half-extents from world size
    };
  }

  // Check for sphere (vertices at equal distance from center)
  const sphereTest = isSphere(vertices);
  if (sphereTest.isSphere) {
    // Scale radius to world size
    const scale = worldSize.length() / localSize.length();
    return {
      type: 'sphere',
      radius: sphereTest.radius * scale
    };
  }

  // Check for cylinder (circular cross-section)
  const cylinderTest = isCylinder(vertices, localSize);
  if (cylinderTest.isCylinder) {
    // Scale radius to world size
    const scaleXZ = Math.max(worldSize.x / localSize.x, worldSize.z / localSize.z);
    return {
      type: 'cylinder',
      radius: cylinderTest.radius * scaleXZ,
      height: worldSize.y
    };
  }

  return null;
}

/**
 * Check if vertices form a box shape
 */
function isBox(vertices, size) {
  // Box should have 8 corner vertices (or multiples for subdivided box)
  const corners = [
    new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2),
    new THREE.Vector3(size.x / 2, size.y / 2, -size.z / 2),
    new THREE.Vector3(size.x / 2, -size.y / 2, size.z / 2),
    new THREE.Vector3(size.x / 2, -size.y / 2, -size.z / 2),
    new THREE.Vector3(-size.x / 2, size.y / 2, size.z / 2),
    new THREE.Vector3(-size.x / 2, size.y / 2, -size.z / 2),
    new THREE.Vector3(-size.x / 2, -size.y / 2, size.z / 2),
    new THREE.Vector3(-size.x / 2, -size.y / 2, -size.z / 2),
  ];

  // Check if vertices align with box bounds
  const threshold = 0.01;
  let alignedCount = 0;

  for (const vertex of vertices) {
    const isOnFace = 
      Math.abs(Math.abs(vertex.x) - size.x / 2) < threshold ||
      Math.abs(Math.abs(vertex.y) - size.y / 2) < threshold ||
      Math.abs(Math.abs(vertex.z) - size.z / 2) < threshold;
    
    if (isOnFace) alignedCount++;
  }

  // If most vertices are on box faces, it's a box
  return alignedCount / vertices.length > 0.8;
}

/**
 * Check if vertices form a sphere
 */
function isSphere(vertices) {
  if (vertices.length < 10) return { isSphere: false };

  // Calculate center
  const center = new THREE.Vector3();
  vertices.forEach(v => center.add(v));
  center.divideScalar(vertices.length);

  // Calculate average radius
  let avgRadius = 0;
  vertices.forEach(v => {
    avgRadius += v.distanceTo(center);
  });
  avgRadius /= vertices.length;

  // Check variance in distances
  let variance = 0;
  vertices.forEach(v => {
    const dist = v.distanceTo(center);
    variance += Math.pow(dist - avgRadius, 2);
  });
  variance /= vertices.length;

  // If variance is low, it's a sphere
  const threshold = avgRadius * 0.1; // 10% tolerance
  const isSphere = variance < threshold * threshold;

  return { isSphere, radius: avgRadius };
}

/**
 * Check if vertices form a cylinder
 */
function isCylinder(vertices, size) {
  if (vertices.length < 12) return { isCylinder: false };

  // Group vertices by Y coordinate (top and bottom)
  const topVerts = [];
  const bottomVerts = [];
  const midY = 0;

  vertices.forEach(v => {
    if (v.y > midY + size.y * 0.3) topVerts.push(v);
    else if (v.y < midY - size.y * 0.3) bottomVerts.push(v);
  });

  if (topVerts.length < 3 || bottomVerts.length < 3) {
    return { isCylinder: false };
  }

  // Check if top/bottom vertices form circles
  const topRadius = getCircleRadius(topVerts);
  const bottomRadius = getCircleRadius(bottomVerts);

  if (!topRadius || !bottomRadius) {
    return { isCylinder: false };
  }

  // Radii should be similar
  const radiusDiff = Math.abs(topRadius - bottomRadius);
  const avgRadius = (topRadius + bottomRadius) / 2;

  if (radiusDiff < avgRadius * 0.2) {
    return { isCylinder: true, radius: avgRadius };
  }

  return { isCylinder: false };
}

/**
 * Calculate radius if vertices form a circle in XZ plane
 */
function getCircleRadius(vertices) {
  if (vertices.length < 3) return null;

  // Project to XZ plane and find center
  const center = new THREE.Vector2();
  vertices.forEach(v => {
    center.x += v.x;
    center.z += v.z;
  });
  center.x /= vertices.length;
  center.y /= vertices.length;

  // Calculate average radius
  let avgRadius = 0;
  vertices.forEach(v => {
    const dx = v.x - center.x;
    const dz = v.z - center.y;
    avgRadius += Math.sqrt(dx * dx + dz * dz);
  });
  avgRadius /= vertices.length;

  // Check variance
  let variance = 0;
  vertices.forEach(v => {
    const dx = v.x - center.x;
    const dz = v.z - center.y;
    const dist = Math.sqrt(dx * dx + dz * dz);
    variance += Math.pow(dist - avgRadius, 2);
  });
  variance /= vertices.length;

  // If variance is low, vertices form a circle
  const threshold = avgRadius * 0.15;
  if (variance < threshold * threshold) {
    return avgRadius;
  }

  return null;
}

/**
 * Character-specific collision detection
 * Returns a simplified capsule/cylinder for characters
 */
export function autoDetectCharacterCollision(object) {
  const bbox = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bbox.getSize(size);
  bbox.getCenter(center);

  // Characters work best with capsules
  const radius = Math.min(size.x, size.z) * 0.45; // Wider for better collision
  const height = size.y * 0.90; // Almost full height
  
  // For character capsules, we want the capsule to go from feet to head
  // The physics body should be positioned at capsule center (height/2 above feet)
  // So offset.y should be height/2, not the bounding box center offset
  const offset = new THREE.Vector3(
    center.x - object.position.x, // X offset (usually 0 for centered characters)
    height / 2, // Y offset: half the capsule height (feet to center)
    center.z - object.position.z  // Z offset (usually 0 for centered characters)
  );

  console.log(`🎮 Character collision: radius=${radius.toFixed(2)}, height=${height.toFixed(2)}, offset=(${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)})`);
  console.log(`   - Bounding box center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
  console.log(`   - Object position: (${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)})`);

  return {
    type: 'capsule',
    radius: radius,
    height: height,
    size: { x: radius, y: height, z: radius },
    offset: offset // Store the offset for proper positioning (feet to capsule center)
  };
}
