import * as THREE from 'three';

// Small factory that returns a THREE.Object3D for a named built-in prefab
export function createPrefabObject(prefab) {
  let obj = null;
  switch (prefab) {
    case 'cube': {
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mat = new THREE.MeshStandardMaterial({ color: 0x66ccff, metalness: 0, roughness: 0.5 });
      obj = new THREE.Mesh(geo, mat);
      obj.name = `Cube_${Date.now()}`;
      break;
    }
    case 'sphere': {
      const geo = new THREE.SphereGeometry(0.5, 32, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xffcc66, metalness: 0, roughness: 0.5 });
      obj = new THREE.Mesh(geo, mat);
      obj.name = `Sphere_${Date.now()}`;
      break;
    }
    case 'cylinder': {
      const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
      const mat = new THREE.MeshStandardMaterial({ color: 0xd19c97, metalness: 0, roughness: 0.5 });
      obj = new THREE.Mesh(geo, mat);
      obj.name = `Cylinder_${Date.now()}`;
      break;
    }
    case 'plane': {
      const geo = new THREE.PlaneGeometry(4, 4);
      const mat = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });
      obj = new THREE.Mesh(geo, mat);
      obj.rotation.x = -Math.PI / 2;
      obj.name = `Plane_${Date.now()}`;
      break;
    }
    case 'platform': {
      const geo = new THREE.BoxGeometry(2, 0.2, 2);
      const mat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0, roughness: 0.6 });
      obj = new THREE.Mesh(geo, mat);
      obj.name = `Platform_${Date.now()}`;
      break;
    }
    case 'solidPlatform': {
      const geo = new THREE.BoxGeometry(3, 0.4, 3);
      const mat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0, roughness: 0.6 });
      obj = new THREE.Mesh(geo, mat);
      obj.name = `SolidPlatform_${Date.now()}`;
      break;
    }
    case 'directionalLight': {
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 10, 5);
      light.name = `DirLight_${Date.now()}`;
      obj = light;
      break;
    }
    
    case 'empty': {
      obj = new THREE.Group();
      obj.name = `Group_${Date.now()}`;
      break;
    }
    case 'droide': {
      const g = new THREE.Group();
      g.name = `Droide_${Date.now()}`;
      // Store prefab GLTF URL so SceneViewport can load it on instantiate
      g.userData._prefabGLTF = new URL('../assets/droide.glb', import.meta.url).href;
      obj = g;
      break;
    }
    case 'armour': {
      const g = new THREE.Group();
      g.name = `Armour_${Date.now()}`;
      g.userData._prefabGLTF = new URL('../assets/armour.glb', import.meta.url).href;
      obj = g;
      break;
    }
    default:
      return null;
  }

  // Setup shadow defaults (guard if no object created)
  if (obj && obj.isMesh) {
    obj.castShadow = true;
    obj.receiveShadow = true;
  }

  return obj;
}
