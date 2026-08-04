import { useStore } from '../store/state';

export default function ConfirmModal() {
  const { confirmDialog, resolveConfirm } = useStore();

  if (!confirmDialog) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4">
      <div className="bg-tavern-card rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <p className="text-tavern-text text-sm leading-6 mb-6">{confirmDialog.message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => resolveConfirm(false)}
            className="px-4 py-2 text-tavern-muted hover:text-tavern-text text-sm rounded-lg hover:bg-tavern-hover transition-colors"
          >
            لغو
          </button>
          <button
            onClick={() => resolveConfirm(true)}
            className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
          >
            تایید
          </button>
        </div>
      </div>
    </div>
  );
}
