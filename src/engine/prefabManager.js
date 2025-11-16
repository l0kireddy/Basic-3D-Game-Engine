import * as THREE from 'three';

export class PrefabManager {
  constructor() {
    this.prefabs = new Map();
  }

  createPrefab(name, sourceObject) {
    const prefabData = this.serializeObject(sourceObject);
    this.prefabs.set(name, prefabData);
    return prefabData;
  }

  instantiatePrefab(name) {
    const prefabData = this.prefabs.get(name);
    if (!prefabData) {
      console.warn(`Prefab '${name}' not found`);
      return null;
    }

    return this.deserializeObject(prefabData);
  }

  serializeObject(object) {
    const data = {
      name: object.name,
      type: object.type,
      geometry: this.serializeGeometry(object.geometry),
      material: this.serializeMaterial(object.material),
      transform: {
        position: [object.position.x, object.position.y, object.position.z],
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: [object.scale.x, object.scale.y, object.scale.z]
      },
      userData: object.userData,
      children: []
    };

    // Recursively serialize children
    object.children.forEach(child => {
      if (child.isMesh || child.isGroup) {
        data.children.push(this.serializeObject(child));
      }
    });

    return data;
  }

  deserializeObject(data) {
    let object;

    if (data.type === 'Mesh') {
      const geometry = this.deserializeGeometry(data.geometry);
      const material = this.deserializeMaterial(data.material);
      object = new THREE.Mesh(geometry, material);
    } else if (data.type === 'Group') {
      object = new THREE.Group();
    } else {
      console.warn(`Unknown object type: ${data.type}`);
      return null;
    }

    object.name = data.name;
    object.position.set(...data.transform.position);
    object.rotation.set(...data.transform.rotation);
    object.scale.set(...data.transform.scale);
    object.userData = { ...data.userData };

    // Recursively deserialize children
    data.children.forEach(childData => {
      const child = this.deserializeObject(childData);
      if (child) {
        object.add(child);
      }
    });

    return object;
  }

  serializeGeometry(geometry) {
    if (!geometry) return null;

    return {
      type: geometry.type,
      parameters: geometry.parameters || {}
    };
  }

  deserializeGeometry(data) {
    if (!data) return new THREE.BoxGeometry(1, 1, 1);

    switch (data.type) {
      case 'BoxGeometry':
        return new THREE.BoxGeometry(
          data.parameters.width || 1,
          data.parameters.height || 1,
          data.parameters.depth || 1
        );
      case 'SphereGeometry':
        return new THREE.SphereGeometry(
          data.parameters.radius || 0.5,
          data.parameters.widthSegments || 32,
          data.parameters.heightSegments || 16
        );
      case 'PlaneGeometry':
        return new THREE.PlaneGeometry(
          data.parameters.width || 1,
          data.parameters.height || 1
        );
      default:
        console.warn(`Unknown geometry type: ${data.type}`);
        return new THREE.BoxGeometry(1, 1, 1);
    }
  }

  serializeMaterial(material) {
    if (!material) return null;

    return {
      type: material.type,
      color: material.color ? material.color.getHex() : 0xffffff,
      metalness: material.metalness || 0,
      roughness: material.roughness || 0.5,
      transparent: material.transparent || false,
      opacity: material.opacity || 1
    };
  }

  deserializeMaterial(data) {
    if (!data) return new THREE.MeshStandardMaterial();

    const material = new THREE.MeshStandardMaterial({
      color: data.color || 0xffffff,
      metalness: data.metalness || 0,
      roughness: data.roughness || 0.5,
      transparent: data.transparent || false,
      opacity: data.opacity || 1
    });

    return material;
  }

  exportPrefabs() {
    const exported = {};
    for (const [name, data] of this.prefabs) {
      exported[name] = data;
    }
    return exported;
  }

  importPrefabs(data) {
    for (const [name, prefabData] of Object.entries(data)) {
      this.prefabs.set(name, prefabData);
    }
  }

  listPrefabs() {
    return Array.from(this.prefabs.keys());
  }

  deletePrefab(name) {
    return this.prefabs.delete(name);
  }
}