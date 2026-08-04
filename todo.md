# CozyTavern —ToDo List

## اولویت ۱: ریسپانسیو و موبایل

- [x] Sidebar: حالت drawer با overlay در موبایل، ثابت در دسکتاپ (`md:` breakpoint)
- [x] مودال‌ها: `max-w-[calc(100vw-2rem)]` و padding مناسب موبایل
- [x] LorebookEditor: در موبایل حالت تب بین لیست و جزئیات
- [x] بررسی تمام padding/margin ها در سایزهای کوچک

## اولویت ۲: Toast Notifications

- [x] سیستم toast سفارشی (success / error / info)
- [x] جایگزینی تمام `console.error` ها با toast
- [x] نمایش toast موقع ذخیره/حذف/خطا

## اولویت ۳: Markdown Rendering

- [x] نصب `react-markdown` + `remark-gfm`
- [x] نصب Tailwind Typography plugin
- [x] رندر کد بلاک، لیست، بولد، لینک، جدول در پاسخ AI
- [ ] کپی کد با دکمه در code blocks

## اولویت ۴: Avatar کاراکترها

- [x] نمایش circular avatar با حرف اول نام (placeholder)
- [x] آپلود عکس avatar در CharacterEditor
- [x] نمایش avatar در sidebar و header چت و روی message bubble

## اولویت ۵: Confirm Dialog سفارشی

- [x] کامپوننت ConfirmModal اختصاصی
- [x] جایگزینی تمام `window.confirm()` ها
- [ ] انیمیشن باز/بسته شدن

## اولویت ۶: System Prompt UI

- [x] فیلد system prompt در ChatSettings
- [x] ذخیره system prompt در api_settings
- [x] ارسال system prompt در prompt-builder سمت سرور

## اولویت ۷: Keyboard Shortcuts

- [ ] `Escape` برای بستن مودال‌ها
- [ ] `Ctrl+Enter` برای ارسال پیام
- [ ] `Ctrl+Z` برای undo آخرین edit
- [ ] پنل راهنمای shortcuts (`?`)

## اولویت ۸: Light Mode / Theme Customizer

- [ ] تم روشن پیش‌فرض
- [ ] سوییچ toggle بین dark/light در settings
- [ ] انتخاب رنگ accent از چند پالت آماده
- [ ] ذخیره انتخاب تم در localStorage

---

## قابلیت‌های جدید

### مدیریت محتوا
- [ ] Export چت به JSON
- [ ] Import چت از JSON
- [x] Character cards gallery view (نمایش کارتی به جای لیست)
- [x] Chat folders / groups برای دسته‌بندی چت‌ها
- [ ] Character favorites (نشانه‌گذاری کاراکترهای پرکاربرد)
- [x] Rename چت از UI

### سیستم پیام
- [ ] Pinned messages (سنجاق کردن پیام‌های مهم)
- [ ] Voice input با Web Speech API
- [x] Timestamp نمایش داده بشه روی پیام‌ها
- [x] Typing indicator بهتر (انیمیشن سه نقطه به جای pulse)

### تعامل بهتر
- [ ] Drag & drop آپلود فایل JSON کاراکتر
- [x] Search/filter کاراکترها در sidebar
- [ ] Multi-chat tabs (چند چت همزمان)
- [ ] Split view (دیدن دو چت کنار هم)

---

## بهبودهای فنی

- [ ] Error boundaries React (جلوگیری از کرashed کل اپ)
- [ ] Virtual scrolling برای لیست پیام‌های طولانی
- [ ] Debounce روی search/filter
- [ ] Optimistic updates برای edit/delete
- [x] Loading skeletons موقع لود اولیه دیتا
