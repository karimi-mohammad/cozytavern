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
        title: '',
      });
    } catch {}

    dismissChapterSuggestion();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-tavern-bg border border-tavern-border rounded-lg shadow-xl p-4 w-80">
      <div className="text-sm text-tavern-text mb-1">New chapter start suggested</div>
      <div className="text-xs text-tavern-textDim mb-3">
        Trigger phrase: "{chapterSuggestion.trigger_phrase}"
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={dismissChapterSuggestion}
          className="px-3 py-1.5 rounded bg-tavern-input text-tavern-textDim hover:text-tavern-text text-sm"
        >
          Dismiss
        </button>
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 rounded bg-tavern-accent text-white hover:opacity-90 text-sm"
        >
          Create Chapter
        </button>
      </div>
    </div>
  );
}
