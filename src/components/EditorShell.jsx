import React, { useState } from "react";
import SceneViewport from "./SceneViewport";
import HierarchyPanel from "./HierarchyPanel";
import Inspector from "./Inspector";
import PhysicsInspector from "./PhysicsInspector";
import PhysicsControls from "./PhysicsControls";
import PhysicsDebugger from "./PhysicsDebugger";
import AdvancedCharacterController from "./AdvancedCharacterController";
import WireframeDebugger from "./WireframeDebugger";
import PhysicsWireframeDebugger from "./PhysicsWireframeDebugger";
import { AudioControls } from "./AudioControls";
import { SettingsPanel } from "./SettingsPanel";
import { usePlayStore } from "../store/playStore";

export default function EditorShell() {
  const { isPlaying, isPaused, play, pause, stop, resume } = usePlayStore();
  const [leftTab, setLeftTab] = useState('hierarchy');
  const [rightTab, setRightTab] = useState('inspector');

  const handlePlay = () => {
    if (isPaused) {
      resume();
    } else {
      play();
    }
  };

  const handlePause = () => {
    pause();
  };

  const handleStop = () => {
    stop();
  };

  const TabButton = ({ isActive, onClick, children }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-sm font-medium rounded-t-md ${
        isActive 
          ? 'bg-gray-700 text-white border-b-2 border-blue-500' 
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Panel - Tabbed Interface */}
      <div className="w-80 border-r border-gray-700 bg-gray-800 flex flex-col">
        {/* Tab Headers */}
        <div className="flex bg-gray-900 border-b border-gray-700">
          <TabButton 
            isActive={leftTab === 'hierarchy'} 
            onClick={() => setLeftTab('hierarchy')}
          >
            Hierarchy
          </TabButton>
          <TabButton 
            isActive={leftTab === 'audio'} 
            onClick={() => setLeftTab('audio')}
          >
            Audio
          </TabButton>
          <TabButton 
            isActive={leftTab === 'physics'} 
            onClick={() => setLeftTab('physics')}
          >
            Physics
          </TabButton>
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {leftTab === 'hierarchy' && (
            <div>
              <h3 className="font-bold text-white mb-2">Scene Hierarchy</h3>
              <HierarchyPanel />
            </div>
          )}
          {leftTab === 'audio' && (
            <div>
              <h3 className="font-bold text-white mb-2">Audio Controls</h3>
              <AudioControls />
            </div>
          )}
          {leftTab === 'physics' && (
            <div>
              <h3 className="font-bold text-white mb-2">Physics</h3>
              <PhysicsInspector />
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Debugger</h4>
                <PhysicsDebugger />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Panel - Scene Viewport */}
      <div className="flex-1 bg-gray-900 flex flex-col">
        {/* Top Toolbar */}
        <div className="flex items-center justify-between p-2 bg-gray-800 text-white border-b border-gray-700 flex-shrink-0">
          <div className="font-semibold">Basic 3D Game Engine</div>
          <div className="flex gap-2">
            <button 
              onClick={handlePlay}
              className={`px-3 py-1 rounded text-sm font-medium ${
                isPlaying && !isPaused 
                  ? 'bg-green-700 text-green-100' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isPaused ? 'Resume' : 'Play'}
            </button>
            <button 
              onClick={handlePause}
              disabled={!isPlaying}
              className={`px-3 py-1 rounded text-sm font-medium ${
                !isPlaying 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : isPaused 
                    ? 'bg-yellow-700 text-yellow-100'
                    : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              Pause
            </button>
            <button 
              onClick={handleStop}
              disabled={!isPlaying}
              className={`px-3 py-1 rounded text-sm font-medium ${
                !isPlaying 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Stop
            </button>
            
            {/* Play Mode Indicator */}
            {isPlaying && (
              <div className="flex items-center px-2 py-1 bg-orange-600 rounded text-sm">
                🎮 Play Mode
              </div>
            )}
          </div>
        </div>
        
        {/* Main Viewport - Takes remaining space */}
        <div className="flex-1 overflow-hidden">
          <SceneViewport />
        </div>
        
        {/* Physics Controls - Pinned at bottom */}
        <div className="flex-shrink-0">
          <PhysicsControls />
        </div>
      </div>

      {/* Right Panel - Tabbed Interface */}
      <div className="w-96 border-l border-gray-700 bg-gray-800 flex flex-col">
        {/* Tab Headers */}
        <div className="flex bg-gray-900 border-b border-gray-700">
          <TabButton 
            isActive={rightTab === 'inspector'} 
            onClick={() => setRightTab('inspector')}
          >
            Inspector
          </TabButton>
          <TabButton 
            isActive={rightTab === 'settings'} 
            onClick={() => setRightTab('settings')}
          >
            Settings
          </TabButton>
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {rightTab === 'inspector' && (
            <div>
              <h3 className="font-bold text-white mb-2">Object Inspector</h3>
              {isPlaying ? (
                <div className="bg-orange-900 border border-orange-500 rounded p-3 text-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <span>🎮</span>
                    <span className="font-semibold">Play Mode Active</span>
                  </div>
                  <p className="text-sm">Object editing is disabled during play mode. Stop the game to edit objects.</p>
                </div>
              ) : (
                <Inspector />
              )}
            </div>
          )}
          {rightTab === 'settings' && (
            <div className="p-4">
              <SettingsPanel />
            </div>
          )}
        </div>
      </div>
      
      {/* Advanced Character Controller - Hybrid physics + manual control */}
  <AdvancedCharacterController />
  <WireframeDebugger />
  <PhysicsWireframeDebugger />
    </div>
  );
}