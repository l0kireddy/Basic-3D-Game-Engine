import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as CANNON from 'cannon-es';

// =====================================================
// GAME CONFIGURATION
// =====================================================
const CONFIG = {
  physics: {
    gravity: -20,
    timeStep: 1/60
  },
  character: {
    moveSpeed: 5,
    runSpeed: 10,
    jumpForce: 8,
    capsuleRadius: 0.5,
    capsuleHeight: 1.8
  },
  camera: {
    fov: 75,
    distance: 3,
    height: 1.5,
    sensitivity: 0.002,
    pitchLimit: Math.PI / 3
  }
};

// =====================================================
// GAME STATE
// =====================================================
const gameState = {
  isRunning: false,
  clock: new THREE.Clock(),
  keys: {},
  camera: {
    yaw: 0,
    pitch: 0
  },
  player: {
    object: null,
    body: null,
    mixer: null,
    actions: {},
    currentAction: 'idle',
    isGrounded: false
  }
};

// =====================================================
// SCENE SETUP
// =====================================================
let scene, camera, renderer, physicsWorld, composer;
let sceneData = null;

function initScene() {
  // Create scene
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x87ceeb, 50, 200);
  
  // Create camera
  camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 2, 5);
  
  // Create renderer
  const canvas = document.getElementById('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  // Setup post-processing (will be configured from scene.json)
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  
  // Add early morning skybox
  createSkybox();
  
  // Add early morning lighting
  createLighting();
  
  // Initialize physics
  initPhysics();
  
  // Add ground plane
  createGround();
  
  console.log('✅ Scene initialized');
}

function createSkybox() {
  // Create realistic sky using Three.js Sky addon
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);
  
  const skyUniforms = sky.material.uniforms;
  
  // Early morning sky settings
  skyUniforms['turbidity'].value = 2;        // Clarity (lower = clearer)
  skyUniforms['rayleigh'].value = 1;         // Atmospheric scattering
  skyUniforms['mieCoefficient'].value = 0.005; // Haze
  skyUniforms['mieDirectionalG'].value = 0.8;  // Sun glow
  
  // Sun position for early morning (low angle, east)
  const phi = THREE.MathUtils.degToRad(90);    // Elevation angle
  const theta = THREE.MathUtils.degToRad(180); // Azimuth angle
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyUniforms['sunPosition'].value.copy(sunPosition);
  
  // Store sky for potential updates
  scene.userData.sky = sky;
  scene.userData.sunPosition = sunPosition;
  
  // Add volumetric clouds with noise textures
  createVolumetricClouds();
  
  console.log('☁️ Skybox created with Three.js Sky addon');
}

function createVolumetricClouds() {
  // Create custom shader material for volumetric clouds
  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      cloudDensity: { value: 0.4 },
      cloudSpeed: { value: 0.02 },
      lightDirection: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
      cloudColor: { value: new THREE.Color(0xffffff) },
      skyColor: { value: new THREE.Color(0x87ceeb) }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float cloudDensity;
      uniform float cloudSpeed;
      uniform vec3 lightDirection;
      uniform vec3 cloudColor;
      uniform vec3 skyColor;
      
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      
      // Simplex noise function for cloud generation
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
      
      // Fractal Brownian Motion for more natural cloud patterns
      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for(int i = 0; i < 5; i++) {
          value += amplitude * snoise(p * frequency);
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }
      
      void main() {
        // Sample position with time for animation
        vec3 samplePos = vWorldPosition * 0.02;
        samplePos.x += time * cloudSpeed;
        samplePos.z += time * cloudSpeed * 0.5;
        
        // Generate cloud density using FBM
        float noise = fbm(samplePos);
        float density = smoothstep(cloudDensity - 0.1, cloudDensity + 0.5, noise);
        
        // Add height-based falloff for more realistic clouds
        float heightFalloff = 1.0; // Remove height falloff for plane geometry
        density *= heightFalloff;
        
        // Simple lighting based on light direction
        float lighting = max(0.6, dot(normalize(vec3(0.0, 1.0, 0.0)), lightDirection));
        
        // Mix cloud color with sky color based on density
        vec3 finalColor = mix(skyColor, cloudColor * lighting, density);
        
        // Set alpha based on density - make more visible
        float alpha = density * 0.9;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.NormalBlending
  });
  
  // Create multiple cloud layers for depth
  const cloudGroup = new THREE.Group();
  
  // Lower cloud layer - make it larger and more visible
  const cloudGeometry1 = new THREE.BoxGeometry(300, 40, 300, 30, 8, 30);
  const clouds1 = new THREE.Mesh(cloudGeometry1, cloudMaterial);
  clouds1.position.y = 45;
  cloudGroup.add(clouds1);
  
  // Upper cloud layer (slightly different settings)
  const cloudMaterial2 = cloudMaterial.clone();
  cloudMaterial2.uniforms.time = { value: 0.5 };
  cloudMaterial2.uniforms.cloudDensity = { value: 0.35 };
  cloudMaterial2.uniforms.cloudSpeed = { value: 0.015 };
  cloudMaterial2.uniforms.lightDirection = { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() };
  cloudMaterial2.uniforms.cloudColor = { value: new THREE.Color(0xffffff) };
  cloudMaterial2.uniforms.skyColor = { value: new THREE.Color(0x87ceeb) };
  
  const cloudGeometry2 = new THREE.BoxGeometry(250, 30, 250, 30, 8, 30);
  const clouds2 = new THREE.Mesh(cloudGeometry2, cloudMaterial2);
  clouds2.position.y = 70;
  cloudGroup.add(clouds2);
  
  scene.add(cloudGroup);
  
  // Add some simple visible sprite clouds as well for immediate visibility
  addSimpleClouds();
  
  // Store for animation
  scene.userData.volumetricClouds = [cloudMaterial, cloudMaterial2];
  
  console.log('☁️ Volumetric clouds created with noise textures');
}

function addSimpleClouds() {
  // This function is now empty to remove the simple sprite-based clouds.
  // The volumetric clouds are still active.
  console.log('☁️ Skipping simple sprite clouds.');
}

function createClouds() {
  // Removed - using volumetric clouds instead
}

function createLighting() {
  // Ambient light (early morning soft light)
  const ambientLight = new THREE.AmbientLight(0xffd89b, 0.4);
  scene.add(ambientLight);
  
  // Directional light (sun - early morning angle matching sky)
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  
  // Position sun to match the sky's sun position
  const phi = THREE.MathUtils.degToRad(90);
  const theta = THREE.MathUtils.degToRad(180);
  const sunPosition = new THREE.Vector3().setFromSphericalCoords(50, phi, theta);
  dirLight.position.copy(sunPosition);
  dirLight.castShadow = true;
  
  // Configure shadow properties
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.bias = -0.0001;
  
  scene.add(dirLight);
  
  // Hemisphere light for more natural outdoor lighting
  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.5);
  scene.add(hemiLight);
  
  console.log('☀️ Lighting created');
}

function createGround() {
  // Visual ground
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x7cae7a,
    roughness: 0.8,
    metalness: 0.2
  });
  
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1; // Offset ground plane
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Physics ground (static, infinite plane)
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC,
    shape: groundShape
  });
  groundBody.position.y = -1; // Match visual ground offset
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  physicsWorld.addBody(groundBody);
  
  console.log('🌍 Ground created (static)');
}

// =====================================================
// PHYSICS SYSTEM
// =====================================================
function initPhysics() {
  physicsWorld = new CANNON.World({
    gravity: new CANNON.Vec3(0, CONFIG.physics.gravity, 0)
  });
  
  // Default contact material
  const defaultMaterial = new CANNON.Material('default');
  const defaultContactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
    friction: 0.3,
    restitution: 0.1
  });
  physicsWorld.addContactMaterial(defaultContactMaterial);
  physicsWorld.defaultContactMaterial = defaultContactMaterial;
  
  console.log('⚙️ Physics initialized');
}

// =====================================================
// POST-PROCESSING SYSTEM
// =====================================================
function setupPostProcessing(settings) {
  if (!settings || !composer) return;
  
  const { bloom, ssao } = settings;
  
  // Add Bloom pass if enabled
  if (bloom && bloom.enabled) {
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloom.strength || 0.5,
      bloom.radius || 0.4,
      bloom.threshold || 0.85
    );
    composer.addPass(bloomPass);
    console.log('💫 Bloom enabled:', bloom);
  }
  
  // Add SSAO pass if enabled
  if (ssao && ssao.enabled) {
    const ssaoPass = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ssaoPass.kernelRadius = ssao.kernelRadius || 16;
    ssaoPass.minDistance = ssao.minDistance || 0.005;
    ssaoPass.maxDistance = ssao.maxDistance || 0.1;
    composer.addPass(ssaoPass);
    console.log('🌫️ SSAO enabled:', ssao);
  }
  
  // Add output pass for proper color correction
  const outputPass = new OutputPass();
  composer.addPass(outputPass);
  
  console.log('✨ Post-processing configured from scene data');
}

// =====================================================
// LOAD SCENE DATA
// =====================================================
async function loadSceneData() {
  try {
    const response = await fetch('./scene.json');
    if (!response.ok) {
      console.warn('No scene.json found, using default scene');
      return null;
    }
    sceneData = await response.json();
    console.log('📦 Scene data loaded:', sceneData);
    return sceneData;
  } catch (error) {
    console.warn('Could not load scene.json:', error);
    return null;
  }
}

async function buildSceneFromData() {
  // ALWAYS load the character first (not from scene.json)
  await loadDefaultCharacter();
  
  // Then load scene objects from scene.json (if available)
  if (!sceneData || !sceneData.objects) {
    console.log('📦 No scene data found, only character loaded');
    return;
  }
  
  const loader = new GLTFLoader();
  
  for (const obj of sceneData.objects) {
    // Skip player character - already loaded by default
    if (obj.isPlayer) {
      continue;
    }
    
    // Skip lights - already created in initScene
    if (obj.type === 'light') {
      continue;
    }
    
    if (obj.type === 'gltf') {
      // Skip if no model path
      if (!obj.modelPath) {
        console.warn(`⚠️ Skipping GLTF object "${obj.name}" - no modelPath specified`);
        continue;
      }
      
      try {
        const gltf = await loader.loadAsync(obj.modelPath);
        const model = gltf.scene;
        
        model.name = obj.name || 'GLTF Model';
        model.position.set(...obj.position);
        model.rotation.set(...obj.rotation);
        model.scale.set(...obj.scale);
        
        // Enable shadows
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        scene.add(model);
        
        // Add physics if enabled
        if (obj.physics && obj.physics.enabled) {
          createPhysicsBody(model, obj.physics, obj.collisionFrames);
        }
      } catch (error) {
        console.error(`Failed to load model: ${obj.modelPath}`, error);
      }
    } else if (obj.type === 'mesh' || obj.type === 'primitive') {
      createMeshObject(obj);
    }
  }
  
  console.log('✅ Scene loaded from scene.json');
}

// Load the default character (always present)
async function loadDefaultCharacter() {
  const loader = new GLTFLoader();
  try {
    console.log('👤 Loading default character...');
    const gltf = await loader.loadAsync('./assets/models/Soldier.glb');
    const model = gltf.scene;
    
    model.name = 'Player';
    model.position.set(0, -1.05, 0);
    model.scale.setScalar(1);
    
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Ensure the model is visible from all angles
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(mat => {
              const cloned = mat.clone();
              cloned.side = THREE.DoubleSide;
              return cloned;
            });
          } else {
            child.material = child.material.clone();
            child.material.side = THREE.DoubleSide;
          }
        }
      }
    });
    
    scene.add(model);
    
    // Define collision frames matching the editor values
    const collisionFrames = [
      {
        type: 'box',
        position: { x: 0, y: 0.9, z: 0 },
        size: { x: 0.5, y: 1.7, z: 0.5 },
        rotation: { x: 0, y: 0, z: 0 }
      }
    ];
    
    setupCharacter(model, gltf, collisionFrames);
    console.log('✅ Default character loaded');
  } catch (error) {
    console.error('❌ Failed to load default character:', error);
    createCapsuleCharacter();
  }
}

function createMeshObject(objData) {
  let geometry;
  
  // Determine geometry type from object name or explicit geometry field
  let geometryType = objData.geometry || 'BoxGeometry';
  
  // Try to infer from object name if not specified
  if (!objData.geometry && objData.name) {
    const nameLower = objData.name.toLowerCase();
    if (nameLower.includes('sphere')) geometryType = 'SphereGeometry';
    else if (nameLower.includes('cylinder')) geometryType = 'CylinderGeometry';
    else if (nameLower.includes('cube') || nameLower.includes('box')) geometryType = 'BoxGeometry';
  }
  
  // Create geometry with parameters or defaults
  switch (geometryType) {
    case 'BoxGeometry':
    case 'box':
      const boxParams = objData.geometryParams || [1, 1, 1];
      geometry = new THREE.BoxGeometry(...boxParams);
      break;
    case 'SphereGeometry':
    case 'sphere':
      const sphereParams = objData.geometryParams || [0.5, 32, 32];
      geometry = new THREE.SphereGeometry(...sphereParams);
      break;
    case 'CylinderGeometry':
    case 'cylinder':
      const cylParams = objData.geometryParams || [0.5, 0.5, 1, 32];
      geometry = new THREE.CylinderGeometry(...cylParams);
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 1, 1);
  }
  
  const material = new THREE.MeshStandardMaterial({
    color: objData.color || 0xcccccc,
    roughness: 0.7,
    metalness: 0.3
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = objData.name || 'Mesh';
  mesh.position.set(...objData.position);
  mesh.rotation.set(...objData.rotation);
  mesh.scale.set(...objData.scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Adjust Y position if object is at ground level (y=0) - ground plane is at y=-1
  // So we need to offset objects to sit ON the ground
  if (mesh.position.y === 0) {
    // Get the height of the object to place it correctly on the ground
    const bbox = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    mesh.position.y = -1 + (size.y / 2); // Place bottom of object at ground level
    console.log(`   ⬆️ Adjusted Y position from 0 to ${mesh.position.y.toFixed(2)} (ground is at -1)`);
  }
  
  scene.add(mesh);
  
  // Create physics bodies for collision
  if (objData.physics && objData.physics.enabled) {
    createPhysicsBody(mesh, objData.physics, objData.collisionFrames);
  }
}

function createPhysicsBody(threeObject, physicsConfig, collisionFrames = null) {
  // If collision frames are provided, create compound body
  if (collisionFrames && collisionFrames.length > 0) {
    console.log(`Creating compound physics body for ${threeObject.name} with ${collisionFrames.length} collision frames`);
    
    // Create compound body
    const body = new CANNON.Body({ 
      mass: physicsConfig.isStatic ? 0 : (physicsConfig.mass || 1),
      type: physicsConfig.isStatic ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC
    });
    
    // Add each collision frame as a child shape (apply object's world scale)
    collisionFrames.forEach((frame, index) => {
      let shape;
      const worldScale = threeObject.getWorldScale(new THREE.Vector3());

      // Create shape based on frame type (scale sizes into world units)
      if (frame.type === 'box') {
        const halfSize = new CANNON.Vec3(
          ((frame.size?.x || 1) * worldScale.x) / 2,
          ((frame.size?.y || 1) * worldScale.y) / 2,
          ((frame.size?.z || 1) * worldScale.z) / 2
        );
        shape = new CANNON.Box(halfSize);
      } else if (frame.type === 'sphere') {
        const maxScale = Math.max(worldScale.x, worldScale.y, worldScale.z);
        shape = new CANNON.Sphere((frame.radius || 0.5) * maxScale);
      } else if (frame.type === 'capsule') {
        // Use cylinder for capsule approximation; scale radius/height
        const radius = (frame.radius || 0.5) * Math.max(worldScale.x, worldScale.z);
        const height = ((frame.size?.y || 2) * worldScale.y) - (2 * radius);
        shape = new CANNON.Cylinder(radius, radius, Math.max(height, 0.01), 8);
      }

      if (shape) {
        // Apply frame position and rotation offsets (scale positional offset)
        const framePos = new CANNON.Vec3(
          (frame.position?.x || 0) * worldScale.x,
          (frame.position?.y || 0) * worldScale.y,
          (frame.position?.z || 0) * worldScale.z
        );
        
        const frameQuat = new CANNON.Quaternion();
        if (frame.rotation) {
          // Stored rotations in editor are degrees — convert to radians for cannon
          const toRad = Math.PI / 180;
          frameQuat.setFromEuler(
            (frame.rotation.x || 0) * toRad,
            (frame.rotation.y || 0) * toRad,
            (frame.rotation.z || 0) * toRad
          );
        }

        body.addShape(shape, framePos, frameQuat);
        console.log(`  Added ${frame.type} shape ${index + 1} at position:`, framePos);
      }
    });
    
    // Position the compound body
    body.position.copy(threeObject.position);
    body.quaternion.copy(threeObject.quaternion);
    
    physicsWorld.addBody(body);
    threeObject.userData.physicsBody = body;
    
    console.log(`✅ Created compound physics body for ${threeObject.name} (${physicsConfig.isStatic ? 'STATIC' : 'DYNAMIC'})`);
    return;
  }
  
  // Fallback to original physics body creation for objects without collision frames
  let size = physicsConfig.size;
  if (!size) {
    const bbox = new THREE.Box3().setFromObject(threeObject);
    const bsize = new THREE.Vector3();
    bbox.getSize(bsize);
    size = { x: bsize.x / 2, y: bsize.y / 2, z: bsize.z / 2 };
  } else {
    // Size is full dimensions, divide by 2 for half-extents
    size = { x: size.x / 2, y: size.y / 2, z: size.z / 2 };
  }
  
  // Create shape based on bodyType
  let shape;
  if (physicsConfig.bodyType === 'box' || !physicsConfig.bodyType) {
    shape = new CANNON.Box(new CANNON.Vec3(size.x, size.y, size.z));
  } else if (physicsConfig.bodyType === 'sphere') {
    const radius = Math.max(size.x, size.y, size.z);
    shape = new CANNON.Sphere(radius);
  } else if (physicsConfig.bodyType === 'cylinder') {
    shape = new CANNON.Cylinder(size.x, size.x, size.y * 2, 8);
  }
  
  // Create body - respect isStatic flag from export data
  const body = new CANNON.Body({ 
    mass: physicsConfig.isStatic ? 0 : (physicsConfig.mass || 1),
    shape: shape,
    type: physicsConfig.isStatic ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC
  });
  
  body.position.copy(threeObject.position);
  body.quaternion.copy(threeObject.quaternion);
  
  physicsWorld.addBody(body);
  
  // Store reference for syncing
  threeObject.userData.physicsBody = body;
  
  console.log(`Created ${physicsConfig.isStatic ? 'STATIC' : 'DYNAMIC'} physics body for:`, threeObject.name);
}

// =====================================================
// CHARACTER CONTROLLER
// =====================================================

function createCapsuleCharacter() {
  // Create a simple capsule as fallback character
  const capsuleGeometry = new THREE.CapsuleGeometry(
    CONFIG.character.capsuleRadius,
    CONFIG.character.capsuleHeight,
    8,
    16
  );
  const capsuleMaterial = new THREE.MeshStandardMaterial({ color: 0x4ade80 });
  const capsule = new THREE.Mesh(capsuleGeometry, capsuleMaterial);
  capsule.castShadow = true;
  capsule.position.y = CONFIG.character.capsuleHeight / 2 + CONFIG.character.capsuleRadius;
  
  scene.add(capsule);
  gameState.player.object = capsule;
  
  // Create physics body
  const shape = new CANNON.Cylinder(
    CONFIG.character.capsuleRadius,
    CONFIG.character.capsuleRadius,
    CONFIG.character.capsuleHeight,
    8
  );
  const body = new CANNON.Body({
    mass: 1,
    shape: shape,
    linearDamping: 0.9,
    angularDamping: 0.99
  });
  body.position.y = CONFIG.character.capsuleHeight / 2 + CONFIG.character.capsuleRadius;
  physicsWorld.addBody(body);
  gameState.player.body = body;
  
  console.log('🤖 Capsule character created');
}

function setupCharacter(model, gltf, collisionFrames = null) {
  gameState.player.object = model;
  
  // Setup animations
  if (gltf.animations && gltf.animations.length > 0) {
    gameState.player.mixer = new THREE.AnimationMixer(model);
    
    gltf.animations.forEach((clip) => {
      const action = gameState.player.mixer.clipAction(clip);
      gameState.player.actions[clip.name.toLowerCase()] = action;
    });
    
    // Play idle animation
    const idleAction = gameState.player.actions['idle'];
    if (idleAction) {
      idleAction.play();
    }
  }

  // Create physics body for character - MATCH EDITOR'S APPROACH
  let body = new CANNON.Body({
    mass: 1,
    linearDamping: 0.05,
    angularDamping: 0.05,
    fixedRotation: true  // Prevent character from tipping over
  });
  
  if (collisionFrames && collisionFrames.length > 0) {
    console.log(`🎮 Creating character physics body with ${collisionFrames.length} collision frames`);
    
    // Add each collision frame as a child shape (just like the editor does)
    collisionFrames.forEach((frame, index) => {
      let shape;
      
      // Create shape based on frame type
      if (frame.type === 'box') {
        shape = new CANNON.Box(new CANNON.Vec3(
          (frame.size?.x || 1) / 2,
          (frame.size?.y || 1) / 2, 
          (frame.size?.z || 1) / 2
        ));
      } else if (frame.type === 'sphere') {
        shape = new CANNON.Sphere(frame.radius || 0.5);
      } else if (frame.type === 'cylinder') {
        shape = new CANNON.Cylinder(
          frame.radius || 0.5,
          frame.radius || 0.5,
          frame.height || 1,
          8
        );
      }
      
      if (shape) {
        // Frame position is RELATIVE to the body (model origin)
        const framePos = new CANNON.Vec3(
          frame.position?.x || 0,
          frame.position?.y || 0,
          frame.position?.z || 0
        );
        
        const frameQuat = new CANNON.Quaternion();
        if (frame.rotation) {
          frameQuat.setFromEuler(
            (frame.rotation.x || 0) * Math.PI / 180,
            (frame.rotation.y || 0) * Math.PI / 180,
            (frame.rotation.z || 0) * Math.PI / 180
          );
        }
        
        // Add shape as child with offset
        body.addShape(shape, framePos, frameQuat);
        console.log(`  ✅ Added ${frame.type} shape ${index + 1} at offset (${framePos.x}, ${framePos.y}, ${framePos.z})`);
      }
    });
  } else {
    console.log('🎮 Creating default character physics body (capsule)');
    
    // Default character physics body (capsule)
    const bbox = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    const capsuleRadius = Math.min(size.x, size.z) * 0.45;
    const capsuleHeight = size.y * 0.90;
    
    const shape = new CANNON.Cylinder(capsuleRadius, capsuleRadius, capsuleHeight, 8);
    body.addShape(shape);
  }
  
  // Position physics body at MODEL's position (shapes are offset from here)
  // This matches how the editor does it
  body.position.copy(model.position);
  body.updateMassProperties();
  
  physicsWorld.addBody(body);
  gameState.player.body = body;
  
  console.log(`🎮 Character physics body at (${body.position.x}, ${body.position.y}, ${body.position.z})`);
  console.log('🎮 Character controller setup complete');
}

// =====================================================
// INPUT HANDLING
// =====================================================
function setupInput() {
  // Keyboard
  document.addEventListener('keydown', (e) => {
    gameState.keys[e.code] = true;
    
    // Toggle controls info
    if (e.code === 'KeyH') {
      const info = document.getElementById('controls-info');
      info.classList.toggle('hidden');
    }
    
    // Only prevent default for game control keys
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  
  document.addEventListener('keyup', (e) => {
    gameState.keys[e.code] = false;
  });
  
  // Mouse for camera
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body) {
      gameState.camera.yaw -= e.movementX * CONFIG.camera.sensitivity;
      gameState.camera.pitch -= e.movementY * CONFIG.camera.sensitivity;
      gameState.camera.pitch = Math.max(
        -CONFIG.camera.pitchLimit,
        Math.min(CONFIG.camera.pitchLimit, gameState.camera.pitch)
      );
    }
  });
  
  // Pointer lock
  document.body.addEventListener('click', () => {
    if (gameState.isRunning && !document.pointerLockElement) {
      document.body.requestPointerLock();
    }
  });
  
  console.log('🎮 Input system ready');
}

// =====================================================
// GAME LOOP
// =====================================================
function updateCharacter(delta) {
  const player = gameState.player;
  if (!player.object || !player.body) return;
  
  // Ground check with camera set for raycaster
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(player.object.position.x, player.object.position.y + 0.1, player.object.position.z),
    new THREE.Vector3(0, -1, 0)
  );
  raycaster.camera = camera; // Set camera for sprite raycasting
  
  // Filter out sprites and helpers from raycast
  const hits = raycaster.intersectObjects(scene.children, true).filter(h => 
    h.object.type !== 'Sprite' && 
    !h.object.name.includes('Helper') &&
    h.object.type !== 'LineSegments'
  );
  player.isGrounded = hits.some(h => h.distance < 0.3);
  
  // Get input direction (reversed for correct forward/backward)
  const moveDir = new THREE.Vector2();
  if (gameState.keys['KeyW']) moveDir.y -= 1;  // Forward (inverted)
  if (gameState.keys['KeyS']) moveDir.y += 1;  // Backward (inverted)
  if (gameState.keys['KeyA']) moveDir.x -= 1;
  if (gameState.keys['KeyD']) moveDir.x += 1;
  if (moveDir.length() > 0) moveDir.normalize();
  
  // Calculate movement
  const isRunning = gameState.keys['ShiftLeft'] || gameState.keys['ShiftRight'];
  const speed = isRunning ? CONFIG.character.runSpeed : CONFIG.character.moveSpeed;
  
  const moveX = (Math.sin(gameState.camera.yaw) * moveDir.y + Math.cos(gameState.camera.yaw) * moveDir.x) * speed * delta;
  const moveZ = (Math.cos(gameState.camera.yaw) * moveDir.y - Math.sin(gameState.camera.yaw) * moveDir.x) * speed * delta;
  
  // Apply movement
  player.object.position.x += moveX;
  player.object.position.z += moveZ;
  
  // Rotate player (add Math.PI to make character face forward)
  if (moveDir.length() > 0) {
    const targetAngle = Math.atan2(moveX, moveZ) + Math.PI;
    player.object.rotation.y = THREE.MathUtils.lerp(player.object.rotation.y, targetAngle, 0.15);
  }
  
  // Sync physics body
  player.body.position.x = player.object.position.x;
  player.body.position.z = player.object.position.z;
  player.body.velocity.x = 0;
  player.body.velocity.z = 0;
  
  // Jump
  if ((gameState.keys['Space']) && player.isGrounded) {
    player.body.velocity.y = CONFIG.character.jumpForce;
    gameState.keys['Space'] = false;
  }
  
  // Update player Y from physics
  // Body position = model position (shapes are offset from body center)
  player.object.position.y = player.body.position.y;
  
  // Animation
  if (player.mixer) {
    let animName = 'idle';
    if (moveDir.length() > 0) {
      animName = isRunning ? 'run' : 'walk';
    }
    
    playAnimation(animName);
    player.mixer.update(delta);
  }
  
  // Update camera
  updateCamera();
}

function playAnimation(animName) {
  const player = gameState.player;
  const actions = player.actions;
  
  let targetAction = actions[animName] || actions[animName.toLowerCase()];
  if (!targetAction && Object.keys(actions).length > 0) {
    targetAction = actions[Object.keys(actions)[0]];
  }
  
  if (targetAction && player.currentAction !== animName) {
    const currentAction = actions[player.currentAction];
    if (currentAction) currentAction.fadeOut(0.2);
    
    if (animName === 'run') targetAction.timeScale = 1.5;
    else targetAction.timeScale = 1.0;
    
    targetAction.reset().fadeIn(0.2).play();
    player.currentAction = animName;
  }
}

function updateCamera() {
  const player = gameState.player;
  if (!player.object) return;
  
  const camOffset = new THREE.Vector3(
    Math.sin(gameState.camera.yaw) * CONFIG.camera.distance,
    CONFIG.camera.height,
    Math.cos(gameState.camera.yaw) * CONFIG.camera.distance
  );
  
  camera.position.copy(player.object.position).add(camOffset);
  
  // Look at character with pitch adjustment
  const lookTarget = new THREE.Vector3(
    player.object.position.x - Math.sin(gameState.camera.yaw) * 1,
    player.object.position.y + 1.2 + Math.tan(gameState.camera.pitch) * CONFIG.camera.distance,
    player.object.position.z - Math.cos(gameState.camera.yaw) * 1
  );
  
  camera.lookAt(lookTarget);
}

let lastTime = 0;
let frameCount = 0;
let fpsTime = 0;

function gameLoop() {
  if (!gameState.isRunning) return;
  
  requestAnimationFrame(gameLoop);
  
  const currentTime = performance.now();
  const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;
  
  // Update FPS counter
  frameCount++;
  fpsTime += delta;
  if (fpsTime >= 0.5) {
    const fps = Math.round(frameCount / fpsTime);
    document.getElementById('fps-counter').textContent = `FPS: ${fps}`;
    frameCount = 0;
    fpsTime = 0;
  }
  
  // Update physics
  physicsWorld.step(CONFIG.physics.timeStep);
  
  // Sync physics bodies with visual meshes (for scene objects)
  scene.traverse((object) => {
    if (object.userData.physicsBody && object !== gameState.player.object) {
      const body = object.userData.physicsBody;
      // Only sync dynamic bodies (not static, not the player)
      if (body.type === CANNON.Body.DYNAMIC) {
        object.position.copy(body.position);
        object.quaternion.copy(body.quaternion);
      }
    }
  });
  
  // Update volumetric clouds animation
  if (scene.userData.volumetricClouds) {
    scene.userData.volumetricClouds.forEach((material, index) => {
      material.uniforms.time.value += delta * (index === 0 ? 1.0 : 0.8);
    });
  }
  
  // Update character
  updateCharacter(delta);
  
  // Render with post-processing
  composer.render();
}

// =====================================================
// INITIALIZATION
// =====================================================
async function init() {
  console.log('🎮 Initializing Game Player...');
  
  initScene();
  setupInput();
  
  await loadSceneData();
  await buildSceneFromData();
  
  // Setup post-processing from scene data
  if (sceneData && sceneData.postProcessing) {
    setupPostProcessing(sceneData.postProcessing);
  } else {
    // No post-processing, just add output pass
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
    console.log('✨ No post-processing settings, using default render');
  }
  
  // Hide loading screen
  document.getElementById('loading-screen').classList.add('hidden');
  
  // Setup start button
  const startButton = document.getElementById('start-button');
  startButton.addEventListener('click', () => {
    startButton.classList.add('hidden');
    startGame();
  });
  
  console.log('✅ Game Player ready!');
}

function startGame() {
  gameState.isRunning = true;
  lastTime = performance.now();
  document.body.requestPointerLock();
  gameLoop();
  console.log('🎮 Game started!');
}

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Start the game
init();
