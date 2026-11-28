import React from 'react';
import { Home, Search, Folder, UploadCloud, User } from 'lucide-react';
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

  const handleProfileClick = () => {
    if (!isAuthenticated) {
      setCurrentTab('login');
    } else {
      setCurrentTab('profile');
    }
  };

  const items = [
    { id: 'home', label: 'Home', icon: Home, onClick: () => setCurrentTab('home') },
    { id: 'browse', label: 'Library', icon: Search, onClick: () => setCurrentTab('browse') },
    { id: 'workspace', label: 'Workspace', icon: Folder, onClick: () => setCurrentTab('workspace') },
    { id: 'upload', label: 'Upload', icon: UploadCloud, onClick: handleUploadClick },
    {
      id: 'profile',
      label: isAuthenticated ? 'Account' : 'Sign In',
      icon: User,
      onClick: handleProfileClick,
    },
  ];

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-main)] border-t border-[var(--border-divider)] h-14 flex items-center justify-around px-1"
      aria-label="Mobile navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          currentTab === item.id ||
          (item.id === 'browse' && currentTab === 'paper-details') ||
          (item.id === 'profile' && (currentTab === 'profile-bookmarks' || currentTab === 'login'));
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={`relative flex flex-col items-center justify-center px-2 min-h-[44px] min-w-[54px] transition-colors cursor-pointer ${
              active
                ? 'text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {active && (
              <span
                className="absolute top-0 left-3 right-3 h-0.5 bg-[var(--accent-mint)]"
                aria-hidden="true"
              />
            )}
            <Icon className={`w-4 h-4 ${active ? 'text-[var(--accent-mint)]' : ''}`} />
            <span className="text-[10px] mt-0.5 whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
