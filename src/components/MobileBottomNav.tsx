import React from 'react';
import { Home, Search, UploadCloud, Bookmark, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface MobileBottomNavProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onRequireLogin: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ 
  currentTab, 
  setCurrentTab, 
  onRequireLogin,
}) => {
  const { isAuthenticated } = useAuth();

  const handleUploadClick = () => {
    if (!isAuthenticated) {
      onRequireLogin();
    } else {
      setCurrentTab('upload');
    }
  };

  const handleBookmarksClick = () => {
    if (!isAuthenticated) {
      onRequireLogin();
    } else {
      setCurrentTab('profile-bookmarks');
    }
  };

  const handleProfileClick = () => {
    if (!isAuthenticated) {
      setCurrentTab('login');
    } else {
      setCurrentTab('profile');
    }
  };

  return (
    <nav className="sm:hidden fixed bottom-3 left-4 right-4 z-40 bg-[var(--surface-elevated)]/95 backdrop-blur-md border border-[var(--border-divider)] rounded-2xl h-14 flex items-center justify-around px-2 shadow-lg">
      <button
        onClick={() => setCurrentTab('home')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] cursor-pointer ${
          currentTab === 'home' 
            ? 'text-[var(--accent-blue)] font-bold' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Home className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">Home</span>
      </button>

      <button
        onClick={() => setCurrentTab('browse')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] cursor-pointer ${
          currentTab === 'browse' 
            ? 'text-[var(--accent-blue)] font-bold' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Search className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">Library</span>
      </button>

      <button
        onClick={handleUploadClick}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] cursor-pointer ${
          currentTab === 'upload' 
            ? 'text-[var(--accent-blue)] font-bold' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <UploadCloud className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">Upload</span>
      </button>

      <button
        onClick={handleBookmarksClick}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] cursor-pointer ${
          currentTab === 'profile-bookmarks' 
            ? 'text-[var(--accent-blue)] font-bold' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Bookmark className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">Saved</span>
      </button>

      <button
        onClick={handleProfileClick}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] cursor-pointer ${
          currentTab === 'profile' 
            ? 'text-[var(--accent-blue)] font-bold' 
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <User className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">{isAuthenticated ? 'Profile' : 'Sign in'}</span>
      </button>
    </nav>
  );
};
