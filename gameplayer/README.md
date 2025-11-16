# 🎮 GD3D Game Player

A standalone game player for scenes created in GD3D Editor. No npm install required!

## 🚀 Features

- **Standalone HTML5 Game** - Runs directly in browser
- **No Dependencies Install** - Uses CDN for Three.js and Cannon.js
- **Character Controller** - WASD movement, running, jumping
- **Physics Engine** - Full Cannon.js physics simulation
- **Beautiful Graphics** - Early morning skybox with clouds and realistic lighting
- **Shadow System** - Dynamic shadows for all objects
- **Portable** - Share the folder and play anywhere

## 📁 Folder Structure

```
gameplayer/
├── index.html          # Main HTML file
├── main.js             # Game logic and engine
├── scene.json          # Scene data (exported from editor)
├── assets/
│   ├── models/         # 3D models (.glb files)
│   └── skybox/         # Skybox textures
└── README.md           # This file
```

## 🎯 How to Use

### Option 1: Run Locally
1. Open `index.html` in a modern web browser
2. Click "Start Game" button
3. Click on screen to lock mouse cursor
4. Use controls to play

### Option 2: Run with Web Server
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Then open http://localhost:8000
```

## 🎮 Controls

- **W/A/S/D** - Move character
- **Shift** - Run (hold while moving)
- **Space** - Jump
- **Mouse** - Look around (requires cursor lock)
- **H** - Hide/show controls overlay
- **Click** - Lock/unlock cursor

## 🔧 Exporting from GD3D Editor

1. Create your scene in GD3D Editor
2. Add objects, physics, and character
3. Click "Export Game" button
4. Scene data will be saved to `scene.json`
5. Copy model files to `assets/models/`
6. Open `index.html` to play!

## 🌅 Default Scene

The player includes a beautiful early morning scene with:
- **Gradient skybox** (sunrise colors)
- **Clouds** (soft white clouds in sky)
- **Directional sunlight** (warm morning light)
- **Ambient lighting** (soft fill light)
- **Shadows** (realistic shadow mapping)
- **Ground plane** (green grass terrain)

## 🎨 Customization

### Modify Lighting
Edit `createLighting()` in `main.js` to change:
- Light colors and intensity
- Sun position and angle
- Shadow quality and range

### Modify Skybox
Edit `createSkybox()` in `main.js` to change:
- Sky gradient colors
- Cloud density and position
- Atmosphere effects

### Modify Character
Edit `CONFIG` object in `main.js`:
```javascript
const CONFIG = {
  character: {
    moveSpeed: 5,      // Walking speed
    runSpeed: 10,      // Running speed
    jumpForce: 8,      // Jump height
  },
  camera: {
    distance: 5,       // Camera distance from player
    sensitivity: 0.002 // Mouse sensitivity
  }
};
```

## 🐛 Troubleshooting

**Problem: Cursor won't lock**
- Some browsers require user interaction first
- Make sure to click the "Start Game" button
- Click on the canvas area

**Problem: Models don't load**
- Check browser console for errors
- Ensure model files are in `assets/models/`
- Verify paths in `scene.json`

**Problem: Physics acting weird**
- Check that objects have proper scale
- Verify physics settings in scene.json
- Try adjusting gravity in CONFIG

## 📦 Sharing Your Game

To share your game:
1. Copy the entire `gameplayer` folder
2. Ensure all models are in `assets/models/`
3. Zip the folder or upload to a web server
4. Share the link or zip file!

## 🔗 Tech Stack

- **Three.js** - 3D rendering engine
- **Cannon.js** - Physics engine
- **GLTFLoader** - 3D model loading
- **ES6 Modules** - Modern JavaScript

## 📄 License

Part of GD3D Editor project.

---

Made with ❤️ by GD3D Editor
