import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/state';

export default function ConfirmModal() {
  const { confirmDialog, resolveConfirm } = useStore();
  const [closing, setClosing] = useState(false);
  const pendingResult = useRef<boolean | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // وقتی مودال جدیدی باز می‌شود، state انیمیشن ریست می‌شود
  useEffect(() => {
    if (confirmDialog) {
      setClosing(false);
      pendingResult.current = null;
    }
  }, [confirmDialog]);

  if (!confirmDialog) return null;

  const close = (result: boolean) => {
    if (closing) return;
    pendingResult.current = result;
    setClosing(true);
    // Fallback: اگر animationend رخ ندهد (انیمیشن غیرفعال/متوقف)، بعد از مدت انیمیشن بسته شود
    window.setTimeout(() => {
      if (pendingResult.current !== null) {
        resolveConfirm(pendingResult.current);
      }
    }, 200);
  };

  // بعد از پایان انیمیشن خروج، پرامیس resolve می‌شود
  const handleAnimationEnd = () => {
    if (!closing) return;
    const result = pendingResult.current;
    pendingResult.current = null;
    resolveConfirm(result ?? false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') close(true);
    else if (e.key === 'Escape') close(false);
  };

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4 ${closing ? 'modal-exit-overlay' : 'modal-enter-overlay'}`}
      onClick={(e) => { if (e.target === overlayRef.current) close(false); }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      autoFocus
    >
      <div
        ref={cardRef}
        className={`bg-tavern-card rounded-xl w-full max-w-sm p-6 shadow-2xl ${closing ? 'modal-exit-card' : 'modal-enter-card'}`}
        onAnimationEnd={handleAnimationEnd}
      >
        <p className="text-tavern-text text-sm leading-6 mb-6">{confirmDialog.message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm rounded-lg hover:bg-tavern-hover transition-colors"
          >
            لغو
          </button>
          <button
            onClick={() => close(true)}
            className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
          >
            تایید
          </button>
        </div>
      </div>
    </div>
  );
}
