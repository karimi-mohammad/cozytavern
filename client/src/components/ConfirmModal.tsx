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
      className={`fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[90] flex items-center justify-center p-4 ${closing ? 'modal-exit-overlay' : 'modal-enter-overlay'}`}
      onClick={(e) => { if (e.target === overlayRef.current) close(false); }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      autoFocus
    >
      <div
        ref={cardRef}
        className={`bg-tavern-card border border-tavern-border rounded-xl w-full max-w-sm p-5 shadow-2xl shadow-black/40 ${closing ? 'modal-exit-card' : 'modal-enter-card'}`}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-tavern-text text-sm leading-6 pt-1">{confirmDialog.message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => close(false)}
            className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm rounded-lg hover:bg-tavern-hover transition-colors active:scale-[0.97]"
          >
            Cancel
          </button>
          <button
            onClick={() => close(true)}
            className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-sm rounded-lg transition-all active:scale-[0.97] shadow-lg shadow-red-500/20"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
