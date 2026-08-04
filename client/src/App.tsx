import { useEffect } from 'react';
import { useStore } from './store/state';
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

function App() {
  const { loadCharacters, loadPersonas, loadLorebooks, loadApiSettings } = useStore();

  useEffect(() => {
    loadCharacters();
    loadPersonas();
    loadLorebooks();
    loadApiSettings();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-tavern-bg">
      {/* Top Bar with horizontal icons, chat selector, search */}
      <TopBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Chat Area - always full width */}
        <ChatView />

        {/* Sidebar - absolutely positioned, doesn't affect chat width */}
        <Sidebar />

        {/* Right Panel */}
        <RightPanel />
      </div>

      {/* Modals */}
      <CharacterEditor />
      <ChatSettings />
      <LorebookEditor />
      <PersonaEditor />
      <Toast />
      <ConfirmModal />
    </div>
  );
}

export default App;
