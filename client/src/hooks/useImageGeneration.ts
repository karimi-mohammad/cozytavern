// ─── Image Generation API Hook ───
// هوک React برای فراخوانی APIهای تولید تصویر

import { useState, useCallback } from 'react';
import type {
  ImageProfile,
  ImagePreset,
  SceneImage,
  CharacterPortrait,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageVariation,
  PollinationsModel,
  ImageContextResult,
} from '../types/image';

const API_BASE = '/api';

export function useImageGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // ─── Scene Image APIs ───

  const generateScenePrompt = useCallback(async (request: ImageGenerationRequest): Promise<{ imagePrompt: string; profileId: string }> => {
    setLoading(true);
    setError(null);
    
    try {
      // تبدیل camelCase به snake_case برای سرور
      const serverRequest = {
        chat_id: request.chatId,
        profile_id: request.profileId,
        custom_prompt: request.customPrompt,
      };
      
      const response = await fetch(`${API_BASE}/scenes/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverRequest),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Generation failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generateSceneImage = useCallback(async (request: ImageGenerationRequest): Promise<ImageGenerationResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // تبدیل camelCase به snake_case برای سرور
      const serverRequest = {
        chat_id: request.chatId,
        character_id: request.characterId,
        profile_id: request.profileId,
        custom_prompt: request.customPrompt,
        width: request.width,
        height: request.height,
        model: request.model,
      };
      
      const response = await fetch(`${API_BASE}/scenes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverRequest),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Generation failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSceneImages = useCallback(async (chatId: string): Promise<SceneImage[]> => {
    const response = await fetch(`${API_BASE}/scenes/${chatId}`);
    if (!response.ok) throw new Error('Failed to fetch scenes');
    return await response.json();
  }, []);

  const getSceneGallery = useCallback(async (chatId: string): Promise<SceneImage[]> => {
    const response = await fetch(`${API_BASE}/scenes/gallery/${chatId}`);
    if (!response.ok) throw new Error('Failed to fetch gallery');
    return await response.json();
  }, []);

  const regenerateScene = useCallback(async (id: string): Promise<ImageGenerationResult> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/scenes/${id}/regenerate`, { method: 'POST' });
      if (!response.ok) throw new Error('Regeneration failed');
      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const getSceneVariations = useCallback(async (id: string, count: number = 4): Promise<ImageVariation[]> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/scenes/${id}/variations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      if (!response.ok) throw new Error('Variations failed');
      const data = await response.json();
      return data.variations;
    } finally {
      setLoading(false);
    }
  }, []);

  const pinScene = useCallback(async (id: string, pinned: boolean): Promise<void> => {
    const response = await fetch(`${API_BASE}/scenes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: pinned }),
    });
    if (!response.ok) throw new Error('Failed to update scene');
  }, []);

  const deleteScene = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/scenes/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete scene');
  }, []);

  // ─── Character Portrait APIs ───

  const generatePortrait = useCallback(async (request: ImageGenerationRequest): Promise<ImageGenerationResult> => {
    setLoading(true);
    setError(null);
    
    try {
      // تبدیل camelCase به snake_case برای سرور
      const serverRequest = {
        chat_id: request.chatId,
        character_id: request.characterId,
        profile_id: request.profileId,
        custom_prompt_append: request.customPrompt,
        width: request.width,
        height: request.height,
        model: request.model,
      };
      
      const response = await fetch(`${API_BASE}/portraits/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serverRequest),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Generation failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCharacterPortraits = useCallback(async (characterId: string): Promise<CharacterPortrait[]> => {
    const response = await fetch(`${API_BASE}/portraits/${characterId}`);
    if (!response.ok) throw new Error('Failed to fetch portraits');
    return await response.json();
  }, []);

  const regeneratePortrait = useCallback(async (id: string): Promise<ImageGenerationResult> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/portraits/${id}/regenerate`, { method: 'POST' });
      if (!response.ok) throw new Error('Regeneration failed');
      return await response.json();
    } finally {
      setLoading(false);
    }
  }, []);

  const getPortraitVariations = useCallback(async (id: string, count: number = 4): Promise<ImageVariation[]> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/portraits/${id}/variations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      if (!response.ok) throw new Error('Variations failed');
      const data = await response.json();
      return data.variations;
    } finally {
      setLoading(false);
    }
  }, []);

  const usePortraitAsAvatar = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/portraits/${id}/use`, { method: 'PUT' });
    if (!response.ok) throw new Error('Failed to set avatar');
  }, []);

  const deletePortrait = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/portraits/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete portrait');
  }, []);

  const batchGeneratePortraits = useCallback(async (
    characterIds: string[],
    options: Partial<ImageGenerationRequest> = {}
  ): Promise<{ characterId: string; success: boolean; error?: string }[]> => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/portraits/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_ids: characterIds, ...options }),
      });
      if (!response.ok) throw new Error('Batch generation failed');
      const data = await response.json();
      return data.results;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Profile & Model APIs ───

  const getProfiles = useCallback(async (): Promise<ImageProfile[]> => {
    const response = await fetch(`${API_BASE}/image-profiles`);
    if (!response.ok) throw new Error('Failed to fetch profiles');
    return await response.json();
  }, []);

  const getImageModels = useCallback(async (): Promise<PollinationsModel[]> => {
    const response = await fetch(`${API_BASE}/scenes/models`);
    if (!response.ok) throw new Error('Failed to fetch models');
    return await response.json();
  }, []);

  const checkApiStatus = useCallback(async (): Promise<{ hasApiKey: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/scenes/status`);
    if (!response.ok) throw new Error('Failed to check API status');
    return await response.json();
  }, []);

  // ─── Context Preview API ───

  const getContext = useCallback(async (chatId: string, profileId: string): Promise<ImageContextResult> => {
    const response = await fetch(`${API_BASE}/scenes/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, profile_id: profileId }),
    });
    if (!response.ok) throw new Error('Failed to get context');
    return await response.json();
  }, []);

  const generatePromptFromContext = useCallback(async (context: string, profileId: string, promptTemplate?: string): Promise<string> => {
    const response = await fetch(`${API_BASE}/scenes/generate-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, profile_id: profileId, prompt_template: promptTemplate }),
    });
    if (!response.ok) throw new Error('Failed to generate prompt from context');
    const data = await response.json();
    return data.imagePrompt;
  }, []);

  // ─── Preset APIs ───

  const getPresets = useCallback(async (): Promise<ImagePreset[]> => {
    const response = await fetch(`${API_BASE}/image-presets`);
    if (!response.ok) throw new Error('Failed to fetch presets');
    const data = await response.json();
    // تبدیل snake_case به camelCase
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      profileId: p.profile_id,
      model: p.model,
      width: p.width,
      height: p.height,
      autoUseLastPrompt: p.auto_use_last_prompt === 1,
      promptTemplate: p.prompt_template,
      negativePrompt: p.negative_prompt,
      isBuiltin: p.isBuiltin,
      createdAt: p.created_at,
    }));
  }, []);

  const createPreset = useCallback(async (preset: Partial<ImagePreset>): Promise<ImagePreset> => {
    const response = await fetch(`${API_BASE}/image-presets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: preset.name,
        description: preset.description,
        profile_id: preset.profileId,
        model: preset.model,
        width: preset.width,
        height: preset.height,
        auto_use_last_prompt: preset.autoUseLastPrompt,
        prompt_template: preset.promptTemplate,
        negative_prompt: preset.negativePrompt,
      }),
    });
    if (!response.ok) throw new Error('Failed to create preset');
    return await response.json();
  }, []);

  const updatePreset = useCallback(async (id: string, preset: Partial<ImagePreset>): Promise<ImagePreset> => {
    const response = await fetch(`${API_BASE}/image-presets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: preset.name,
        description: preset.description,
        profile_id: preset.profileId,
        model: preset.model,
        width: preset.width,
        height: preset.height,
        auto_use_last_prompt: preset.autoUseLastPrompt,
        prompt_template: preset.promptTemplate,
        negative_prompt: preset.negativePrompt,
      }),
    });
    if (!response.ok) throw new Error('Failed to update preset');
    return await response.json();
  }, []);

  const deletePreset = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/image-presets/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete preset');
  }, []);

  const clonePreset = useCallback(async (id: string, name?: string): Promise<ImagePreset> => {
    const response = await fetch(`${API_BASE}/image-presets/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to clone preset');
    return await response.json();
  }, []);

  return {
    loading,
    error,
    clearError,
    // Scene APIs
    generateScenePrompt,
    generateSceneImage,
    getSceneImages,
    getSceneGallery,
    regenerateScene,
    getSceneVariations,
    pinScene,
    deleteScene,
    // Portrait APIs
    generatePortrait,
    getCharacterPortraits,
    regeneratePortrait,
    getPortraitVariations,
    usePortraitAsAvatar,
    deletePortrait,
    batchGeneratePortraits,
    // Profile & Model APIs
    getProfiles,
    getImageModels,
    checkApiStatus,
    // Context Preview API
    getContext,
    generatePromptFromContext,
    // Preset APIs
    getPresets,
    createPreset,
    updatePreset,
    deletePreset,
    clonePreset,
  };
}
