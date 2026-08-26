import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 10000,
    // فایل‌های تست دیتابیس مشترک دارن — باید پشت سر هم اجرا بشن
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
