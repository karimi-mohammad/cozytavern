import { useEffect } from 'react';
import { useStore } from './store/state';
import IconBar from './components/IconBar';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RightPanel from './components/RightPanel';
import CharacterEditor from './components/CharacterEditor';
import ChatSettings from './components/ChatSettings';
import PromptInspectorModal from './components/PromptInspectorModal';
import LorebookEditor from './components/LorebookEditor';
import PersonaEditor from './components/PersonaEditor';
import StoryStateMonitor from './components/StoryStateMonitor';
import SearchPanel from './components/SearchPanel';
import Toast from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import ErrorBoundary from './components/ErrorBoundary';
import ChapterPreviewModal from './components/ChapterPreviewModal';
import ChapterReviewModal from './components/ChapterReviewModal';

function App() {
  const { loadCharacters, loadPersonas, loadLorebooks, loadApiSettings, loadQuickReplies, personas, lorebooks, setActivePersona, setActiveLorebook, theme, _initStoryStateListener } = useStore();

  // اعمال تم ذخیره‌شده در اولین رندر
  useEffect(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-darker', 'theme-light');
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.toggle('theme-light', theme === 'light');
  }, []);

  useEffect(() => {
    loadCharacters();
    loadPersonas();
    loadLorebooks();
    loadApiSettings();
    loadQuickReplies();
    _initStoryStateListener();
  }, []);

  // بازیابی انتخاب‌های فعال (پرسونا/لوربوک) بعد از load دیتا
  useEffect(() => {
    try {
      const personaId = localStorage.getItem('cozytavern.activePersonaId');
      if (personaId) {
        const saved = personas.find(p => p.id === personaId);
        if (saved) setActivePersona(saved);
      }
      const lorebookId = localStorage.getItem('cozytavern.activeLorebookId');
      if (lorebookId) {
        const saved = lorebooks.find(l => l.id === lorebookId);
        if (saved) setActiveLorebook(saved);
      }
    } catch {}
  }, [personas, lorebooks]);

  return (
    <div className="flex h-screen overflow-hidden bg-tavern-bg">
      {/* Left Icon Bar - always visible (SillyTavern style) */}
      <IconBar />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top Bar */}
        <TopBar />

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Main Chat Area - always full width */}
          <ChatView />

          {/* Search Panel - absolutely positioned overlay */}
          <SearchPanel />

          {/* Sidebar - absolutely positioned overlay */}
          <Sidebar />

          {/* Right Panel */}
          <RightPanel />
        </div>
      </div>

      {/* Modals - هر مودال در ErrorBoundary جدا، تا خطای یکی بقیه را از کار نیندازد */}
      <ErrorBoundary label="CharacterEditor"><CharacterEditor /></ErrorBoundary>
      <ErrorBoundary label="ChatSettings"><ChatSettings /></ErrorBoundary>
      <ErrorBoundary label="PromptInspector"><PromptInspectorModal /></ErrorBoundary>
      <ErrorBoundary label="LorebookEditor"><LorebookEditor /></ErrorBoundary>
      <ErrorBoundary label="PersonaEditor"><PersonaEditor /></ErrorBoundary>
      <ErrorBoundary label="StoryStateMonitor"><StoryStateMonitor /></ErrorBoundary>
      <ErrorBoundary label="ChapterPreview"><ChapterPreviewModal /></ErrorBoundary>
      <ErrorBoundary label="ChapterReview"><ChapterReviewModal /></ErrorBoundary>
      <ErrorBoundary label="Toast"><Toast /></ErrorBoundary>
      <ErrorBoundary label="ConfirmModal"><ConfirmModal /></ErrorBoundary>
    </div>
  );
}

export default App;
