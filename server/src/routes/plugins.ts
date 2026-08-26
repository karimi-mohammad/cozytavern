import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import {
  getPluginSettings,
  updatePluginSettings,
  PluginSettingsError,
  PLUGIN_REGISTRY,
} from '../utils/plugin-store';

const router = Router();

// ─── GET /:pluginId/settings ───

router.get('/:pluginId/settings', (req: Request, res: Response) => {
  const db = getDb();
  const settings = getPluginSettings(db, req.params.pluginId);
  if (!settings) {
    res.status(404).json({ error: 'Plugin not found' });
    return;
  }
  res.json(settings);
});

// ─── PUT /:pluginId/settings ───

router.put('/:pluginId/settings', (req: Request, res: Response) => {
  if (!PLUGIN_REGISTRY[req.params.pluginId]) {
    res.status(404).json({ error: 'Plugin not found' });
    return;
  }
  const db = getDb();
  try {
    const settings = updatePluginSettings(db, req.params.pluginId, req.body ?? {});
    res.json(settings);
  } catch (err: any) {
    if (err instanceof PluginSettingsError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Plugin settings update failed:', err);
    res.status(500).json({ error: 'Error saving plugin settings' });
  }
});

export default router;
