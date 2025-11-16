import * as THREE from 'three';
import { PhysicsEngine } from './physics.js';
import { SceneLoader } from './sceneLoader.js';

export class RuntimePlayer {
  constructor(canvas, projectData) {
    this.canvas = canvas;
    this.projectData = projectData;
    this.isPlaying = false;
    this.isPaused = false;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.physics = new PhysicsEngine();
    this.sceneLoader = new SceneLoader();
  this.mixers = [];
    this.eventInterpreter = new EventInterpreter(this);
    this.inputManager = new InputManager();
    
    this.clock = new THREE.Clock();
    this.animationId = null;
  }

  async initialize() {
    // Set up Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    // Set up camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      1000
    );

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true 
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;

    // Load scene from project data
    if (this.projectData.scenes && this.projectData.scenes.length > 0) {
      const sceneData = this.projectData.scenes[0]; // Load first scene
      await this.loadScene(sceneData);
    }

    // Initialize event system
    this.eventInterpreter.initialize(this.projectData.eventSheets || []);
  }

  async loadScene(sceneData) {
    // Clear existing scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    // Set up lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    this.scene.add(hemi);
    
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    this.scene.add(dir);

    // Load entities
    if (sceneData.entities) {
      for (const entityData of sceneData.entities) {
        const entity = await this.sceneLoader.createEntity(entityData);
        if (entity) {
          this.scene.add(entity);
          
          // Add physics body if specified
          if (entityData.physics) {
            this.physics.addBody(entity, entityData.physics);
          }
          // If SceneLoader attached GLTF animations, create an AnimationMixer for runtime playback
          try {
            if (entity.userData && entity.userData._gltfAnimations && entity.userData._gltfAnimations.length > 0) {
              const mixer = new THREE.AnimationMixer(entity);
              entity.userData._gltfAnimations.forEach((clip) => {
                try { const action = mixer.clipAction(clip); action.play(); } catch (e) { /* ignore */ }
              });
              this.mixers.push(mixer);
              console.log(`🎞️ Runtime: created mixer for ${entity.name} with ${entity.userData._gltfAnimations.length} clips`);
            }
          } catch (err) { /* ignore animation setup errors */ }
        }
      }
    }

    // Set up camera
    if (sceneData.camera) {
      this.camera.position.set(...sceneData.camera.pos);
      this.camera.lookAt(...sceneData.camera.target);
    }
  }

  play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.isPaused = false;
    this.clock.start();
    this.eventInterpreter.trigger('OnStart');
    this.animate();
  }

  pause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.clock.stop();
    } else {
      this.clock.start();
    }
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.clock.stop();
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Reset physics
    this.physics.dispose();
    this.physics = new PhysicsEngine();
    // Stop and clear runtime mixers
    try {
      this.mixers.forEach(m => { try { m.stopAllAction && m.stopAllAction(); } catch (e) {} });
    } catch (err) {}
    this.mixers = [];
    
    // Reload scene to reset positions
    if (this.projectData.scenes && this.projectData.scenes.length > 0) {
      this.loadScene(this.projectData.scenes[0]);
    }
  }

  animate() {
    if (!this.isPlaying) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    if (this.isPaused) return;

    const deltaTime = this.clock.getDelta();

    // Update physics
    this.physics.step(deltaTime);

    // Update runtime animation mixers
    try {
      this.mixers.forEach((m) => { try { m.update(deltaTime); } catch (e) { /* ignore */ } });
    } catch (err) { /* ignore */ }

    // Process input
    this.inputManager.update();

    // Trigger update events
    this.eventInterpreter.trigger('OnUpdate', { deltaTime });

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.physics.dispose();
    this.inputManager.dispose();
    this.renderer.dispose();
  }
}

class EventInterpreter {
  constructor(runtime) {
    this.runtime = runtime;
    this.eventSheets = [];
    this.listeners = new Map();
  }

  initialize(eventSheets) {
    this.eventSheets = eventSheets;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Set up keyboard listeners
    document.addEventListener('keydown', (e) => {
      this.trigger('OnKeyPressed', { key: e.code });
    });

    document.addEventListener('keyup', (e) => {
      this.trigger('OnKeyReleased', { key: e.code });
    });
  }

  trigger(eventType, data = {}) {
    this.eventSheets.forEach(sheet => {
      sheet.events?.forEach(event => {
        if (this.matchesCondition(event.condition, eventType, data)) {
          this.executeAction(event.action, event.parameters, data);
        }
      });
    });
  }

  matchesCondition(condition, eventType, data) {
    if (condition.type === eventType) {
      // Check additional parameters
      if (condition.parameters) {
        for (const [key, value] of Object.entries(condition.parameters)) {
          if (data[key] !== value) return false;
        }
      }
      return true;
    }
    return false;
  }

  executeAction(action, parameters, eventData) {
    switch (action.type) {
      case 'ApplyForce':
        this.applyForce(parameters);
        break;
      case 'SetPosition':
        this.setPosition(parameters);
        break;
      case 'SetVelocity':
        this.setVelocity(parameters);
        break;
      case 'PlaySound':
        this.playSound(parameters);
        break;
      case 'LoadScene':
        this.loadScene(parameters);
        break;
      
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  applyForce(params) {
    const object = this.runtime.scene.getObjectByName(params.target);
    if (object) {
      this.runtime.physics.applyJumpForce(object, params.force);
    }
  }

  setPosition(params) {
    const object = this.runtime.scene.getObjectByName(params.target);
    if (object) {
      object.position.set(params.x, params.y, params.z);
    }
  }

  setVelocity(params) {
    const object = this.runtime.scene.getObjectByName(params.target);
    if (object) {
      const body = this.runtime.physics.bodies.get(object);
      if (body) {
        body.velocity.set(params.x, params.y, params.z);
      }
    }
  }

  playSound(params) {
    // Implement sound playing
    console.log('Playing sound:', params.soundId);
  }

  loadScene(params) {
    // Implement scene loading
    console.log('Loading scene:', params.sceneId);
  }
}

class InputManager {
  constructor() {
    this.keys = new Set();
    this.setupListeners();
  }

  setupListeners() {
    this.onKeyDown = (e) => this.keys.add(e.code);
    this.onKeyUp = (e) => this.keys.delete(e.code);

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  }

  isKeyPressed(keyCode) {
    return this.keys.has(keyCode);
  }

  update() {
    // Process continuous input here if needed
  }

  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }
}