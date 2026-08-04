import { useEffect } from 'react';
import { useStore } from '../store/state';

export default function Toast() {
  const { toasts, removeToast } = useStore();

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: { id: string; message: string; type: string }; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const bgColor = toast.type === 'error' ? 'bg-red-500/90' : toast.type === 'success' ? 'bg-green-500/90' : 'bg-tavern-accent/90';

  return (
    <div className={`${bgColor} text-white px-4 py-2 rounded-lg text-sm pointer-events-auto shadow-lg animate-slide-up`}>
      {toast.message}
    </div>
  );
}
