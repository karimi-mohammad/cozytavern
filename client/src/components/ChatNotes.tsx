import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/state';

export default function ChatNotes() {
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChat = useStore(s => s.currentChat);
  const chatNotes = useStore(s => s.chatNotes);
  const chatNotesOpen = useStore(s => s.chatNotesOpen);
  const setChatNotesOpen = useStore(s => s.setChatNotesOpen);
  const loadChatNotes = useStore(s => s.loadChatNotes);
  const createChatNote = useStore(s => s.createChatNote);
  const updateChatNote = useStore(s => s.updateChatNote);
  const deleteChatNote = useStore(s => s.deleteChatNote);
  const showConfirm = useStore(s => s.showConfirm);

  // لود یادداشت‌ها وقتی چت عوض می‌شود
  useEffect(() => {
    if (currentChat) {
      loadChatNotes(currentChat.id);
    }
  }, [currentChat?.id, loadChatNotes]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newNote]);

  useEffect(() => {
    if (editTextareaRef.current) {
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [editContent]);

  const handleCreate = async () => {
    if (!currentChat || !newNote.trim()) return;
    await createChatNote(currentChat.id, newNote.trim());
    setNewNote('');
  };

  const handleUpdate = async (id: string) => {
    if (!editContent.trim()) return;
    await updateChatNote(id, editContent.trim());
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm('Delete this note?');
    if (ok) deleteChatNote(id);
  };

  if (!chatNotesOpen || !currentChat) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-tavern-surface border-l border-tavern-border flex flex-col z-40 shadow-xl animate-slide-in-left">
      {/* هدر */}
      <div className="flex items-center justify-between p-3 border-b border-tavern-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-tavern-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <h3 className="text-sm font-semibold text-tavern-text-bright">Notes</h3>
          <span className="text-[10px] text-tavern-dim bg-tavern-surface2 px-1.5 py-0.5 rounded-full">
            {chatNotes.length}
          </span>
        </div>
        <button
          onClick={() => setChatNotesOpen(false)}
          className="text-tavern-dim hover:text-tavern-text p-1 rounded hover:bg-tavern-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ورودی یادداشت جدید */}
      <div className="p-3 border-b border-tavern-border flex-shrink-0">
        <textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write a note..."
          className="w-full bg-tavern-input border border-tavern-border rounded-lg p-2.5 text-sm text-tavern-text resize-none min-h-[60px] max-h-[150px] focus:outline-none focus:border-tavern-accent transition-colors"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleCreate();
            }
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-tavern-dim">
            {newNote.trim() ? 'Ctrl+Enter to save' : ''}
          </span>
          <button
            onClick={handleCreate}
            disabled={!newNote.trim()}
            className="px-3 py-1.5 bg-tavern-accent hover:bg-tavern-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-medium transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* لیست یادداشت‌ها */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatNotes.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-3 text-tavern-dim opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs text-tavern-dim">No notes yet</p>
            <p className="text-[10px] text-tavern-dim mt-1">Start writing above!</p>
          </div>
        ) : (
          chatNotes.map((note) => (
            <div
              key={note.id}
              className="bg-tavern-bg border border-tavern-border rounded-lg p-3 group hover:border-tavern-accent/30 transition-colors"
            >
              {editingId === note.id ? (
                <>
                  <textarea
                    ref={editTextareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-tavern-input border border-tavern-border rounded p-2 text-sm text-tavern-text resize-none min-h-[80px] focus:outline-none focus:border-tavern-accent transition-colors"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleUpdate(note.id);
                      }
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditContent('');
                      }
                    }}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleUpdate(note.id)}
                      className="flex-1 px-2 py-1.5 bg-tavern-accent hover:bg-tavern-accent-hover text-white rounded text-xs font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditContent(''); }}
                      className="flex-1 px-2 py-1.5 bg-tavern-surface2 hover:bg-tavern-hover text-tavern-text rounded text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-tavern-text whitespace-pre-wrap break-words leading-relaxed">{note.content}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-tavern-border/50">
                    <span className="text-[10px] text-tavern-dim">
                      {new Date(note.updated_at).toLocaleString()}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                        className="text-tavern-dim hover:text-tavern-accent p-1 rounded hover:bg-tavern-hover transition-colors"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-tavern-dim hover:text-tavern-danger p-1 rounded hover:bg-tavern-hover transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
