import { useEffect } from 'react';
import { useStore } from './store/state';
import IconBar from './components/IconBar';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RightPanel from './components/RightPanel';
import Toast from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import ErrorBoundary from './components/ErrorBoundary';
import { lazy, Suspense } from 'react';

// Code Splitting: لود تنبل کامپوننت‌های سنگین
const CharacterEditor = lazy(() => import('./components/CharacterEditor'));
const CharacterWizard = lazy(() => import('./components/CharacterWizard'));
const ChatSettings = lazy(() => import('./components/ChatSettings'));
const PromptInspectorModal = lazy(() => import('./components/PromptInspectorModal'));
const LorebookEditor = lazy(() => import('./components/LorebookEditor'));
const PersonaEditor = lazy(() => import('./components/PersonaEditor'));
const StoryStateMonitor = lazy(() => import('./components/StoryStateMonitor'));
const SearchPanel = lazy(() => import('./components/SearchPanel'));
const ChapterPreviewModal = lazy(() => import('./components/ChapterPreviewModal'));
const ChapterReviewModal = lazy(() => import('./components/ChapterReviewModal'));

function App() {
  // استفاده از selector‌های جداگانه برای جلوگیری از re-render بی‌رویه
  const loadCharacters = useStore(s => s.loadCharacters);
  const loadPersonas = useStore(s => s.loadPersonas);
  const loadLorebooks = useStore(s => s.loadLorebooks);
  const loadApiSettings = useStore(s => s.loadApiSettings);
  const loadQuickReplies = useStore(s => s.loadQuickReplies);
  const personas = useStore(s => s.personas);
  const lorebooks = useStore(s => s.lorebooks);
  const setActivePersona = useStore(s => s.setActivePersona);
  const setActiveLorebook = useStore(s => s.setActiveLorebook);
  const theme = useStore(s => s.theme);
  const _initStoryStateListener = useStore(s => s._initStoryStateListener);
  const currentChat = useStore(s => s.currentChat);
  const rightPanelOpen = useStore(s => s.rightPanelOpen);

  // اعمال تم ذخیره‌شده در اولین رندر
  useEffect(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-darker', 'theme-light', 'theme-midnight', 'theme-forest', 'theme-sunset', 'theme-ocean', 'theme-slate', 'theme-mocha', 'theme-teal', 'theme-softslate', 'theme-stone', 'theme-graphite');
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.toggle('theme-light', theme === 'light');
    document.body.classList.toggle('theme-ocean', theme === 'ocean');
  }, [theme]);

  useEffect(() => {
    loadCharacters();
    loadPersonas();
    loadLorebooks();
    loadApiSettings();
    loadQuickReplies();
    _initStoryStateListener();
  }, [loadCharacters, loadPersonas, loadLorebooks, loadApiSettings, loadQuickReplies, _initStoryStateListener]);

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
          <Suspense fallback={null}><SearchPanel /></Suspense>

          {/* Sidebar - absolutely positioned overlay */}
          <Sidebar />

          {/* Right Panel */}
          <RightPanel />
        </div>
      </div>

      {/* Modals - هر مودال در ErrorBoundary جدا، تا خطای یکی بقیه را از کار نیندازد */}
      <Suspense fallback={null}>
        <ErrorBoundary label="CharacterWizard"><CharacterWizard /></ErrorBoundary>
        <ErrorBoundary label="CharacterEditor"><CharacterEditor /></ErrorBoundary>
        <ErrorBoundary label="ChatSettings"><ChatSettings /></ErrorBoundary>
        <ErrorBoundary label="PromptInspector"><PromptInspectorModal /></ErrorBoundary>
        <ErrorBoundary label="LorebookEditor"><LorebookEditor /></ErrorBoundary>
        <ErrorBoundary label="PersonaEditor"><PersonaEditor /></ErrorBoundary>
        <ErrorBoundary label="StoryStateMonitor"><StoryStateMonitor /></ErrorBoundary>
        <ErrorBoundary label="ChapterPreview"><ChapterPreviewModal /></ErrorBoundary>
        <ErrorBoundary label="ChapterReview"><ChapterReviewModal /></ErrorBoundary>
      </Suspense>
      <ErrorBoundary label="Toast"><Toast /></ErrorBoundary>
      <ErrorBoundary label="ConfirmModal"><ConfirmModal /></ErrorBoundary>
    </div>
  );
}

export default App;
