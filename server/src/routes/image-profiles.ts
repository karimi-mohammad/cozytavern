// ─── Image Profiles Routes ───
// مسیرهای API برای مدیریت پروفایل‌های تولید تصویر

import { Router, Request, Response } from 'express';
import { getAllProfiles, getProfile, createProfile, updateProfile, deleteProfile, cloneProfile } from '../utils/image-profiles';

const router = Router();

// GET /api/image-profiles - دریافت تمام پروفایل‌ها
router.get('/', (req: Request, res: Response) => {
  const profiles = getAllProfiles();
  res.json(profiles);
});

// GET /api/image-profiles/:id - دریافت یک پروفایل
router.get('/:id', (req: Request, res: Response) => {
  const profile = getProfile(req.params.id);
  if (!profile) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  res.json(profile);
});

// POST /api/image-profiles - ایجاد پروفایل جدید
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, instruction, negativePrompt, width, height, model } = req.body;
    
    if (!name || !instruction) {
      return res.status(400).json({ error: 'Name and instruction are required' });
    }
    
    const profile = createProfile({
      name,
      instruction,
      negativePrompt,
      width,
      height,
      model,
    });
    
    res.status(201).json(profile);
  } catch (error: any) {
    console.error('Failed to create profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/image-profiles/:id - بروزرسانی پروفایل
router.put('/:id', (req: Request, res: Response) => {
  try {
    const profile = updateProfile(req.params.id, req.body);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found or cannot update built-in' });
    }
    res.json(profile);
  } catch (error: any) {
    console.error('Failed to update profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/image-profiles/:id - حذف پروفایل
router.delete('/:id', (req: Request, res: Response) => {
  const success = deleteProfile(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Profile not found or cannot delete built-in' });
  }
  res.json({ success: true });
});

// POST /api/image-profiles/:id/clone - کلون کردن پروفایل
router.post('/:id/clone', (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const profile = cloneProfile(req.params.id, name);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.status(201).json(profile);
  } catch (error: any) {
    console.error('Failed to clone profile:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
