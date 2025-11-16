# Contributing to GD3D Editor

First off, thank you for considering contributing to GD3D Editor! 🎉 It's people like you that make this project a great tool for the game development community.

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

**Bug Report Template:**
```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. Windows 11, macOS Sonoma]
 - Browser: [e.g. Chrome 120, Firefox 121]
 - Node.js version: [e.g. 18.17.0]
 - Project version: [e.g. 0.1.0]

**Additional context**
Add any other context about the problem here.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful** to most users
- **List some examples** of how it would work
- **Include mockups or diagrams** if applicable

### Pull Requests

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Development Guidelines

### Code Style

- **JavaScript/React**: Follow the ESLint configuration provided
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings (except JSX attributes)
- **Semicolons**: Required
- **Naming Conventions**:
  - Components: PascalCase (e.g., `SceneViewport.jsx`)
  - Functions: camelCase (e.g., `loadScene()`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_OBJECTS`)
  - Files: PascalCase for components, camelCase for utilities

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Changes to build process or auxiliary tools

**Examples:**
```
feat(physics): add support for cylinder colliders
fix(editor): resolve transform control flickering issue
docs(readme): update installation instructions
refactor(scene): optimize scene graph traversal
```

### Project Structure

When adding new features, follow the existing project structure:

```
src/
├── components/     # React components (UI)
├── engine/         # Core engine logic
├── physics/        # Physics subsystem
├── audio/          # Audio subsystem
├── services/       # External services (Supabase, etc.)
├── store/          # State management (Zustand)
└── utils/          # Utility functions
```

### Testing Your Changes

Before submitting a PR:

1. **Run the linter**: `npm run lint`
2. **Build the project**: `npm run build`
3. **Test in development**: `npm run dev`
4. **Test the built version**: `npm run preview`
5. **Test in multiple browsers** (Chrome, Firefox, Safari, Edge)
6. **Test key workflows**:
   - Create new scene
   - Import 3D models
   - Add physics
   - Use character controller
   - Export game
   - Save/load from Supabase

## 🎯 Priority Areas

We're particularly interested in contributions in these areas:

### High Priority
- 🐛 Bug fixes and stability improvements
- 📚 Documentation and tutorials
- 🎨 UI/UX improvements
- ♿ Accessibility enhancements
- 🌍 Internationalization (i18n)

### Medium Priority
- 🎮 Example projects and templates
- 🔌 New physics features
- 🎨 Visual effects and shaders
- 🎵 Audio system improvements

### Future Features
- 🌐 Multiplayer support
- 📱 Mobile/PWA support
- 🥽 VR/AR integration
- 🛒 Asset marketplace

## 🔍 Code Review Process

1. **Automated Checks**: Your PR will be automatically checked for linting errors
2. **Manual Review**: A maintainer will review your code for:
   - Code quality and style
   - Adherence to project architecture
   - Test coverage
   - Documentation updates
3. **Feedback**: We may request changes or ask questions
4. **Approval**: Once approved, your PR will be merged!

## 📚 Resources

- [React Documentation](https://react.dev/)
- [Three.js Documentation](https://threejs.org/docs/)
- [cannon-es Documentation](https://pmndrs.github.io/cannon-es/)
- [Supabase Documentation](https://supabase.com/docs)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/)

## 💬 Communication

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and community chat
- **Pull Requests**: For code contributions

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone, regardless of:
- Age, body size, disability, ethnicity, gender identity and expression
- Level of experience, education, socio-economic status
- Nationality, personal appearance, race, religion
- Sexual identity and orientation

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

## 🎉 Recognition

Contributors will be:
- Listed in the project's README
- Mentioned in release notes for their contributions
- Given credit in the CONTRIBUTORS file

Thank you for contributing to GD3D Editor! 🚀
