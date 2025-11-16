## Character Controller Debug Test

Follow these steps to test the character controller:

### Step 1: Add Character
1. Open the editor in your browser
2. Click "Add Entity" 
3. Add a Droide or Armour character
4. Select the character in the viewport

### Step 2: Configure Player
1. In the Inspector, check "🎮 Player Character"
2. In Character Settings:
   - Set Move Speed: 5.0
   - Set Jump Force: 8.0
   - Set Camera Mode: Third Person
   - Set Collision Body Type: Capsule

### Step 3: Enable Physics
1. In Physics Inspector:
   - Check "Enable Physics"
   - Set Body Type: Box (for now)
   - Set Mass: 1

### Step 4: Test
1. Click "Play" button
2. Open browser console (F12)
3. Try pressing WASD keys
4. Try pressing Space to jump

### Expected Console Output:
```
🎮 CharacterController useEffect triggered - isPlaying: true
🔍 Looking for player character...
🔍 Checking [N] objects in scene store
🔍 Found player object: [CharacterName] hasPhysicsBody: true
🎮 Character controller activated for: [CharacterName]
🎮 Adding keyboard event listeners
🎮 Starting movement update loop
```

### When pressing keys:
```
🎮 Key down: KeyW, isPlaying: true
🎮 Key registered: KeyW
🎮 Movement input detected: {W: true, A: false, S: false, D: false}
```

### If Issues:
- Share the console output
- Note if character flies off when entering play mode
- Note if no movement response to WASD

Let me know what you see!