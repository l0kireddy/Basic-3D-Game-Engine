import React, { useState } from "react";

export default function EventSheetEditor() {
  const [events, setEvents] = useState([
    {
      id: 1,
      condition: "On Start",
      action: "Set Player Position",
      parameters: { x: 0, y: 1, z: 0 }
    },
    {
      id: 2,
      condition: "On Key Pressed (Space)",
      action: "Apply Force",
      parameters: { force: { x: 0, y: 10, z: 0 } }
    }
  ]);

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-300">Event Sheet</h4>
        <button className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs">
          Add Event
        </button>
      </div>
      
      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="bg-gray-700 rounded p-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Condition</label>
                <select className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1">
                  <option>On Start</option>
                  <option>On Update</option>
                  <option>On Key Pressed</option>
                  <option>On Collision Enter</option>
                  <option>On Timer</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Action</label>
                <select className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1">
                  <option>Set Position</option>
                  <option>Apply Force</option>
                  <option>Set Velocity</option>
                  <option>Play Animation</option>
                  <option>Play Sound</option>
                  <option>Load Scene</option>
                </select>
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-gray-400 mb-1 text-xs">Parameters</label>
              <textarea 
                className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs h-16"
                placeholder="Enter parameters as JSON..."
                defaultValue={JSON.stringify(event.parameters, null, 2)}
              />
            </div>
            <div className="flex justify-end mt-2">
              <button className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {events.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          No events yet. Click "Add Event" to create your first event.
        </div>
      )}
    </div>
  );
}