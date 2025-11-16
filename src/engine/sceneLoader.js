import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class SceneLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();
  }

  async loadScene(sceneData) {
    const scene = new THREE.Scene();
    
    // Set up camera from scene data
    if (sceneData.camera) {
      const { pos, target } = sceneData.camera;
      // Camera setup would be handled by the viewport
    }

    // Load entities
    if (sceneData.entities) {
      for (const entityData of sceneData.entities) {
        const entity = await this.createEntity(entityData);
        if (entity) {
          scene.add(entity);
        }
      }
    }

    return scene;
  }

  async createEntity(entityData) {
    const { type, asset, transform, physics, name } = entityData;

    let entity;

    switch (type) {
      case 'gltf':
        entity = await this.loadGLTF(asset);
        break;
      case 'primitive':
        entity = this.createPrimitive(entityData);
        break;
      default:
        console.warn(`Unknown entity type: ${type}`);
        return null;
    }

    if (entity) {
      entity.name = name || 'Unnamed Entity';
      
      // Apply transform
      if (transform) {
        if (transform.pos) entity.position.set(...transform.pos);
        if (transform.rot) entity.rotation.set(...transform.rot);
        if (transform.scale) entity.scale.set(...transform.scale);
      }

      // Store physics data for later use
      if (physics) {
        entity.userData.physics = physics;
      }
    }

    return entity;
  }

  async loadGLTF(assetPath) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        assetPath,
        (gltf) => {
          // Attach animations to the scene so callers can access them
          try {
            if (gltf.scene) {
              gltf.scene.userData._gltfAnimations = gltf.animations || [];
            }
          } catch (err) { /* ignore */ }
          resolve(gltf.scene);
        },
        undefined,
        reject
      );
    });
  }

  createPrimitive(entityData) {
    const { primitive } = entityData;
    
    let geometry, material;

    switch (primitive.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(
          primitive.width || 1,
          primitive.height || 1,
          primitive.depth || 1
        );
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(primitive.radius || 0.5);
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(
          primitive.width || 1,
          primitive.height || 1
        );
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    material = new THREE.MeshStandardMaterial({
      color: primitive.color || 0x666666
    });

    return new THREE.Mesh(geometry, material);
  }

  exportScene(scene) {
    const sceneData = {
      entities: []
    };

    scene.traverse((object) => {
      if (object.isMesh || (object.isGroup && object.name)) {
        const entityData = {
          id: object.uuid,
          name: object.name,
          type: object.userData.type || 'unknown',
          transform: {
            pos: [object.position.x, object.position.y, object.position.z],
            rot: [object.rotation.x, object.rotation.y, object.rotation.z],
            scale: [object.scale.x, object.scale.y, object.scale.z]
          }
        };

        if (object.userData.physics) {
          entityData.physics = object.userData.physics;
        }

        sceneData.entities.push(entityData);
      }
    });

    return sceneData;
  }
}