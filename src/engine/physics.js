import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class PhysicsEngine {
  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;
    
    // Contact material for platformer-friendly physics
    const contactMaterial = new CANNON.ContactMaterial(
      new CANNON.Material(),
      new CANNON.Material(),
      {
        friction: 0.4,
        restitution: 0.1
      }
    );
    this.world.addContactMaterial(contactMaterial);

    this.bodies = new Map(); // Map Three.js objects to Cannon bodies
    this.meshes = new Map(); // Map Cannon bodies to Three.js objects
  }

  addBody(mesh, options = {}) {
    const {
      bodyType = 'dynamic',
      mass = 1,
      shape = 'box',
      material = new CANNON.Material()
    } = options;

    let cannonShape;
    
    // Create collision shape based on mesh geometry
    if (shape === 'box') {
      const box = new THREE.Box3().setFromObject(mesh);
      const size = box.getSize(new THREE.Vector3());
      cannonShape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
    } else if (shape === 'sphere') {
      const sphere = new THREE.Sphere();
      new THREE.Box3().setFromObject(mesh).getBoundingSphere(sphere);
      cannonShape = new CANNON.Sphere(sphere.radius);
    } else if (shape === 'plane') {
      cannonShape = new CANNON.Plane();
    }

    const body = new CANNON.Body({
      mass: bodyType === 'static' ? 0 : mass,
      material: material,
      shape: cannonShape
    });

    // Set initial position and rotation
    body.position.copy(mesh.position);
    body.quaternion.copy(mesh.quaternion);

    if (bodyType === 'kinematic') {
      body.type = CANNON.Body.KINEMATIC;
    }

    this.world.addBody(body);
    this.bodies.set(mesh, body);
    this.meshes.set(body, mesh);

    return body;
  }

  removeBody(mesh) {
    const body = this.bodies.get(mesh);
    if (body) {
      this.world.removeBody(body);
      this.bodies.delete(mesh);
      this.meshes.delete(body);
    }
  }

  step(deltaTime) {
    this.world.step(deltaTime);
    
    // Update Three.js meshes from Cannon bodies
    for (const [mesh, body] of this.bodies) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
  }

  // Platformer-specific helper methods
  applyJumpForce(mesh, force = 10) {
    const body = this.bodies.get(mesh);
    if (body && this.isGrounded(body)) {
      body.velocity.y = force;
    }
  }

  applyMovementForce(mesh, direction, force = 5) {
    const body = this.bodies.get(mesh);
    if (body) {
      body.velocity.x = direction.x * force;
      body.velocity.z = direction.z * force;
    }
  }

  isGrounded(body, threshold = 0.1) {
    // Check if body is close to ground (simple implementation)
    return Math.abs(body.velocity.y) < threshold && body.position.y <= 1;
  }

  // Ray casting for ground detection
  raycastDown(fromPosition, distance = 2) {
    const from = new CANNON.Vec3(fromPosition.x, fromPosition.y, fromPosition.z);
    const to = new CANNON.Vec3(fromPosition.x, fromPosition.y - distance, fromPosition.z);
    
    const result = new CANNON.RaycastResult();
    this.world.raycastClosest(from, to, {}, result);
    
    return result.hasHit;
  }

  // Clean up
  dispose() {
    // Remove all bodies
    while (this.world.bodies.length > 0) {
      this.world.removeBody(this.world.bodies[0]);
    }
    this.bodies.clear();
    this.meshes.clear();
  }
}