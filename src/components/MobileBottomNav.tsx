import React from 'react';
import { Home, Search, UploadCloud, Bookmark, User, ShieldAlert } from 'lucide-react';
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
  const { isAuthenticated, isOwner, openAuthModal } = useAuth();

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
    <nav className="sm:hidden fixed bottom-3 left-4 right-4 z-40 bg-[#0A1222]/90 backdrop-blur-xl border border-white/[0.14] rounded-2xl h-14 flex items-center justify-around px-2 shadow-2xl shadow-cyan-950/40">
      <button
        onClick={() => setCurrentTab('home')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] ${
          currentTab === 'home' 
            ? 'text-cyan-400 font-bold' 
            : 'text-[#A7B4C8] hover:text-[#F8FAFC]'
        }`}
      >
        <Home className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">Home</span>
      </button>

      <button
        onClick={() => setCurrentTab('browse')}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] ${
          currentTab === 'browse' 
            ? 'text-cyan-400 font-bold' 
            : 'text-[#A7B4C8] hover:text-[#F8FAFC]'
        }`}
      >
        <Search className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">PYQs</span>
      </button>

      <button
        onClick={handleUploadClick}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] ${
          currentTab === 'upload' 
            ? 'text-cyan-400 font-bold' 
            : 'text-[#A7B4C8] hover:text-[#F8FAFC]'
        }`}
      >
        <UploadCloud className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">Upload</span>
      </button>

      <button
        onClick={handleBookmarksClick}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] ${
          currentTab === 'profile-bookmarks' 
            ? 'text-cyan-400 font-bold' 
            : 'text-[#A7B4C8] hover:text-[#F8FAFC]'
        }`}
      >
        <Bookmark className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">Saved</span>
      </button>

      <button
        onClick={handleProfileClick}
        className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-h-[44px] ${
          currentTab === 'profile' 
            ? 'text-cyan-400 font-bold' 
            : 'text-[#A7B4C8] hover:text-[#F8FAFC]'
        }`}
      >
        <User className="w-4 h-4" />
        <span className="text-[10px] mt-0.5">{isAuthenticated ? 'Library' : 'Sign in'}</span>
      </button>
    </nav>
  );
};
