// ─── Image Generator Modal ───
// مودال تولید تصویر صحنه یا پرتره
// مرحله ۱: نمایش پرامپت + انتخاب روش تولید
// مرحله ۲: نمایش تصویر تولید شده

import { useState, useEffect } from 'react';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { ImagePresetManager } from './ImagePresetManager';
import type { ImagePreset, ImageProfile, PollinationsModel, ImageType } from '../types/image';

const PERCHANCE_URL = 'https://perchance.org/ai-text-to-image-generator';

interface ImageGeneratorProps {
  type: ImageType;
  chatId?: string;
  characterId?: string;
  onClose: () => void;
  onGenerated?: (imageUrl: string) => void;
}

type Step = 'configure' | 'context-preview' | 'prompt-ready' | 'generating' | 'result';

export function ImageGenerator({ type, chatId, characterId, onClose, onGenerated }: ImageGeneratorProps) {
  const {
    loading,
    error,
    clearError,
    generateScenePrompt,
    generateSceneImage,
    generatePortrait,
    getProfiles,
    getImageModels,
    checkApiStatus,
    getPresets,
    createPreset,
    getContext,
    generatePromptFromContext,
  } = useImageGeneration();

  const [step, setStep] = useState<Step>('configure');
  const [presets, setPresets] = useState<ImagePreset[]>([]);
  const [profiles, setProfiles] = useState<ImageProfile[]>([]);
  const [models, setModels] = useState<PollinationsModel[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState('flux');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ hasApiKey: boolean; message: string } | null>(null);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [context, setContext] = useState('');
  const [editedContext, setEditedContext] = useState('');
  const [profileInstruction, setProfileInstruction] = useState('');

  useEffect(() => {
    loadProfiles();
    loadModels();
    loadApiStatus();
    loadPresets();
  }, []);

  const loadProfiles = async () => {
    try {
      const data = await getProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  };

  const loadApiStatus = async () => {
    try {
      const status = await checkApiStatus();
      setApiStatus(status);
    } catch (err) {
      console.error('Failed to check API status:', err);
      setApiStatus({ hasApiKey: false, message: 'Could not check API status' });
    }
  };

  const loadPresets = async () => {
    try {
      const data = await getPresets();
      setPresets(data);
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  };

  const handlePresetSelect = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(presetId);
      setSelectedModel(preset.model);
      setWidth(preset.width);
      setHeight(preset.height);
    }
  };

  const handleSaveAsPreset = async () => {
    if (!presetName.trim()) return;

    try {
      // دریافت profileId از پریست انتخاب شده (اگر وجود داشته باشد)
      const selectedPresetObj = presets.find(p => p.id === selectedPreset);
      const profileId = selectedPresetObj?.profileId || 'scene';

      await createPreset({
        name: presetName,
        description: presetDescription,
        profileId: profileId,
        model: selectedModel,
        width,
        height,
      });

      setShowSavePreset(false);
      setPresetName('');
      setPresetDescription('');
      await loadPresets();
    } catch (err) {
      console.error('Failed to save preset:', err);
    }
  };



  const loadModels = async () => {
    try {
      const data = await getImageModels();
      setModels(data);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  // مرحله پیش‌نمایش کانتکست
  const handlePreviewContext = async () => {
    clearError();
    setStep('generating');

    try {
      if (type === 'scene' && chatId) {
        // دریافت profileId و promptTemplate از پریست انتخاب شده
        const selectedPresetObj = presets.find(p => p.id === selectedPreset);
        const profileId = selectedPresetObj?.profileId || 'scene';
        const promptTemplate = selectedPresetObj?.promptTemplate;

        const result = await getContext(chatId, profileId);
        setContext(result.context);
        setEditedContext(result.context);
        // استفاده از promptTemplate اگر وجود داشته باشد، در غیر این صورت profile.instruction
        setProfileInstruction(promptTemplate?.trim() || result.profile.instruction);
        setStep('context-preview');
      } else {
        // برای پرتره، فعلاً از customPrompt استفاده کن
        setGeneratedPrompt(customPrompt || 'Portrait of a character');
        setStep('prompt-ready');
      }
    } catch (err) {
      setStep('configure');
    }
  };

  // مرحله ۱: تولید پرامپت (بدون تولید تصویر)
  const handleGeneratePrompt = async () => {
    clearError();
    setStep('generating');
    
    try {
      if (type === 'scene') {
        // برای صحنه، فقط پرامپت تولید کن (بدون API Key)
        const result = await generateScenePrompt({
          chatId,
          profileId: 'scene', // Default profile
          customPrompt: customPrompt || undefined,
        });
        setGeneratedPrompt(result.imagePrompt);
      } else {
        // برای پرتره، فعلاً از customPrompt استفاده کن
        // TODO: endpoint پرتره جداگانه اضافه شود
        setGeneratedPrompt(customPrompt || 'Portrait of a character');
      }
      setStep('prompt-ready');
    } catch (err) {
      setStep('configure');
      // Error is handled by the hook
    }
  };

  // مرحله تولید پرامپت از کانتکست ادیت شده
  const handleGenerateFromContext = async () => {
    clearError();
    setStep('generating');

    try {
      // دریافت profileId و promptTemplate از پریست انتخاب شده
      const selectedPresetObj = presets.find(p => p.id === selectedPreset);
      const profileId = selectedPresetObj?.profileId || 'scene';
      const promptTemplate = selectedPresetObj?.promptTemplate || undefined;

      // ارسال context ادیت شده به LLM برای تولید پرامپت تصویر
      const imagePrompt = await generatePromptFromContext(editedContext, profileId, promptTemplate);
      setGeneratedPrompt(imagePrompt);
      setStep('prompt-ready');
    } catch (err) {
      setStep('context-preview');
    }
  };

  // مرحله ۲ الف: تولید تصویر با API Pollinations
  const handleGenerateWithAPI = async () => {
    clearError();
    setStep('generating');
    
    try {
      const request = {
        chatId,
        characterId,
        profileId: 'scene', // Default profile
        customPrompt: generatedPrompt, // استفاده از پرامپت تولید شده
        width,
        height,
        model: selectedModel,
      };

      let result;
      if (type === 'scene') {
        result = await generateSceneImage(request);
      } else {
        result = await generatePortrait(request);
      }

      setGeneratedImage(result.imageUrl);
      setStep('result');
      onGenerated?.(result.imageUrl);
    } catch (err) {
      setStep('prompt-ready');
      // Error is handled by the hook
    }
  };

  // مرحله ۲ ب: کپی پرامپت و باز کردن perchance.org
  const handleCopyAndOpenPerchance = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      
      // باز کردن perchance.org در تب جدید
      window.open(PERCHANCE_URL, '_blank');
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // کپی پرامپت
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-tavern-bg border border-tavern-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-tavern-border">
          <h2 className="text-lg font-semibold">
            {type === 'scene' ? '🎨 Generate Scene Image' : '👤 Generate Portrait'}
          </h2>
          <button onClick={onClose} className="text-tavern-dim hover:text-tavern-text">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          
          {/* ─── مرحله ۱: تنظیمات ─── */}
          {step === 'configure' && (
            <>
              {/* Preset Selection */}
              <div className="bg-tavern-bg/50 rounded-lg p-3 border border-tavern-border">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">📋 Quick Preset</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowPresetManager(true)}
                      className="text-xs text-tavern-dim hover:text-tavern-text"
                    >
                      ⚙️ Manage
                    </button>
                    <button
                      onClick={() => setShowSavePreset(true)}
                      className="text-xs text-tavern-accent hover:text-tavern-accent-hover"
                    >
                      + Save Current
                    </button>
                  </div>
                </div>
                <select
                  value={selectedPreset}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  className="w-full bg-tavern-card border border-tavern-border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">-- Select a Preset --</option>
                  {presets.map((p) => {
                    // پیدا کردن نام profile مربوطه
                    const profileName = profiles.find(pro => pro.id === p.profileId)?.name || p.profileId;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({profileName}) {p.isBuiltin ? '' : '⭐'}
                      </option>
                    );
                  })}
                </select>
                {selectedPreset && (
                  <p className="text-xs text-tavern-dim mt-1">
                    {presets.find(p => p.id === selectedPreset)?.description}
                  </p>
                )}
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2"
                >
                  {models.length > 0 ? (
                    models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id}
                      </option>
                    ))
                  ) : (
                    <option value="flux">Flux (Default)</option>
                  )}
                </select>
              </div>

              {/* Dimensions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Width</label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(parseInt(e.target.value) || 1024)}
                    min={256}
                    max={2048}
                    className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Height</label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value) || 1024)}
                    min={256}
                    max={2048}
                    className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="block text-sm font-medium mb-1">Custom Prompt (optional)</label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Leave empty to auto-generate from context..."
                  rows={3}
                  className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 resize-none"
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </>
          )}

          {/* ─── مرحله پیش‌نمایش کانتکست ─── */}
          {step === 'context-preview' && (
            <>
              <div className="bg-tavern-bg/50 rounded-lg p-3 border border-tavern-border">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">📝 Context Preview</label>
                  <button
                    onClick={() => setStep('configure')}
                    className="text-xs text-tavern-dim hover:text-tavern-text"
                  >
                    ← Back
                  </button>
                </div>
                <p className="text-xs text-tavern-dim mb-2">
                  این کانتکستی است که به LLM ارسال خواهد شد. می‌توانید آن را ادیت کنید:
                </p>
                <div className="bg-tavern-input border border-tavern-border rounded-lg p-3 text-sm mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-tavern-accent">
                      {presets.find(pr => pr.id === selectedPreset)?.promptTemplate?.trim() ? '✨ Custom Instruction (from Preset)' : '📋 Profile Instruction:'}
                    </p>
                    <span className="text-[10px] bg-tavern-accent/20 text-tavern-accent px-2 py-0.5 rounded">
                      {profiles.find(p => p.id === (presets.find(pr => pr.id === selectedPreset)?.profileId || 'scene'))?.name || 'Scene'}
                    </span>
                  </div>
                  <p className="text-tavern-text whitespace-pre-wrap text-xs">{profileInstruction}</p>
                </div>
                <textarea
                  value={editedContext}
                  onChange={(e) => setEditedContext(e.target.value)}
                  rows={10}
                  className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* Error Display */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </>
          )}

          {/* ─── مرحله ۲: پرامپت آماده + انتخاب روش ─── */}
          {step === 'prompt-ready' && (
            <>
              {/* Generated Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">✨ Generated Prompt</label>
                  <button
                    onClick={handleCopyPrompt}
                    className="text-xs text-tavern-accent hover:text-tavern-accent-hover"
                  >
                    {copied ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                <div className="bg-tavern-input border border-tavern-border rounded-lg p-3">
                  <p className="text-sm text-tavern-text whitespace-pre-wrap">{generatedPrompt}</p>
                </div>
              </div>

              {/* Prompt Preview - Editable */}
              <div>
                <label className="block text-sm font-medium mb-1">Edit Prompt (optional)</label>
                <textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2 resize-none text-sm"
                />
              </div>

              {/* Choice Section */}
              <div className="border border-tavern-border rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-center mb-3">How would you like to generate the image?</p>
                
                {/* Option 1: API */}
                <button
                  onClick={handleGenerateWithAPI}
                  disabled={!apiStatus?.hasApiKey}
                  className={`w-full p-4 rounded-lg transition-colors text-left ${
                    apiStatus?.hasApiKey 
                      ? 'bg-tavern-accent/10 hover:bg-tavern-accent/20 border border-tavern-accent/30' 
                      : 'bg-gray-500/10 border border-gray-500/30 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🤖</span>
                    <div className="flex-1">
                      <p className={`font-medium ${apiStatus?.hasApiKey ? 'text-tavern-accent' : 'text-gray-400'}`}>
                        Generate with API
                      </p>
                      <p className="text-xs text-tavern-dim">
                        {apiStatus?.hasApiKey 
                          ? 'Pollinations.ai • API key configured • Fast' 
                          : 'Pollinations.ai • No API key configured'}
                      </p>
                    </div>
                    <span className={apiStatus?.hasApiKey ? 'text-tavern-accent' : 'text-gray-400'}>
                      {apiStatus?.hasApiKey ? '→' : '🔒'}
                    </span>
                  </div>
                </button>

                {/* Option 2: Perchance.org */}
                <button
                  onClick={handleCopyAndOpenPerchance}
                  className="w-full p-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🆓</span>
                    <div className="flex-1">
                      <p className="font-medium text-green-400">Use Perchance.org (Free)</p>
                      <p className="text-xs text-tavern-dim">No login required • Copy prompt & open site</p>
                    </div>
                    <span className="text-green-400">↗</span>
                  </div>
                </button>
              </div>

              {/* API Status Info */}
              {!apiStatus?.hasApiKey && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-400">
                  <p className="font-medium mb-1">⚠️ No API Key Configured</p>
                  <p>Add <code className="bg-yellow-500/20 px-1 rounded">POLLINATIONS_API_KEY=sk_xxx</code> to your .env file to use the API option.</p>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs text-blue-400">
                <p className="font-medium mb-1">💡 Tip:</p>
                <p>After generating on Perchance, you can save the image and upload it to your chat.</p>
              </div>
            </>
          )}

          {/* ─── مرحله ۳: در حال تولید ─── */}
          {step === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tavern-accent mb-4"></div>
              <p className="text-tavern-dim">Generating image with API...</p>
            </div>
          )}

          {/* ─── مرحله ۴: نتیجه ─── */}
          {step === 'result' && generatedImage && (
            <>
              <div className="border border-tavern-border rounded-lg overflow-hidden">
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-full h-auto"
                />
              </div>
              
              {/* Back to prompt */}
              <button
                onClick={() => setStep('prompt-ready')}
                className="w-full text-center text-sm text-tavern-accent hover:text-tavern-accent-hover"
              >
                ← Back to prompt options
              </button>
            </>
          )}

          {/* ─── مودال ذخیره پریست ─── */}
          {showSavePreset && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-tavern-bg border border-tavern-border rounded-lg w-full max-w-md p-4">
                <h3 className="text-lg font-semibold mb-4">Save as Preset</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2"
                      placeholder="My Custom Preset"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      value={presetDescription}
                      onChange={(e) => setPresetDescription(e.target.value)}
                      className="w-full bg-tavern-bg border border-tavern-border rounded-lg px-3 py-2"
                      placeholder="Optional description"
                    />
                  </div>
                  
                  <div className="bg-tavern-input rounded-lg p-3 text-sm">
                    <p className="text-tavern-dim">Will save:</p>
                    <ul className="mt-1 space-y-1">
                      <li>• Model: {selectedModel}</li>
                      <li>• Size: {width} x {height}</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowSavePreset(false)}
                    className="flex-1 px-4 py-2 text-tavern-dim hover:text-tavern-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAsPreset}
                    disabled={!presetName.trim()}
                    className="flex-1 px-4 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    Save Preset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── مودال مدیریت پریست‌ها ─── */}
          {showPresetManager && (
            <ImagePresetManager
              onClose={() => setShowPresetManager(false)}
              onSelect={(preset) => {
                handlePresetSelect(preset.id);
                setShowPresetManager(false);
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-tavern-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-tavern-dim hover:text-tavern-text transition-colors"
          >
            Close
          </button>
          
          {step === 'configure' && (
            <button
              onClick={handlePreviewContext}
              className="px-4 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg font-medium"
            >
              Preview Context 👁️
            </button>
          )}

          {step === 'context-preview' && (
            <button
              onClick={handleGenerateFromContext}
              className="px-4 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded-lg font-medium"
            >
              Generate Prompt ✨
            </button>
          )}
          
          {step === 'prompt-ready' && (
            <button
              onClick={() => setStep('configure')}
              className="px-4 py-2 bg-tavern-bg border border-tavern-border hover:bg-tavern-hover rounded-lg font-medium transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
