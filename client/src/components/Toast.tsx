import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/state';

interface ToastData {
  id: string;
  message: string;
  type: string;
}

const TOAST_STYLES: Record<string, { border: string; icon: React.ReactNode }> = {
  error: {
    border: 'border-l-red-500',
    icon: (
      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  success: {
    border: 'border-l-emerald-500',
    icon: (
      <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  info: {
    border: 'border-l-sky-500',
    icon: (
      <svg className="w-4 h-4 text-sky-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export default function Toast() {
  const { toasts, removeToast } = useStore();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastData; onRemove: (id: string) => void }) {
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  const beginRemove = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => onRemove(toast.id), 190);
  };

  useEffect(() => {
    const timer = setTimeout(beginRemove, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

  return (
    <div
      role="status"
      onClick={beginRemove}
      className={`${leaving ? 'toast-exit' : 'toast-enter'} pointer-events-auto cursor-default flex items-center gap-2.5 bg-tavern-surface2/95 backdrop-blur-sm border border-tavern-border ${style.border} border-l-2 text-tavern-text px-3.5 py-2 rounded-lg text-sm shadow-xl shadow-black/25 max-w-md`}
    >
      {style.icon}
      <span className="leading-snug">{toast.message}</span>
    </div>
  );
}
