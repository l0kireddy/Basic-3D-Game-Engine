import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

export class PhysicsWorld {
  constructor() {
    // Create physics world
    this.world = new CANNON.World();
    
    // Set gravity (default: Earth gravity)
    this.world.gravity.set(0, -9.82, 0);
    
    // Set broadphase algorithm for collision detection
    this.world.broadphase = new CANNON.NaiveBroadphase();
    
    // Allow bodies to sleep when they're not moving (optimization)
    this.world.allowSleep = true;
    
    // Set solver iterations for stability
    this.world.solver.iterations = 15; // Increased for better stability
    this.world.solver.tolerance = 0.001; // Tighter tolerance for better settling
    
    // Set world damping to reduce sliding
    this.world.defaultContactMaterial.friction = 0.8; // Higher friction
    this.world.defaultContactMaterial.restitution = 0.1; // Less bouncing
    
    // Contact material for default interactions - improved for stability
    this.defaultMaterial = new CANNON.Material('default');
    this.defaultContactMaterial = new CANNON.ContactMaterial(
      this.defaultMaterial,
      this.defaultMaterial,
      {
        friction: 0.8,        // High friction to prevent sliding
        restitution: 0.1,     // Low bounce
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e8,
        frictionEquationRelaxation: 3
      }
    );
    this.world.addContactMaterial(this.defaultContactMaterial);
    
    // Store physics bodies mapped to Three.js objects
    this.bodies = new Map();
    
    // Physics enabled flag
    this.enabled = false;
    
    // Audio collision callbacks
    this.audioCallbacks = new Set();
    
    // Platform event callbacks
    this.platformCallbacks = new Set();
    
    // Setup collision detection for audio triggers
    this.setupCollisionDetection();
  }
  
  // Enable/disable physics simulation
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  
  // Update physics simulation
  step(deltaTime) {
    if (!this.enabled) return;
    
    // Step the physics world
    this.world.step(deltaTime);
    
    // Update Three.js objects from physics bodies
    this.bodies.forEach((body, threeObject) => {
      if (body && threeObject && body.type !== CANNON.Body.STATIC) {
        // Only update dynamic bodies (skip static ones)
        // Only update if the physics body has moved significantly
        const positionDiff = threeObject.position.distanceTo(body.position);
        if (positionDiff > 0.001) {
          console.log(`📍 Updating ${threeObject.name} position from Three.js(${threeObject.position.y.toFixed(2)}) to Physics(${body.position.y.toFixed(2)}) - diff: ${positionDiff.toFixed(3)}`);
          
          // Update position
          threeObject.position.copy(body.position);
          
          // Update rotation
          threeObject.quaternion.copy(body.quaternion);
        }
      }
    });
  }
  
  // Add physics body to an object
  addBody(threeObject, bodyOptions = {}) {
    const {
      type = 'box',
      mass = 1,
      material = this.defaultMaterial,
      size = { x: 1, y: 1, z: 1 },
      radius,
      height,
      mesh,
      isCharacter = false,
      isStatic = false,
      offset, // Offset from object origin to collision center
      frameOffset, // Manual frame position relative to object
      frameRotation, // Manual frame rotation relative to object
      frames // Array of manual collision frames for compound shapes
    } = bodyOptions;
    
    // Create physics shape based on type
    let shape;
    let isPlatform = false;
    let isSolidPlatform = false;
    
    switch (type) {
      case 'box':
        shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        break;
      case 'sphere': {
        // Use radius if provided, otherwise derive from size
        const sphereRadius = radius || size.x / 2;
        shape = new CANNON.Sphere(sphereRadius);
        break;
      }
      case 'plane':
        shape = new CANNON.Plane();
        break;
      case 'cylinder': {
        // Use radius and height if provided, otherwise derive from size
        const cylRadius = radius || size.x / 2;
        const cylHeight = height || size.y;
        shape = new CANNON.Cylinder(cylRadius, cylRadius, cylHeight, 8);
        break;
      }
      case 'capsule': {
        // Create a capsule using a combination of cylinder + spheres
        // Use radius and height if provided, otherwise derive from size
        const capRadius = radius || Math.min(size.x, size.z) / 2;
        const capHeight = height || size.y;
        shape = new CANNON.Cylinder(capRadius, capRadius, capHeight, 8);
        break;
      }
      case 'trimesh': {
        // Build a Trimesh from the Three.js geometry (BufferGeometry)
        // Skip wireframe helpers
        const findMesh = (obj) => {
          if (obj.geometry && !obj.name.includes('wireframe')) return obj.geometry;
          for (const child of obj.children || []) {
            if (child.name === '__wireframeHelper') continue;
            const g = findMesh(child);
            if (g) return g;
          }
          return null;
        };
        const geom = threeObject.geometry || findMesh(threeObject);
        if (geom && geom.isBufferGeometry) {
          const verts = geom.attributes.position.array;
          let indices = null;
          if (geom.index) indices = geom.index.array;
          // Convert to plain arrays and create Trimesh
          const vertices = Array.from(verts);
          const faces = indices ? Array.from(indices) : null;
          try {
            shape = new CANNON.Trimesh(vertices, faces);
          } catch (err) {
            console.warn('Failed to create Trimesh, falling back to box for', threeObject.name, err);
            shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
          }
        } else {
          // fallback
          shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        }
        break;
      }
      case 'convex': {
        // Build a ConvexPolyhedron from the Three.js geometry
        // Skip wireframe helpers
        const findMesh = (obj) => {
          if (obj.geometry && !obj.name.includes('wireframe')) return obj.geometry;
          for (const child of obj.children || []) {
            if (child.name === '__wireframeHelper') continue;
            const g = findMesh(child);
            if (g) return g;
          }
          return null;
        };
        const geom = bodyOptions.collisionMesh?.geometry || threeObject.geometry || findMesh(threeObject);
        try {
          const buffer = geom.index ? geom.toNonIndexed() : geom;
          const pos = buffer.attributes.position.array;
          const points = [];
          for (let i = 0; i < pos.length; i += 3) points.push(new THREE.Vector3(pos[i], pos[i+1], pos[i+2]));

          // Use ConvexGeometry to get faces
          const convexGeo = new ConvexGeometry(points);
          const vertices = Array.from(convexGeo.attributes.position.array);
          const indices = convexGeo.index ? Array.from(convexGeo.index.array) : null;

          // Convert to CANNON.ConvexPolyhedron
          if (indices) {
            const verts = [];
            for (let i = 0; i < vertices.length; i += 3) verts.push(new CANNON.Vec3(vertices[i], vertices[i+1], vertices[i+2]));

            const faces = [];
            for (let i = 0; i < indices.length; i += 3) faces.push([indices[i], indices[i+1], indices[i+2]]);

            shape = new CANNON.ConvexPolyhedron({ vertices: verts, faces: faces });
          }
        } catch (err) {
          console.warn('Failed to create ConvexPolyhedron, falling back to box for', threeObject.name, err);
          shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        }
        break;
      }
      case 'platform':
        // Platform is a box-shaped trigger zone (sensor)
        shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        isPlatform = true;
        break;
      case 'solidPlatform':
        // Solid platform is a stable, collidable platform
        shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
        isSolidPlatform = true;
        break;
      case 'compound': {
        // Create compound shape from multiple collision frames
        console.log(`🔗 Creating compound shape with ${frames?.length || 0} frames`);
        
        if (!frames || frames.length === 0) {
          console.warn('No frames provided for compound shape, falling back to box');
          shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
          break;
        }
        
        // Create the compound shape - we'll add child shapes after body creation
        // Use a box that encompasses all child shapes for the main body
        const totalBounds = frames.reduce((bounds, frame) => {
          const frameSize = frame.size || { x: 1, y: 1, z: 1 };
          const framePos = frame.position || { x: 0, y: 0, z: 0 };
          return {
            minX: Math.min(bounds.minX, framePos.x - frameSize.x/2),
            maxX: Math.max(bounds.maxX, framePos.x + frameSize.x/2),
            minY: Math.min(bounds.minY, framePos.y - frameSize.y/2),
            maxY: Math.max(bounds.maxY, framePos.y + frameSize.y/2),
            minZ: Math.min(bounds.minZ, framePos.z - frameSize.z/2),
            maxZ: Math.max(bounds.maxZ, framePos.z + frameSize.z/2)
          };
        }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity });
        
        const compoundSize = {
          x: totalBounds.maxX - totalBounds.minX,
          y: totalBounds.maxY - totalBounds.minY,
          z: totalBounds.maxZ - totalBounds.minZ
        };
        
        shape = new CANNON.Box(new CANNON.Vec3(
          Math.max(compoundSize.x / 2, 0.1), 
          Math.max(compoundSize.y / 2, 0.1), 
          Math.max(compoundSize.z / 2, 0.1)
        ));
        
        console.log(`📦 Compound shape main body size: ${compoundSize.x.toFixed(2)} x ${compoundSize.y.toFixed(2)} x ${compoundSize.z.toFixed(2)}`);
        
        // We'll add child shapes after body creation
        break;
      }
      default:
        shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    }
    
    // Create physics body
    const body = new CANNON.Body({
      mass: isStatic ? 0 : (isPlatform ? 0 : isSolidPlatform ? 0 : mass), // Static or platforms have mass = 0
      material: material,
      shape: shape,
      type: isStatic ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC,
      isTrigger: isPlatform // Only trigger platforms are sensors
    });
    
    // Debug logging for static objects
    console.log(`🔧 Created physics body for ${threeObject.name}:`);
    console.log(`   - isStatic: ${isStatic}`);
    console.log(`   - mass: ${body.mass}`);
    console.log(`   - type: ${body.type} (STATIC=${CANNON.Body.STATIC}, DYNAMIC=${CANNON.Body.DYNAMIC})`);
    console.log(`   - Will be affected by gravity: ${body.type === CANNON.Body.DYNAMIC}`);
    
    // Set initial position and rotation from Three.js object
    console.log(`🔍 Setting physics body position for ${threeObject.name}:`);
    console.log(`   - Three.js position: ${threeObject.position.x.toFixed(2)}, ${threeObject.position.y.toFixed(2)}, ${threeObject.position.z.toFixed(2)}`);
    console.log(`   - Body type: ${type}, Size: ${JSON.stringify(size)}`);
    
    body.position.copy(threeObject.position);
    
    // Special handling for ground/plane objects - ensure they're horizontal
    const isGroundObject = threeObject.name === 'Ground' || 
                          threeObject.name === 'GroundPlane' || 
                          threeObject.name.toLowerCase().includes('ground') ||
                          threeObject.name.toLowerCase().includes('plane');
    
    if (isGroundObject && isStatic) {
      // Force ground planes to be perfectly horizontal (no rotation)
      body.quaternion.set(0, 0, 0, 1); // Identity quaternion = no rotation
      console.log(`🏔️ Ground object detected - forcing horizontal orientation for ${threeObject.name}`);
    } else {
      // Normal objects use their Three.js rotation
      body.quaternion.copy(threeObject.quaternion);
    }
    
    // Apply offset for initial positioning (especially for character capsules)
    // The offset positions the physics body center relative to the object origin
    // For characters: offset.y = capsuleHeight/2 (puts capsule center above feet)
    if (offset) {
      body.position.x += offset.x;
      body.position.y += offset.y;
      body.position.z += offset.z;
      
      body.userData = body.userData || {};
      body.userData.offset = offset;
      console.log(`   - Applied auto-detection offset: (${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)})`);
    }
    
    // Apply manual frame offset if provided
    if (frameOffset) {
      body.position.x += frameOffset.x;
      body.position.y += frameOffset.y;
      body.position.z += frameOffset.z;
      console.log(`   - Applied manual frame offset: (${frameOffset.x.toFixed(2)}, ${frameOffset.y.toFixed(2)}, ${frameOffset.z.toFixed(2)})`);
    }
    
    // Apply manual frame rotation if provided
    if (frameRotation && !isGroundObject) {
      const frameQuat = new CANNON.Quaternion();
      frameQuat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), frameRotation.x * Math.PI / 180);
      const yQuat = new CANNON.Quaternion();
      yQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), frameRotation.y * Math.PI / 180);
      const zQuat = new CANNON.Quaternion();
      zQuat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), frameRotation.z * Math.PI / 180);
      
      body.quaternion = body.quaternion.mult(frameQuat).mult(yQuat).mult(zQuat);
      console.log(`   - Applied manual frame rotation: (${frameRotation.x}°, ${frameRotation.y}°, ${frameRotation.z}°)`);
    }
    
    console.log(`   - Body position after all offsets: (${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)}, ${body.position.z.toFixed(2)})`);
    
    console.log(`   - Final physics body position: ${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)}, ${body.position.z.toFixed(2)}`);
    console.log(`   - Body will ${body.type === CANNON.Body.STATIC ? 'NOT' : 'YES'} be affected by gravity`);
    
    // Add damping to regular dynamic bodies to prevent sliding
    if (!isPlatform && !isSolidPlatform && mass > 0 && !isStatic) {
      body.linearDamping = 0.05;  // Linear damping to slow down movement
      body.angularDamping = 0.05; // Angular damping to slow down rotation
      body.sleepSpeedLimit = 0.5; // Sleep when velocity is below this threshold
      body.sleepTimeLimit = 0.5;  // Time to wait before sleeping
      
      console.log(`🎯 Added damping to dynamic body for ${threeObject.name}`);
    }
    
    // Make platform bodies act as sensors (no collision response)
    if (isPlatform) {
      body.type = CANNON.Body.KINEMATIC; // Kinematic bodies don't respond to forces
      body.collisionResponse = false; // Disable collision response - objects pass through
      body.material.friction = 0;
      body.material.restitution = 0;
      
      // Store platform metadata
      body.userData = { 
        isPlatform: true, 
        threeObject: threeObject,
        platformType: 'trigger'
      };
      
      console.log(`🟫 Created platform body for ${threeObject.name} (trigger zone)`);
    }

    // Respect explicit trigger option in bodyOptions
    if (bodyOptions.isTrigger) {
      body.type = CANNON.Body.KINEMATIC;
      body.collisionResponse = false;
      body.userData = { ...body.userData, isTrigger: true };
      console.log(`🟡 Created trigger body for ${threeObject.name}`);
    }
    
    // Configure solid platforms for stable platformer physics
    if (isSolidPlatform) {
      body.type = CANNON.Body.STATIC; // Static bodies never move
      body.material.friction = 0.8; // Good grip for landing
      body.material.restitution = 0; // No bouncing
      
      // Store solid platform metadata
      body.userData = { 
        isSolidPlatform: true, 
        threeObject: threeObject,
        platformType: 'solid'
      };
      
      console.log(`🟩 Created solid platform body for ${threeObject.name} (collidable surface)`);
    }
    
    // Add body to world
    this.world.addBody(body);
    
    // Add child shapes for compound bodies
    if (type === 'compound' && frames && frames.length > 0) {
      console.log(`🔗 Adding ${frames.length} child shapes to compound body`);
      
      frames.forEach((frame, index) => {
        let childShape;
        
        // Determine world scale for the threeObject so stored local frame sizes/positions are scaled into world units
        const worldScale = threeObject.getWorldScale ? threeObject.getWorldScale(new THREE.Vector3()) : new THREE.Vector3(1,1,1);

        // Create child shape based on frame type (scale sizes into world space)
        switch (frame.type) {
          case 'box':
            childShape = new CANNON.Box(new CANNON.Vec3(
              ((frame.size?.x || 1) * worldScale.x) / 2,
              ((frame.size?.y || 1) * worldScale.y) / 2,
              ((frame.size?.z || 1) * worldScale.z) / 2
            ));
            break;
          case 'sphere':
            childShape = new CANNON.Sphere((frame.radius || 0.5) * Math.max(worldScale.x, worldScale.y, worldScale.z));
            break;
          case 'capsule':
            // Approximate capsule with cylinder/sphere scaled by worldScale
            childShape = new CANNON.Sphere((frame.radius || 0.5) * Math.max(worldScale.x, worldScale.z));
            break;
          default:
            childShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
        }

        // Child position relative to parent body (scale offset into world units)
        const childPos = new CANNON.Vec3(
          (frame.position?.x || 0) * worldScale.x,
          (frame.position?.y || 0) * worldScale.y,
          (frame.position?.z || 0) * worldScale.z
        );
        
        // Child rotation
        const childQuat = new CANNON.Quaternion();
        if (frame.rotation) {
          childQuat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), (frame.rotation.x || 0) * Math.PI / 180);
          const yQuat = new CANNON.Quaternion();
          yQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), (frame.rotation.y || 0) * Math.PI / 180);
          const zQuat = new CANNON.Quaternion();
          zQuat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), (frame.rotation.z || 0) * Math.PI / 180);
          childQuat.mult(yQuat).mult(zQuat);
        }
        
        // Add child shape to body
        body.addShape(childShape, childPos, childQuat);
        console.log(`   ✅ Added ${frame.type} child shape ${index + 1} at (${childPos.x.toFixed(2)}, ${childPos.y.toFixed(2)}, ${childPos.z.toFixed(2)})`);
      });
    }
    
    // Store mapping
    this.bodies.set(threeObject, body);
    
    // CRITICAL: Also attach the physics body to the Three.js object's userData
    // This is needed for the character controller to find it
    threeObject.userData.physicsBody = body;
    console.log(`🔗 Attached physics body to ${threeObject.name}.userData.physicsBody`);

    // If a collisionMesh source was provided in options, mark the threeObject userData so UI can hide/show it
    // Note: bodyOptions.collisionMesh is optional and passed from the store when creating bodies
    try {
      if (bodyOptions && bodyOptions.collisionMesh) {
        const source = bodyOptions.collisionMesh;
        if (source.userData) source.userData._usedAsCollision = true;
      }
    } catch (err) {
      // ignore
    }
    
    return body;
  }
  
  // Remove physics body from an object
  removeBody(threeObject) {
    const body = this.bodies.get(threeObject);
    if (body) {
      this.world.removeBody(body);
      this.bodies.delete(threeObject);
      // Clean up userData reference
      if (threeObject.userData) {
        delete threeObject.userData.physicsBody;
      }
      console.log(`🗑️ Removed physics body from ${threeObject.name}`);
    }
  }
  
  // Get physics body for an object
  getBody(threeObject) {
    return this.bodies.get(threeObject);
  }
  
  // Set gravity
  setGravity(x, y, z) {
    this.world.gravity.set(x, y, z);
  }
  
  // Add ground plane
  addGroundPlane(y = 0) {
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0, // Static body
      material: this.defaultMaterial
    });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.set(0, y, 0);
    
    this.world.addBody(groundBody);
    return groundBody;
  }
  
  // Apply force to a body
  applyForce(threeObject, force, worldPoint) {
    const body = this.bodies.get(threeObject);
    if (body) {
      const cannonForce = new CANNON.Vec3(force.x, force.y, force.z);
      const cannonPoint = worldPoint ? new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z) : body.position;
      body.applyForce(cannonForce, cannonPoint);
    }
  }
  
  // Apply impulse to a body
  applyImpulse(threeObject, impulse, worldPoint) {
    const body = this.bodies.get(threeObject);
    if (body) {
      const cannonImpulse = new CANNON.Vec3(impulse.x, impulse.y, impulse.z);
      const cannonPoint = worldPoint ? new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z) : body.position;
      body.applyImpulse(cannonImpulse, cannonPoint);
    }
  }
  
  // Set body velocity
  setVelocity(threeObject, velocity) {
    const body = this.bodies.get(threeObject);
    if (body) {
      body.velocity.set(velocity.x, velocity.y, velocity.z);
    }
  }
  
  // Get body velocity
  getVelocity(threeObject) {
    const body = this.bodies.get(threeObject);
    if (body) {
      return {
        x: body.velocity.x,
        y: body.velocity.y,
        z: body.velocity.z
      };
    }
    return { x: 0, y: 0, z: 0 };
  }
  
  // Clear all physics bodies
  clear() {
    this.bodies.forEach((body) => {
      this.world.removeBody(body);
    });
    this.bodies.clear();
  }

  // Reset physics body to match Three.js object position
  resetBodyPosition(threeObject) {
    const body = this.bodies.get(threeObject);
    if (body) {
      body.position.copy(threeObject.position);
      body.quaternion.copy(threeObject.quaternion);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
    }
  }

  // Reset all physics bodies to their Three.js object positions
  resetAllBodies() {
    this.bodies.forEach((body, threeObject) => {
      if (body && threeObject) {
        body.position.copy(threeObject.position);
        body.quaternion.copy(threeObject.quaternion);
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
      }
    });
  }

  // Setup collision detection for audio triggers and platform events
  setupCollisionDetection() {
    // Handle collision start
    this.world.addEventListener('beginContact', (event) => {
      const { bodyA, bodyB } = event;
      
      // Find Three.js objects for the colliding bodies
      let objectA = null;
      let objectB = null;
      
      this.bodies.forEach((body, threeObject) => {
        if (body === bodyA) objectA = threeObject;
        if (body === bodyB) objectB = threeObject;
      });
      
      if (objectA && objectB) {
        // Check platform types
        const platformBodyA = bodyA.userData?.isPlatform;
        const platformBodyB = bodyB.userData?.isPlatform;
        const solidPlatformBodyA = bodyA.userData?.isSolidPlatform;
        const solidPlatformBodyB = bodyB.userData?.isSolidPlatform;
        
        if (platformBodyA || platformBodyB) {
          // Trigger platform collision - treat as trigger event
          const platform = platformBodyA ? objectA : objectB;
          const otherObject = platformBodyA ? objectB : objectA;
          
          console.log(`🟫 Object ${otherObject.name} entered trigger platform ${platform.name}`);
          this.triggerPlatformEvent('enter', platform, otherObject);
        } else if (solidPlatformBodyA || solidPlatformBodyB) {
          // Solid platform collision - regular collision + platform event
          const platform = solidPlatformBodyA ? objectA : objectB;
          const otherObject = solidPlatformBodyA ? objectB : objectA;
          
          console.log(`🟩 Object ${otherObject.name} landed on solid platform ${platform.name}`);
          this.triggerPlatformEvent('land', platform, otherObject);
          
          // Also trigger regular collision audio
          this.triggerCollisionAudio(objectA, objectB);
        } else {
          // Regular collision - trigger audio
          this.triggerCollisionAudio(objectA, objectB);
        }
      }
    });

    // Handle collision end (for platforms)
    this.world.addEventListener('endContact', (event) => {
      const { bodyA, bodyB } = event;
      
      // Find Three.js objects for the colliding bodies
      let objectA = null;
      let objectB = null;
      
      this.bodies.forEach((body, threeObject) => {
        if (body === bodyA) objectA = threeObject;
        if (body === bodyB) objectB = threeObject;
      });
      
      if (objectA && objectB) {
        // Check platform types for exit events (only trigger platforms)
        const platformBodyA = bodyA.userData?.isPlatform;
        const platformBodyB = bodyB.userData?.isPlatform;
        
        if (platformBodyA || platformBodyB) {
          // Trigger platform collision end
          const platform = platformBodyA ? objectA : objectB;
          const otherObject = platformBodyA ? objectB : objectA;
          
          console.log(`🟫 Object ${otherObject.name} exited trigger platform ${platform.name}`);
          this.triggerPlatformEvent('exit', platform, otherObject);
        }
        
        // Note: Solid platforms don't need exit events since objects don't pass through them
      }
    });
  }

  // Trigger collision audio for objects
  triggerCollisionAudio(objectA, objectB) {
    // Notify all registered audio callbacks
    this.audioCallbacks.forEach(callback => {
      try {
        callback(objectA, objectB);
      } catch (error) {
        console.error('Error in audio collision callback:', error);
      }
    });
  }

  // Trigger platform events (enter/exit)
  triggerPlatformEvent(eventType, platform, object) {
    // Notify platform callbacks
    this.platformCallbacks?.forEach(callback => {
      try {
        callback(eventType, platform, object);
      } catch (error) {
        console.error('Error in platform callback:', error);
      }
    });
  }

  // Register audio collision callback
  addAudioCallback(callback) {
    this.audioCallbacks.add(callback);
  }

  // Remove audio collision callback
  removeAudioCallback(callback) {
    this.audioCallbacks.delete(callback);
  }

  // Register platform event callback
  addPlatformCallback(callback) {
    this.platformCallbacks.add(callback);
  }

  // Remove platform event callback
  removePlatformCallback(callback) {
    this.platformCallbacks.delete(callback);
  }
}