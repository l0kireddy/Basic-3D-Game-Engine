import { supabase } from './supabase.js';

export const storage = {
  async uploadAsset(file, path, projectId) {
    const fullPath = `${projectId}/${path}`;
    
    const { data, error } = await supabase.storage
      .from('gd3d-assets')
      .upload(fullPath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    return data;
  },

  async getAssetUrl(path) {
    const { data } = supabase.storage
      .from('gd3d-assets')
      .getPublicUrl(path);
    
    return data.publicUrl;
  },

  async deleteAsset(path) {
    const { error } = await supabase.storage
      .from('gd3d-assets')
      .remove([path]);
    
    if (error) throw error;
  },

  async listAssets(projectId) {
    const { data, error } = await supabase.storage
      .from('gd3d-assets')
      .list(projectId, {
        limit: 100,
        offset: 0
      });
    
    if (error) throw error;
    return data;
  },

  async downloadAsset(path) {
    const { data, error } = await supabase.storage
      .from('gd3d-assets')
      .download(path);
    
    if (error) throw error;
    return data;
  },

  // Helper function to handle file uploads with metadata
  async uploadWithMetadata(file, projectId, metadata = {}) {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const path = `assets/${filename}`;
    
    // Upload file
    const uploadResult = await this.uploadAsset(file, path, projectId);
    
    // Get public URL
    const publicUrl = await this.getAssetUrl(`${projectId}/${path}`);
    
    // Save metadata to database
    const assetData = {
      id: uploadResult.path,
      project_id: projectId,
      filename: file.name,
      original_filename: file.name,
      path: uploadResult.path,
      url: publicUrl,
      size: file.size,
      type: file.type,
      ...metadata
    };
    
    // Save to assets table
    const { data, error } = await supabase
      .from('assets')
      .insert(assetData);
    
    if (error) throw error;
    
    return {
      ...assetData,
      ...data
    };
  }
};