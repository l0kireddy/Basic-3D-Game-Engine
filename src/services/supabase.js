import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database functions
export const db = {
  // Projects
  async saveProject(projectData) {
    const { data, error } = await supabase
      .from('projects')
      .upsert({
        id: projectData.project.id,
        name: projectData.project.name,
        manifest_json: projectData,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    return data;
  },

  async loadProject(projectId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    
    if (error) throw error;
    return data.manifest_json;
  },

  async listProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async deleteProject(projectId) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);
    
    if (error) throw error;
  },

  // Assets
  async saveAsset(assetData) {
    const { data, error } = await supabase
      .from('assets')
      .upsert(assetData);
    
    if (error) throw error;
    return data;
  },

  async listAssets(projectId) {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('project_id', projectId);
    
    if (error) throw error;
    return data;
  }
};