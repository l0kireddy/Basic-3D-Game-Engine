import React from "react";

export default function AssetBrowser() {
  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-300">Asset Browser</h4>
        <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
          Upload
        </button>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {/* Asset thumbnails would go here */}
        <div className="aspect-square bg-gray-700 rounded p-2 flex items-center justify-center text-xs text-gray-400">
          No Assets
        </div>
      </div>
      
      <div className="mt-4 p-3 border-2 border-dashed border-gray-600 rounded text-center">
        <p className="text-xs text-gray-400">
          Drop GLTF, PNG, or JPEG files here
        </p>
      </div>
    </div>
  );
}