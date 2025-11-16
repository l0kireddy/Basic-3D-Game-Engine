# 🎮 GD3D Editor - 3D Game Engine & Editor

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react)
![Three.js](https://img.shields.io/badge/Three.js-0.168-000000?logo=three.js)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite)

A powerful browser-based 3D game engine and editor built with React, Three.js, and Supabase. Create immersive 3D platformer games with visual scripting, advanced physics, character controllers, and real-time collaboration—all in your browser!

[Features](#-features) • [Demo](#-demo) • [Installation](#-installation) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## ✨ Features

### 🎨 Editor Features
- **Visual 3D Editor**: Intuitive drag-and-drop interface for GLTF/GLB models
- **Real-time Viewport**: Interactive 3D scene with transform controls (translate, rotate, scale)
- **Hierarchy Panel**: Organize scene objects with parent-child relationships
- **Inspector Panel**: Fine-tune properties, physics, and behaviors
- **Asset Browser**: Manage models, textures, audio, and other resources
- **Prefab System**: Create reusable game objects and templates

### 🎯 Game Development
- **Visual Scripting**: Event-sheet based programming system (inspired by GDevelop)
- **Advanced Character Controller**: Third-person camera, smooth movement, jumping, and animations
- **Physics Engine**: Realistic platformer physics powered by cannon-es
  - Collision detection and response
  - Rigid body dynamics
  - Configurable gravity and friction
- **Audio System**: Import and manage sound effects and music
- **Post-Processing**: Visual effects and rendering enhancements

### 🚀 Production Ready
- **Export System**: Build standalone HTML5 games
- **Cloud Storage**: Save projects and assets to Supabase
- **Authentication**: Secure user accounts and project ownership
- **Real-time Collaboration**: Work together with team members (future feature)

---

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **3D Graphics** | Three.js (WebGL), Transform Controls, GLTF Loader |
| **Physics** | cannon-es (3D Physics Engine) |
| **Backend** | Supabase (Auth, Database, Storage, Realtime) |
| **State Management** | Zustand |
| **UI/UX** | Lucide React Icons, react-dnd (Drag & Drop) |
| **Build Tools** | Vite, PostCSS, Autoprefixer |

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **Supabase Account** (free tier available) - [Sign up](https://supabase.com)
- **Modern Web Browser** (Chrome, Firefox, Edge, or Safari)

---

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/gd3d-editor.git
cd gd3d-editor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> 💡 **Tip**: Copy `.env.example` to `.env` and fill in your Supabase credentials

### 4. Supabase Setup

#### A. Create Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manifest_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assets table
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT,
  path TEXT NOT NULL,
  url TEXT,
  size INTEGER,
  type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Projects
CREATE POLICY "Users can view their own projects" ON projects
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own projects" ON projects
  FOR DELETE USING (auth.uid() = owner_id);

-- RLS Policies for Assets
CREATE POLICY "Users can manage assets for their projects" ON assets
  FOR ALL USING (auth.uid() IN (
    SELECT owner_id FROM projects WHERE id = project_id
  ));
```

#### B. Configure Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Create a new bucket called `gd3d-assets`
3. Set bucket to **Public**
4. Add the following storage policy:

```sql
CREATE POLICY "Users can upload assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gd3d-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Public can view assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'gd3d-assets');
```

### 5. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser! 🎉

---

## 📖 Documentation

### Basic Workflow

1. **Import 3D Models**: Drag GLTF/GLB files into the viewport
2. **Transform Objects**: Use transform controls to position, rotate, and scale objects
3. **Add Physics**: Configure physics properties in the Inspector
4. **Character Controller**: Add advanced third-person controls and animations
5. **Create Events**: Use the Event Sheet to add game logic
6. **Audio**: Import and configure sound effects and background music
7. **Test**: Click Play to test your game in the editor
8. **Export**: Export as a standalone HTML5 game

### Visual Scripting

The event sheet system uses a simple condition → action format:

- **Conditions**: On Start, On Key Pressed, On Collision, etc.
- **Actions**: Apply Force, Set Position, Play Animation, Play Sound, etc.
- **Parameters**: JSON-based configuration for each action

**Example Events:**
```javascript
Condition: On Key Pressed (Space)  →  Action: Apply Force (Player, Y: 10)
Condition: On Collision (Player, Enemy)  →  Action: Load Scene (GameOver)
Condition: On Start  →  Action: Play Audio (BackgroundMusic)
```

### Character Controller

The advanced character controller includes:
- **Third-person camera** with smooth following
- **WASD movement** with run toggle (Shift)
- **Jump mechanics** with grounded detection
- **Animation blending** (idle, walk, run, jump)
- **Physics integration** with collision response

Configure in the Inspector panel under "Character Controller" section.

### Physics System

Built on cannon-es physics engine:
- **Collision Detection**: Box, sphere, and mesh colliders
- **Rigid Body Types**: Static, dynamic, kinematic
- **Physics Materials**: Configure friction, restitution, and mass
- **Debug Visualization**: Real-time wireframe view of colliders

---

## 🎮 Example Projects

Check the `/examples` folder for sample projects:
- **Simple Platformer** (`simple-platformer.json`): Basic jump mechanics and collision
- **Game Player**: Fully configured 3D environment with skybox

---

## 🔧 Development

### Project Structure
```
Basic 3D Game Engine/
├── src/
│   ├── components/              # React UI components
│   │   ├── EditorShell.jsx      # Main editor layout
│   │   ├── SceneViewport.jsx    # 3D viewport with Three.js
│   │   ├── Inspector.jsx        # Properties panel
│   │   ├── HierarchyPanel.jsx   # Scene hierarchy tree
│   │   ├── EventSheetEditor.jsx # Visual scripting editor
│   │   ├── CharacterController.jsx  # Character control setup
│   │   ├── PhysicsControls.jsx  # Physics configuration
│   │   └── AudioControls.jsx    # Audio management
│   ├── engine/                  # Core engine modules
│   │   ├── sceneLoader.js       # Scene serialization/deserialization
│   │   ├── physics.js           # Physics engine integration
│   │   ├── runtimePlayer.js     # Game runtime executor
│   │   └── prefabManager.js     # Prefab system
│   ├── physics/                 # Physics subsystem
│   │   └── PhysicsWorld.js      # Cannon-es wrapper
│   ├── audio/                   # Audio subsystem
│   │   ├── AudioManager.js      # Sound management
│   │   └── AudioGenerator.js    # Procedural audio
│   ├── services/                # External services
│   │   ├── supabase.js          # Supabase client
│   │   ├── auth.js              # Authentication
│   │   └── storage.js           # Cloud storage
│   └── store/                   # Zustand state management
│       ├── sceneStore.js        # Scene state
│       ├── audioStore.js        # Audio state
│       └── playStore.js         # Playback state
├── gameplayer/                  # Standalone game player
│   ├── main.js                  # Runtime entry point
│   └── index.html               # Player HTML template
├── public/                      # Static assets
└── examples/                    # Example projects
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Vite) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint code checks |

### Building for Production

```bash
# Build optimized bundle
npm run build

# The output will be in the /dist folder
# Deploy the dist folder to any static hosting service
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Cannot connect to Supabase"
- **Solution**: Check your `.env` file and ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct

**Issue**: "Physics not working"
- **Solution**: Ensure objects have physics bodies enabled in the Inspector and are not set to "Static" if they should move

**Issue**: "Models not loading"
- **Solution**: Only GLTF/GLB formats are supported. Ensure files are properly exported from your 3D software

**Issue**: "Character controller not responding"
- **Solution**: Check that the character has a collision body and the camera target is properly set

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### How to Contribute

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/gd3d-editor.git`
3. Create a **feature branch**: `git checkout -b feature/amazing-feature`
4. Make your changes and **commit**: `git commit -m 'Add amazing feature'`
5. **Push** to your fork: `git push origin feature/amazing-feature`
6. Open a **Pull Request**

### Contribution Guidelines

- ✅ Use **conventional commits** (feat:, fix:, docs:, etc.)
- ✅ Write **clear commit messages**
- ✅ Update **documentation** for new features
- ✅ Follow the existing **code style** (ESLint rules)
- ✅ Test your changes thoroughly
- ✅ Keep PRs focused on a single feature/fix

### Areas for Contribution

- 🎨 UI/UX improvements
- � Bug fixes and optimization
- 📚 Documentation and tutorials
- 🎮 Example projects and templates
- 🔌 New features and integrations
- 🌍 Internationalization (i18n)

---

## �📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

You are free to use, modify, and distribute this software for personal and commercial projects.

---

## 🌟 Roadmap

### Current Version (v0.1.0)
- ✅ Visual 3D editor
- ✅ Physics engine integration
- ✅ Character controller
- ✅ Event sheet system
- ✅ Cloud storage with Supabase

### Planned Features
- 🔲 Multiplayer support (real-time collaboration)
- 🔲 Visual shader editor
- 🔲 Particle system
- 🔲 Terrain editor
- 🔲 Mobile export (Progressive Web App)
- 🔲 VR/AR support
- 🔲 Asset marketplace
- 🔲 Scripting API (JavaScript/TypeScript)

---

## 🔗 Links & Resources

- **Live Demo**: [Coming Soon]
- **Documentation**: [GitHub Wiki](https://github.com/your-username/gd3d-editor/wiki)
- **Report Bugs**: [Issues](https://github.com/your-username/gd3d-editor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/gd3d-editor/discussions)
- **Discord Community**: [Join our Discord](#) (Coming Soon)

---

## 🙏 Acknowledgments

Special thanks to these amazing projects and communities:

- **[Three.js](https://threejs.org/)** - Powerful 3D graphics library
- **[cannon-es](https://github.com/pmndrs/cannon-es)** - JavaScript 3D physics engine
- **[Supabase](https://supabase.com/)** - Open-source Firebase alternative
- **[GDevelop](https://gdevelop.io/)** - Inspiration for visual scripting system
- **[React Three Fiber](https://github.com/pmndrs/react-three-fiber)** - React renderer for Three.js
- **[Blender](https://www.blender.org/)** - For 3D model creation and testing


---

<div align="center">

**Built with ❤️ for the game development community**

If you find this project helpful, please consider giving it a ⭐️!

[⬆ Back to Top](#-gd3d-editor---3d-game-engine--editor)

</div>
