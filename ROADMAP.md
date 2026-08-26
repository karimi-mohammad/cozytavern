# 🗺️ نقشه راه توسعه CozyTavern

> مقایسه جامع با SillyTavern و لیست قابلیت‌های قابل توسعه
> تاریخ ایجاد: ۱۴۰۵/۰۶/۰۱

---

## 📊 وضعیت فعلی

### ✅ قابلیت‌های موجود
| دسته | جزئیات |
|------|--------|
| **چت** | ارسال پیام، Streaming، ادیت، Regenerate، Swipe، Branch، حذف پیام |
| **کاراکتر** | ساخت/ویرایش، آواتار، تگ‌ها، جستجو، گالری |
| **UI/UX** | 3 تم (dark/darker/light)، Sidebar، RightPanel، مودال‌ها، انیمیشن‌ها، Skeleton Loading |
| **API** | OpenAI-compatible، Custom Endpoint، Abort Stream |
| **پیشرفته** | Lorebook، Persona، System Prompt، Macro replacement |
| **تست** | Vitest + 8 فایل تست |

---

## 🔴 فاز ۱: اولویت بالا (هفته اول)

### 1. ادامه پاسخ (Continue) ✅ انجام شده
- **توضیح:** دکمه یا کلید میانبر (Alt+Enter) برای ادامه تولید از آخرین نقطه
- **فایل‌ها:** `MessageInput.tsx`، `store/state.ts`، `app.ts`
- **سختی:** 🟢 آسان
- **SillyTavern:** ✅ موجود

### 2. Quick Reply (پاسخ سریع)
- **توضیح:** دکمه‌های قابل تنظیم برای ارسال پاسخ‌های از پیش تعریف شده
- **فایل‌ها:** کامپوننت جدید `QuickReply.tsx`، `store/state.ts`، `db.ts`
- **سختی:** 🟢 آسان
- **تخمین زمان:** ۲ روز
- **SillyTavern:** ✅ موجود

### 3. نمایش Reasoning (تفکر مدل) ✅ انجام شده
- **توضیح:** نمایش block‌های فکری مدل‌هایی مثل DeepSeek R1, O1 به صورت collapsible
- **فایل‌ها:** `MessageBubble.tsx`، `index.css`
- **سختی:** 🟢 آسان
- **SillyTavern:** ✅ موجود

### 4. Author's Note
- **توضیح:** تزریق دستورات سفارشی در position و frequency قابل تنظیم
- **فایل‌ها:** `utils/prompt-builder.ts`، UI جدید
- **سختی:** 🟢 آسان
- **تخمین زمان:** ۱ روز
- **SillyTavern:** ✅ موجود

---

## 🟡 فاز ۲: اولویت متوسط (هفته دوم و سوم)

### 5. پشتیبانی چند ارائه‌دهنده (Multi-Provider)
- **توضیح:** اضافه کردن Anthropic, Google Gemini, Ollama, OpenRouter, Mistral, DeepSeek
- **فایل‌ها:** `utils/providers.ts`، `ChatSettings.tsx`، `db.ts`
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۱ هفته
- **SillyTavern:** ✅ 20+ ارائه‌دهنده

### 6. Instruct Mode
- **توضیح:** فرمت‌بندی prompt برای مدل‌های مختلف (Alpaca, ChatML, Llama, Mistral, Vicuna)
- **فایل‌ها:** فایل جدید `utils/instruct-templates.ts`، `prompt-builder.ts`
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۱ هفته
- **SillyTavern:** ✅ 15+ قالب

### 7. Regex Scripts
- **توضیح:** تبدیل متن با regex در مراحل مختلف (قبل/بعد از AI، روی ورودی کاربر)
- **فایل‌ها:** فایل جدید `utils/regex.ts`، UI مدیریت regex
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۳ روز
- **SillyTavern:** ✅ موجود

### 8. نمایش Context Window ✅ انجام شده
- **توضیح:** نمایش بصری مصرف context و شمارش توکن واقعی
- **فایل‌ها:** `utils/tokenEstimate.ts` (جدید)، `TopBar.tsx`، `store/state.ts`
- **سختی:** 🟡 متوسط
- **SillyTavern:** ✅ موجود

### 9. ترجمه خودکار (Translation)
- **توضیح:** ترجمه پیام‌ها با Google, DeepL, LibreTranslate
- **فایل‌ها:** فایل جدید `utils/translation.ts`، کامپوننت UI
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۳ روز
- **SillyTavern:** ✅ 8 سرویس ترجمه

### 10. تبدیل صدا به متن (Speech Recognition)
- **توضیح:** استفاده از Web Speech API برای ارسال پیام صوتی
- **فایل‌ها:** `MessageInput.tsx`، کامپوننت جدید
- **سختی:** 🟢 آسان
- **تخمین زمان:** ۲ روز
- **SillyTavern:** ✅ موجود

### 11. عبارات کاراکتر (Character Expressions / Sprites)
- **توضیح:** تصاویر احساسات کاراکتر کنار چت، حالت Visual Novel
- **فایل‌ها:** کامپوننت جدید `CharacterSprite.tsx`، سیستم تشخیص احساس
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۱ هفته
- **SillyTavern:** ✅ موجود

### 12. چت Multimodal
- **توضیح:** ارسال تصویر/ویدیو/صوت مستقیم در چت
- **فایل‌ها:** `MessageInput.tsx`، `api/client.ts`، `MessageBubble.tsx`
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۳ روز
- **SillyTavern:** ✅ موجود

### 13. Depth Prompts
- **توضیح:** تزریق prompt در عمق خاصی از تاریخچه چت
- **فایل‌ها:** `utils/prompt-builder.ts`
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۲ روز
- **SillyTavern:** ✅ موجود

### 14. Chat Summarization
- **توضیح:** خلاصه‌سازی خودکار چت‌های طولانی برای حافظه بلندمدت
- **فایل‌ها:** فایل جدید `utils/summarization.ts`، `db.ts`
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۱ هفته
- **SillyTavern:** ✅ موجود

---

## 🟢 فاز ۳: اولویت پایین (بلندمدت)

### 15. Group Chat
- **توضیح:** چت با چند کاراکتر همزمان با استراتژی‌های مختلف
- **فایل‌ها:** تغییرات گسترده در `chats.ts`، کامپوننت‌های جدید
- **سختی:** 🔴 سخت
- **تخمین زمان:** ۲ هفته
- **SillyTavern:** ✅ 4 استراتژی فعال‌سازی

### 16. تولید تصویر (Image Generation)
- **توضیح:** اتصال به Stable Diffusion, DALL-E, ComfyUI
- **فایل‌ها:** فایل‌های جدید زیاد، اتصال به API خارجی
- **سختی:** 🔴 سخت
- **تخمین زمان:** ۱ هفته
- **SillyTavern:** ✅ 20+ ارائه‌دهنده

### 17. Text-to-Speech (TTS)
- **توضیح:** تبدیل متن به صدا با 15+ ارائه‌دهنده، صداهای اختصاصی کاراکتر
- **فایل‌ها:** فایل‌های جدید، UI مدیریت صدا
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۱ هفته
- **SillyTavern:** ✅ 15+ ارائه‌دهنده

### 18. Vector Storage / RAG
- **توضیح:** ذخیره اسناد و بازیابی هوشمند اطلاعات با embeddings
- **فایل‌ها:** فایل‌های جدید زیاد، وابستگی به embedding provider
- **سختی:** 🔴 سخت
- **تخمین زمان:** ۲ هفته
- **SillyTavern:** ✅ 15+ ارائه‌دهنده embedding

### 19. STscript
- **توضیح:** زبان اسکریپت‌نویسی کامل با closures, piped execution, variables
- **فایل‌ها:** فایل‌های جدید زیاد (parser, interpreter, runtime)
- **سختی:** 🔴 سخت
- **تخمین زمان:** ۳ هفته
- **SillyTavern:** ✅ موجود

### 20. فرمت‌های Import/Export
- **توضیح:** وارد/خروج کاراکتر از PNG, JSON, CharX, BYAF, YAML
- **فایل‌ها:** فایل‌های جدید برای هر فرمت
- **سختی:** 🟡 متوسط
- **تخمین زمان:** ۳ روز
- **SillyTavern:** ✅ 5 فرمت

---

## 🛠️ قابلیت‌های کوچکتر

| # | قابلیت | سختی | توضیح |
|---|--------|------|-------|
| 21 | **Notebook** | 🟢 آسان | فضای جداگانه برای یادداشت‌ها |
| 22 | **Timelines** | 🟡 متوسط | ناوبری خط زمانی چت |
| 23 | **Push Notifications** | 🟢 آسان | اعلان مرورگر برای پیام جدید |
| 24 | **Background Images** | 🟢 آسان | تصاویر پس‌زمینه سفارشی |
| 25 | **Custom CSS** | 🟢 آسان | تزریق CSS توسط کاربر |
| 26 | **Community Themes** | 🟢 آسان | تم‌های آماده جامعه |
| 27 | **Bookmarks** | 🟡 متوسط | ذخیره وضعیت مکالمه |
| 28 | **Impersonate** ✅ | 🟢 آسان | AI به جای کاربر بنویسد |
| 29 | **System Narrator** | 🟢 آسان | پیام خنثی سیستم |
| 30 | **Pin Messages** | 🟢 آسان | سنجاق پیام‌ها |
| 31 | **Extension System** | 🔴 سخت | سیستم افزونه‌ها |
| 32 | **Live2D/VRM** | 🔴 سخت | مدل‌های 3D کاراکتر |

---

## 📈 آمار کلی

| دسته | تعداد | آسان | متوسط | سخت |
|------|-------|------|-------|-----|
| **فاز ۱** | ۴ | ۴ | ۰ | ۰ |
| **فاز ۲** | ۱۰ | ۲ | ۸ | ۰ |
| **فاز ۳** | ۶ | ۰ | ۲ | ۴ |
| **کوچکتر** | ۱۲ | ۷ | ۳ | ۲ |
| **مجموع** | **۳۲** | **۱۳** | **۱۳** | **۶** |

---

## 🎯 پیشنهاد اجرایی

### هفته اول
- [x] Continue (Alt+Enter)
- [ ] Quick Reply
- [x] Reasoning Display
- [ ] Author's Note

### هفته دوم
- [ ] Speech Recognition
- [ ] Regex Scripts
- [x] Context Window Display
- [ ] Depth Prompts

### هفته سوم
- [ ] Multi-Provider Support (شروع)
- [ ] Translation

### هفته چهارم
- [ ] Instruct Mode
- [ ] Character Expressions

### هفته پنجم و ششم
- [ ] Multi-Provider Support (تکمیل)
- [ ] TTS
- [ ] Chat Summarization

---

*این فایل به‌روزرسانی می‌شود با پیشرفت پروژه*
