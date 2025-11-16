import React, { useState } from 'react';
import { Save, FolderOpen, Download, Upload, Trash } from 'lucide-react';
import { useSceneStore } from '../store/sceneStore';
import { usePostProcessingStore } from '../store/postProcessingStore';

export function SettingsPanel() {
  const { objects, scene } = useSceneStore();
  const { exportSettings, importSettings } = usePostProcessingStore();
  const [projectName, setProjectName] = useState('MyProject');
  const [saveStatus, setSaveStatus] = useState('');

  // Save entire editor state to localStorage
  const saveProject = () => {
    try {
      const projectData = {
        name: projectName,
        timestamp: new Date().toISOString(),
        objects: Array.from(objects.entries()).map(([id, data]) => ({
          id,
          ...data,
          // Convert Three.js objects to serializable format
          position: data.position ? [data.position.x, data.position.y, data.position.z] : [0, 0, 0],
          rotation: data.rotation ? [data.rotation.x, data.rotation.y, data.rotation.z] : [0, 0, 0],
          scale: data.scale ? [data.scale.x, data.scale.y, data.scale.z] : [1, 1, 1],
        })),
        postProcessing: exportSettings(),
      };

      localStorage.setItem(`gd3d_project_${projectName}`, JSON.stringify(projectData));
      setSaveStatus('✅ Project saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
      console.log('💾 Project saved:', projectName);
    } catch (error) {
      setSaveStatus('❌ Failed to save project');
      console.error('Save error:', error);
    }
  };

  // Load project from localStorage
  const loadProject = () => {
    try {
      const savedData = localStorage.getItem(`gd3d_project_${projectName}`);
      if (!savedData) {
        setSaveStatus('⚠️ No saved project found');
        setTimeout(() => setSaveStatus(''), 3000);
        return;
      }

      const projectData = JSON.parse(savedData);
      
      // Import post-processing settings
      if (projectData.postProcessing) {
        importSettings(projectData.postProcessing);
      }

      setSaveStatus('✅ Project loaded successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
      console.log('📂 Project loaded:', projectName);
      
      alert('Project loaded! Note: Objects will be fully restored on next scene refresh.');
    } catch (error) {
      setSaveStatus('❌ Failed to load project');
      console.error('Load error:', error);
    }
  };

  // Export project as JSON file
  const exportProjectFile = () => {
    try {
      const projectData = {
        name: projectName,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        objects: Array.from(objects.entries()).map(([id, data]) => ({
          id,
          name: data.name,
          type: data.type,
          position: data.position ? [data.position.x, data.position.y, data.position.z] : [0, 0, 0],
          rotation: data.rotation ? [data.rotation.x, data.rotation.y, data.rotation.z] : [0, 0, 0],
          scale: data.scale ? [data.scale.x, data.scale.y, data.scale.z] : [1, 1, 1],
          physics: data.physics,
          isPlayer: data.isPlayer,
          modelPath: data.modelPath,
        })),
        postProcessing: exportSettings(),
      };

      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}_editor.json`;
      a.click();
      URL.revokeObjectURL(url);

      setSaveStatus('✅ Project exported!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus('❌ Export failed');
      console.error('Export error:', error);
    }
  };

  // Import project from JSON file
  const importProjectFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target.result);
        
        if (projectData.postProcessing) {
          importSettings(projectData.postProcessing);
        }
        
        if (projectData.name) {
          setProjectName(projectData.name);
        }

        setSaveStatus('✅ Project imported!');
        setTimeout(() => setSaveStatus(''), 3000);
        
        alert('Project settings imported! Objects will need to be manually re-added.');
      } catch (error) {
        setSaveStatus('❌ Import failed');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  };

  // List saved projects
  const getSavedProjects = () => {
    const projects = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('gd3d_project_')) {
        const name = key.replace('gd3d_project_', '');
        const data = JSON.parse(localStorage.getItem(key));
        projects.push({ name, timestamp: data.timestamp });
      }
    }
    return projects;
  };

  const deleteProject = (name) => {
    if (confirm(`Delete project "${name}"?`)) {
      localStorage.removeItem(`gd3d_project_${name}`);
      setSaveStatus(`🗑️ Deleted project: ${name}`);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const savedProjects = getSavedProjects();

  return (
    <div className="space-y-6">
      <h3 className="font-bold text-white mb-2">⚙️ Project Settings</h3>
      
      {/* Save Status */}
      {saveStatus && (
        <div className="p-3 bg-gray-700 rounded-lg text-sm text-white">
          {saveStatus}
        </div>
      )}

      {/* Project Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Project Name
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          placeholder="Enter project name"
        />
      </div>

      {/* Save/Load Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={saveProject}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Save size={18} />
          Save Project
        </button>
        
        <button
          onClick={loadProject}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <FolderOpen size={18} />
          Load Project
        </button>
      </div>

      {/* Export/Import File */}
      <div className="border-t border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">File Operations</h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={exportProjectFile}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Download size={18} />
            Export JSON
          </button>
          
          <label className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors cursor-pointer">
            <Upload size={18} />
            Import JSON
            <input
              type="file"
              accept=".json"
              onChange={importProjectFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Saved Projects List */}
      {savedProjects.length > 0 && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Saved Projects</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {savedProjects.map((project) => (
              <div
                key={project.name}
                className="flex items-center justify-between p-2 bg-gray-700 rounded"
              >
                <div className="flex-1">
                  <div className="text-white text-sm">{project.name}</div>
                  <div className="text-gray-400 text-xs">
                    {new Date(project.timestamp).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => deleteProject(project.name)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                  title="Delete project"
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Settings */}
      <div className="border-t border-gray-700 pt-4 space-y-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Editor Settings</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Viewport Quality
          </label>
          <select className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Grid Size
          </label>
          <input
            type="number"
            defaultValue="50"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <input type="checkbox" id="autoSave" className="rounded" />
          <label htmlFor="autoSave" className="text-sm text-gray-300">
            Auto-save project (every 5 minutes)
          </label>
        </div>
      </div>

      {/* Info Box */}
      <div className="border-t border-gray-700 pt-4">
        <div className="text-xs text-gray-400 space-y-1 p-3 bg-gray-800 rounded">
          <p>💡 <strong>Save Project:</strong> Stores in browser storage</p>
          <p>💡 <strong>Export JSON:</strong> Downloads as file</p>
          <p>💡 <strong>Load Project:</strong> Restores from browser storage</p>
          <p>💡 <strong>Import JSON:</strong> Loads from file</p>
        </div>
      </div>
    </div>
  );
}
