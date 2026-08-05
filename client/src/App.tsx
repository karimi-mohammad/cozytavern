import { useEffect } from 'react';
import { useStore } from './store/state';
import IconBar from './components/IconBar';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import RightPanel from './components/RightPanel';
import CharacterEditor from './components/CharacterEditor';
import ChatSettings from './components/ChatSettings';
import LorebookEditor from './components/LorebookEditor';
import PersonaEditor from './components/PersonaEditor';
import Toast from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const { loadCharacters, loadPersonas, loadLorebooks, loadApiSettings } = useStore();

  useEffect(() => {
    loadCharacters();
    loadPersonas();
    loadLorebooks();
    loadApiSettings();
  }, []);

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

          {/* Sidebar - absolutely positioned overlay */}
          <Sidebar />

          {/* Right Panel */}
          <RightPanel />
        </div>
      </div>

      {/* Modals - هر مودال در ErrorBoundary جدا، تا خطای یکی بقیه را از کار نیندازد */}
      <ErrorBoundary label="CharacterEditor"><CharacterEditor /></ErrorBoundary>
      <ErrorBoundary label="ChatSettings"><ChatSettings /></ErrorBoundary>
      <ErrorBoundary label="LorebookEditor"><LorebookEditor /></ErrorBoundary>
      <ErrorBoundary label="PersonaEditor"><PersonaEditor /></ErrorBoundary>
      <ErrorBoundary label="Toast"><Toast /></ErrorBoundary>
      <ErrorBoundary label="ConfirmModal"><ConfirmModal /></ErrorBoundary>
    </div>
  );
}

export default App;
