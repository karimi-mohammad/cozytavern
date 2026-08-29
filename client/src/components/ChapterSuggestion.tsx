import { useStore } from '../store/state';

export default function ChapterSuggestion() {
  const { chapterSuggestion, dismissChapterSuggestion, createChapter, currentChat } = useStore();

  if (!chapterSuggestion || !currentChat) return null;

  const handleCreate = async () => {
    const messages = currentChat.messages;
    const triggerIndex = messages.findIndex(m => m.id === chapterSuggestion.trigger_message_id);
    if (triggerIndex === -1) {
      dismissChapterSuggestion();
      return;
    }

    // Find the start of this chapter: go back from trigger to find a reasonable start
    // Use the message right after the last chapter's end, or the first message
    const { chapters } = useStore.getState();
    let startIndex = 0;
    if (chapters.length > 0) {
      const lastChapter = chapters[chapters.length - 1];
      const lastEndIndex = messages.findIndex(m => m.id === lastChapter.end_message_id);
      if (lastEndIndex !== -1) {
        startIndex = lastEndIndex + 1;
      }
    }

    if (startIndex >= triggerIndex) {
      dismissChapterSuggestion();
      return;
    }

    // The chapter ends at the message before the trigger (the trigger starts a new scene)
    const endIndex = triggerIndex - 1;
    if (endIndex < startIndex) {
      dismissChapterSuggestion();
      return;
    }

    try {
      await createChapter({
        chat_id: currentChat.id,
        start_message_id: messages[startIndex].id,
        end_message_id: messages[endIndex].id,
        trigger_message_id: chapterSuggestion.trigger_message_id,
        title: '',
      });
    } catch {}

    dismissChapterSuggestion();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-tavern-surface border border-tavern-accent/30 rounded-xl shadow-2xl shadow-black/30 p-4 w-80 animate-slide-up">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full bg-tavern-accent/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium text-tavern-text-bright mb-0.5">New chapter start suggested</div>
          <div className="text-xs text-tavern-dim">
            Trigger phrase: "{chapterSuggestion.trigger_phrase}"
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={dismissChapterSuggestion}
          className="px-3 py-1.5 rounded-lg bg-tavern-input border border-tavern-border text-tavern-dim hover:text-tavern-text hover:bg-tavern-hover text-sm transition-colors active:scale-[0.97]"
        >
          Dismiss
        </button>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 rounded-lg bg-tavern-accent text-white hover:bg-tavern-accent-hover text-sm font-medium transition-all active:scale-[0.97] shadow-md shadow-tavern-accent/20"
        >
          Create Chapter
        </button>
      </div>
    </div>
  );
}
