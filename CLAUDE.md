# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

یک چت‌بات فرانت‌اند سبک مشابه SillyTavern با پشتیبانی از API سازگار با OpenAI و endpoint سفارشی.

## Tech Stack

- **فرانت**: React 18 + Vite + Tailwind CSS + TypeScript
- **بکند**: Express.js + better-sqlite3 + TypeScript
- **State Management**: Zustand
- **Storage**: SQLite (فایلی)
- **تست**: Vitest + supertest

## اجرا

```bash
npm run dev              # اجرای همزمان سرور + کلاینت
npm run dev:server       # فقط سرور (port 3002)
npm run dev:client       # فقط کلاینت (port 5173)
npm run build            # build فرانت برای production
```

## تست‌نویسی

```bash
cd server
npm test                 # اجرای یکباره همه تست‌ها
npm run test:watch       # اجرای مداوم (watch mode)
npx vitest run src/__tests__/providers.test.ts   # یک فایل خاص
npx vitest run -t "buildEndpoint"                # با کلمه کلیدی
```

**نکات تست:**
- Vitest با `globals: true` — نیازی به import کردن `describe`/`it`/`expect` نیست
- اجرای تست‌ها sequential (غیرهمزمان) با timeout 10 ثانیه
- سه فایل setup جداگانه برای دیتابیس تست: `global-setup.ts`, `chat-setup.ts`, `mc-setup.ts`
- Mock کردن دیتابیس با `vi.mock('../db')` — testDb از setup import می‌شه
- Chat tests از `vi.stubGlobal('fetch', ...)` برای mock کردن LLM API استفاده می‌کنن

## معماری

### ساختار سرور

- **Entry point**: `server/src/index.ts` → `app.ts` (Express app + مسیرها)
- **Database**: `server/src/db.ts` — singleton pattern با `getDb()`، WAL journal mode، foreign keys
- **Migrations**: Runtime migrations با PRAGMA table_info — ستون‌های جدید خودکار اضافه می‌شن
- **Routes**: `server/src/routes/` — characters, chats, messages, api-settings, personas, lorebooks
- **Utils**: `providers.ts` (ساخت درخواست LLM) + `prompt-builder.ts` (ساخت prompt + لوربوک)

### معماری کلاینت

- **Store**: `client/src/store/state.ts` — Zustand store با optimistic updates + rollback در صورت خطا
- **API Client**: `client/src/api/client.ts` — wrapper ساده روی `fetch` + `chatWithAI()` برای SSE streaming
- **Layout**: `IconBar` (نوار آیکون چپ) + `ChatView` (مرکز) + `Sidebar` (پنل چپ overlay) + `RightPanel` (پنل راست)
- **Error Isolation**: هر modal در `ErrorBoundary` جداگانه wrapping شده — crash یک modal کل app رو خراب نمی‌کنه
- **Themes**: سه تم (`dark`, `darker`, `light`) با CSS custom properties در `index.css` — رنگ‌های `tavern-*` از CSS vars

### سیستم Streaming

- سرور `AbortController` هر stream رو در `Map<string, AbortController>` ذخیره می‌کنه
- کلاینت از `ReadableStream` + line buffer parser برای خواندن SSE استفاده می‌کنه
- Abort هم از `/api/chat/abort` و هم از `AbortController.abort()` کلاینت پشتیبانی می‌شه

### ساخت Prompt (ترتیب)

System prompt → اطلاعات کاراکتر → مثال‌های دیالوگ → لوربوک فعال‌شده → اطلاعات پرسونا → تاریخچه چت

ماکروها: `{{char}}` = نام کاراکتر، `{{user}}` = نام پرسونا

### لوربوک / WorldInfo

- قبل از هر درخواست AI، لوربوک entryها با پیام‌های اخیر (بر اساس `scan_depth`) چک می‌شن
- Entryهای `constant` همیشه فعالن
- Entryهای `selective` نیاز به match هر دو key اصلی و فرعی دارن
- اولویت‌بندی بر اساس `insertion_order`

### قابلیت‌های چت

- **ادیت پیام**: ادیت باعث حذف پیام‌های بعدی می‌شه (چون context AI تغییر می‌کنه)
- **Regenerate**: نسخه قبلی در `swipes` (JSON array) ذخیره می‌شه، پاسخ جدید جایگزین می‌شه
- **Swipe**: جابجایی بین پاسخ‌ها بدون فراخوانی مجدد API
- **Branch**: فورک کردن مکالمه — چت جدید با تاریخچه مشترک تا یک نقطه خاص

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/characters` | لیست / ایجاد کاراکتر |
| GET/PUT/DELETE | `/api/characters/:id` | عملیات روی کاراکتر |
| GET | `/api/chats/character/:charId` | چت‌های یک کاراکتر |
| GET/POST/PUT/DELETE | `/api/chats/:id` | عملیات روی چت |
| POST | `/api/messages` | ارسال پیام (user) |
| PUT | `/api/messages/:id` | ادیت پیام (user یا assistant) |
| POST | `/api/messages/regenerate/:chatId` | ذخیره نسخه قبلی در swipes |
| POST | `/api/messages/swipe/:id` | جابجایی بین پاسخ‌ها |
| GET/POST | `/api/api-settings` | تنظیمات endpoint/API key/مدل |
| CRUD | `/api/personas` | مدیریت پرسونا |
| CRUD | `/api/lorebooks` | مدیریت لوربوک |
| POST | `/api/chat` | ارسال پیام به AI (streaming) |
| POST | `/api/chat/abort` | متوقف کردن stream فعال |

### POST /api/chat

```json
{
  "chat_id": "...",
  "character_id": "...",
  "persona_id": "...",      // اختیاری
  "lorebook_id": "...",      // اختیاری
  "update_message_id": "..." // اختیاری - برای regenerate
}
```

SSE Events: `{ "message_id": "..." }` → `{ "token": "..." }` → `[DONE]`

## دیتابیس SQLite

جداول: `characters`, `chats`, `messages`, `personas`, `lorebooks`, `lorebook_entries`, `api_settings`

API key و تنظیمات در SQLite ذخیره می‌شن (نه در env vars).

## Provider های AI

فرمت: **OpenAI-compatible** (`/v1/chat/completions`)

Endpoint سفارشی: اگر خالی باشه از `api.openai.com` استفاده می‌شه. اگر فقط host وارد بشه، مسیر `/v1/chat/completions` خودکار اضافه می‌شه.

## فرمت کاراکتر (Character Card V3)

```json
{
  "spec": "chara_card_v3",
  "spec_version": "3.0",
  "data": {
    "name": "نام",
    "nickname": "نام مستعار",
    "description": "توضیحات",
    "personality": "صفات",
    "scenario": "سناریو",
    "first_mes": "اولین پیام",
    "mes_example": "مثال‌های دیالوگ",
    "alternate_greetings": ["پیام جایگزین"],
    "group_only_greetings": ["پیام گروهی"],
    "system_prompt": "پرامپت سیستم کاراکتر",
    "post_history_instructions": "دستورات بعد از تاریخچه",
    "creator_notes": "یادداشت سازنده",
    "tags": ["برچسب‌ها"],
    "creator": "نام سازنده",
    "character_version": "1.0"
  }
}
```

## راهنمای تست‌نویسی

### ساختار فایل تست

```typescript
import { testDb } from './global-setup';
import request from 'supertest';
import app from '../app';

describe('نام API', () => {
  beforeEach(() => {
    testDb.exec('DELETE FROM نام جدول');
  });

  it('باید عملیات رو انجام بده', async () => {
    const res = await request(app)
      .post('/api/endpoint')
      .send({ data: 'test' })
      .expect(200);
    expect(res.body.field).toBe('expected value');
  });
});
```

**نکات:**
- هر تست باید مستقل باشه — از `beforeEach` برای پاک کردن دیتابیس استفاده کنید
- از testDb مستقیم برای دسترسی به دیتابیس تست استفاده کنید
- Chat tests نیاز به mock کردن `fetch` با `vi.stubGlobal` دارن
- Utility functions رو مستقیم تست کنید — نیازی به mock نیست

## ابزارها

- `.claude/launch.json`: دو config برای preview — `cozytavern-server` (port 3002) و `cozytavern-client` (port 5173)
