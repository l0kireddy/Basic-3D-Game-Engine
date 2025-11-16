# Audio Assets

This directory contains audio files for the 3D game engine.

## Supported Formats
- `.mp3` (recommended)
- `.wav`
- `.ogg`

## Example Files to Add
- `click.mp3` - UI click sound
- `explosion.mp3` - Collision/destruction sound
- `ambient.mp3` - Background ambient music
- `jump.mp3` - Object interaction sound

## Usage
1. Add audio files to this directory
2. Update the file URLs in `AudioControls.jsx`
3. Use the Audio Controls panel to load sounds
4. Assign sounds to objects in the Inspector's Audio Component

## Audio System Features
- 3D Spatial Audio (sounds position in 3D space)
- Volume controls (Master, SFX, Music)
- Object-based audio components
- Collision sound triggers
- Ambient sound loops
- Background music system

## Loading Audio
The audio system automatically loads files from this directory when you use the "Load Demo Sounds" button in the Audio Controls panel.