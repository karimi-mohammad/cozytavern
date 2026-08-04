claude# CozyTavern

یک چت‌بات فرانت‌اند سبک مشابه SillyTavern با پشتیبانی از API سازگار با OpenAI و endpoint سفارشی.

## Tech Stack

- **فرانت**: React 18 + Vite + Tailwind CSS + TypeScript
- **بکند**: Express.js + better-sqlite3 + TypeScript
- **State Management**: Zustand
- **Storage**: SQLite (فایلی)

## ساختار پروژه

```
CozyTavern/
├── server/                  # Express backend
│   ├── src/
│   │   ├── index.ts         # Entry point + /api/chat endpoint
│   │   ├── db.ts            # SQLite connection + migrations
│   │   ├── routes/          # Express routers
│   │   └── utils/           # providers.ts, prompt-builder.ts
│   └── data/                # SQLite database file
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── api/client.ts    # API client functions
│   │   ├── store/state.ts   # Zustand global state
│   │   ├── components/      # React components
│   │   └── types/index.ts   # TypeScript interfaces
│   └── vite.config.ts       # Dev proxy to server
├── package.json             # Root scripts (concurrently)
└── CLAUDE.md
```

## اجرا

```bash
npm run dev              # اجرای همزمان سرور + کلاینت
npm run dev:server       # فقط سرور (port 3002)
npm run dev:client       # فقط کلاینت (port 5173)
npm run build            # build فرانت برای production
```

## تست‌نویسی

### اجرای تست‌ها

```bash
cd server
npm test                 # اجرای یکباره همه تست‌ها
npm run test:watch       # اجرای مداوم (watch mode)
```

### ساختار تست‌ها

```
server/src/__tests__/
├── providers.test.ts       # تست utility functions (17 تست)
├── prompt-builder.test.ts  # تست ساخت prompt و لوربوک (14 تست)
├── characters.test.ts      # تست API کاراکتر (7 تست)
├── lorebooks.test.ts       # تست API لوربوک (7 تست)
├── personas.test.ts        # تست API پرسونا (4 تست)
├── api-settings.test.ts    # تست API تنظیمات (4 تست)
└── setup.ts                # راه‌اندازی دیتابیس تست
```

### نکات تست

- از **vitest** به عنوان test runner استفاده می‌شود
- دیتابیس تست در `server/data/test.db` ذخیره می‌شود و بعد از تست‌ها حذف می‌شود
- هر فایل تست یک دیتابیس تمیز دارد
- Mock کردن دیتابیس با `vi.mock('../db')` انجام می‌شود

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

### POST /api/chat

بادی:
```json
{
  "chat_id": "...",
  "character_id": "...",
  "persona_id": "...",      // اختیاری
  "lorebook_id": "...",      // اختیاری
  "update_message_id": "..." // اختیاری - برای regenerate
}
```

SEvents:
- اولین event: `{ "message_id": "..." }` - ID پیام ساخته شده
- eventهای بعدی: `{ "token": "..." }` - توکن‌های streaming
- آخرین event: `[DONE]`

اگر `update_message_id` فرستاده بشه، پیام جدید ساخته نمیشه و پیام قبلی آپدیت می‌شه.

## دیتابیس SQLite

جداول: `characters`, `chats`, `messages`, `personas`, `lorebooks`, `lorebook_entries`, `api_settings`

## Provider های AI

فرمت ارتباطی: **OpenAI-compatible** (فرمت `/v1/chat/completions`)

پشتیبانی از هر سرویسی که فرمت OpenAI رو رعایت کنه:
- **OpenAI**: GPT-4, GPT-4o, GPT-3.5-turbo
- **Ollama**: مدل‌های محلی (llama3, mistral, etc.)
- **LM Studio**, **text-generation-webui**, **FreeLLMAPI** و هر سرویس سازگار دیگر

## نکات فنی

- سرور روی پورت 3002 اجرا می‌شه (پورت 3001 اشغاله)
- Vite proxy درخواست‌های `/api` رو به سرور فوروارد می‌کنه
- Streaming پاسخ‌ها از طریق SSE (Server-Sent Events)
- لوربوک بر اساس کلمات کلیدی در پیام‌های اخیر فعال می‌شه
- ماکروها: `{{char}}` = نام کاراکتر، `{{user}}` = نام پرسونا
- دیتابیس در `server/data/cozytavern.db` ذخیره می‌شه
- Endpoint سفارشی: اگر خالی باشه از `api.openai.com` استفاده می‌شه
- اگر فقط host وارد بشه (مثلاً `http://localhost:1234`)، مسیر `/v1/chat/completions` خودکار اضافه می‌شه

## قابلیت‌های چت

- **ارسال پیام**: پیام کاربر ذخیره می‌شه، سرور به AI وصل می‌شه و پاسخ رو streaming می‌فرسته
- **ادیت پیام**: هم پیام کاربر و هم پیام AI قابل ادیته. ادیت باعث حذف پیام‌های بعدی می‌شه
- **Regenerate**: نسخه قبلی پاسخ در swipes ذخیره می‌شه و پاسخ جدید جایگزین می‌شه
- **Swipe**: جابجایی بین پاسخ‌های ذخیره شده در swipes بدون فراخوانی مجدد API
- **Branch**: فورک کردن مکالمه از یک نقطه خاص (ایجاد چت جدید با تاریخچه مشترک)

## فرمت کاراکتر

```json
{
  "name": "نام",
  "description": "توضیحات",
  "personality": "صفات",
  "scenario": "سناریو",
  "first_mes": "اولین پیام",
  "mes_example": "مثال‌های دیالوگ",
  "tags": ["برچسب‌ها"]
}
```

## راهنمای تست‌نویسی برای Claude

### نحوه اجرای تست‌ها

```bash
# اجرای همه تست‌ها
cd server && npm test

# اجرای یک فایل تست خاص
cd server && npx vitest run src/__tests__/providers.test.ts

# اجرای تست با کلمه کلیدی
cd server && npx vitest run -t "buildEndpoint"

# اجرای مداوم (برای development)
cd server && npm run test:watch
```

### ساختار فایل تست

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
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

### نکات مهم تست‌نویسی

1. **هر تست باید مستقل باشه** - از `beforeEach` برای پاک کردن دیتابیس استفاده کنید
2. **از testDb مستقیم استفاده کنید** - برای دسترسی به دیتابیس تست از `testDb` استفاده کنید
3. **Mock کردن دیتابیس** - در `global-setup.ts` با `vi.mock('../db')` دیتابیس mock می‌شود
4. **تست API ها** - از `supertest` برای تست endpoint ها استفاده کنید
5. **تست utility functions** - مستقیم توابع رو تست کنید نیازی به mock نیست
