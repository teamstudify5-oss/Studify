import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  UploadCloud,
  Bookmark,
  User,
  ShieldAlert,
  LogOut,
  Info,
  Menu,
  X,
  ChevronRight,
  Folder,
  Plus,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onRequireLogin: () => void;
  onOpenCommandCenter?: () => void;
  onOpenQuickCapture?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onRequireLogin,
  onOpenCommandCenter,
  onOpenQuickCapture,
}) => {
  const { currentUser, isOwner, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLeftMenuOpen) {
        setIsLeftMenuOpen(false);
      }
      if (e.key === 'Escape' && profileDropdownOpen) {
        setProfileDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLeftMenuOpen, profileDropdownOpen]);

  useEffect(() => {
    if (isLeftMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLeftMenuOpen]);

  const handleNavClick = (tab: string) => {
    setCurrentTab(tab);
    setIsLeftMenuOpen(false);
  };

  const handleUploadClick = () => {
    setIsLeftMenuOpen(false);
    if (!isAuthenticated) {
      onRequireLogin();
    } else {
      setCurrentTab('upload');
    }
  };

  const handleBookmarksClick = () => {
    setIsLeftMenuOpen(false);
    if (!isAuthenticated) {
      onRequireLogin();
    } else {
      setCurrentTab('profile-bookmarks');
    }
  };

  const navLinks: Array<{ id: string; label: string; onClick: () => void }> = [
    { id: 'home', label: 'Home', onClick: () => handleNavClick('home') },
    { id: 'browse', label: 'Library', onClick: () => handleNavClick('browse') },
    { id: 'workspace', label: 'Workspace', onClick: () => handleNavClick('workspace') },
    { id: 'upload', label: 'Upload', onClick: handleUploadClick },
    { id: 'about', label: 'About', onClick: () => handleNavClick('about') },
  ];

  return (
    <>
      {/* Clean 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-[var(--surface-main)] border-b border-[var(--border-divider)] transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark (+ Mobile Menu Toggle) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsLeftMenuOpen(true)}
              className="md:hidden p-2 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
              aria-label="Open Navigation Menu"
              title="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentTab('home')}
              className="font-display text-xl font-extrabold tracking-tight text-[var(--text-primary)] hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-xs bg-[var(--accent-mint)] shrink-0"
                aria-hidden="true"
              />
              <span>Studify</span>
            </button>
          </div>

          {/* Zone 2: Clean Typography Navigation Links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
            {navLinks.map((link) => {
              const isActive =
                currentTab === link.id ||
                (link.id === 'browse' && currentTab === 'paper-details');
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={link.onClick}
                  className={`relative py-5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[var(--text-primary)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-mint)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quick Actions & Account CTA */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {onOpenCommandCenter && (
              <button
                type="button"
                onClick={onOpenCommandCenter}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-divider)] bg-[var(--bg-app)] hover:border-[var(--border-hover)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Search everything (Cmd+K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Search</span>
                <kbd className="text-[10px] text-[var(--text-muted)] font-mono">⌘K</kbd>
              </button>
            )}

            {onOpenQuickCapture && (
              <button
                type="button"
                onClick={onOpenQuickCapture}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Quick Capture (Note, Formula, Link)"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--accent-mint)]" />
                <span className="hidden sm:inline">Capture</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-main)] hover:bg-[var(--surface-elevated)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span className="w-6 h-6 rounded-md bg-[var(--surface-navy)] text-white flex items-center justify-center font-semibold text-[11px] shrink-0">
                    {currentUser?.avatarInitials}
                  </span>
                  <span className="max-w-[84px] truncate hidden sm:inline">
                    {currentUser?.name.split(' ')[0]}
                  </span>
                </button>

                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-60 bg-[var(--modal-bg)] border border-[var(--border-divider)] rounded-xl p-2 z-50 text-xs shadow-lg"
                    onMouseLeave={() => setProfileDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-[var(--border-divider)] mb-1">
                      <div className="font-semibold text-[var(--text-primary)] truncate">
                        {currentUser?.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {currentUser?.email}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('profile');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      <span>My Profile &amp; Library</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('profile-bookmarks');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      <span>Bookmarked Papers</span>
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTab('admin');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--accent-mint-bg)] text-[var(--accent-mint)] font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Moderation Panel</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--accent-red-bg)] text-[var(--color-red)] flex items-center gap-2 mt-1 border-t border-[var(--border-divider)] pt-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentTab('login')}
                className="px-4 py-2 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] text-xs font-semibold rounded-lg transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer */}
      <div
        className={`fixed inset-0 bg-[var(--modal-backdrop)] z-50 transition-opacity duration-200 ${
          isLeftMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsLeftMenuOpen(false)}
        aria-hidden="true"
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[var(--surface-main)] border-r border-[var(--border-divider)] z-50 flex flex-col shadow-xl transition-transform duration-200 ease-out ${
          isLeftMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation Menu"
      >
        <div className="px-5 py-4 border-b border-[var(--border-divider)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-xs bg-[var(--accent-mint)]" aria-hidden="true" />
            <span className="font-display text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
              Studify
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsLeftMenuOpen(false)}
            className="w-8 h-8 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)]">
            Study Workspace
          </div>

          <button
            type="button"
            onClick={() => handleNavClick('workspace')}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
              currentTab === 'workspace'
                ? 'bg-[var(--accent-blue-bg)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Folder className="w-4 h-4 text-[var(--accent-mint)] shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">Study Workspace</span>
                <span className="text-[11px] text-[var(--text-muted)]">Projects, schedule &amp; notes</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          <div className="pt-3 px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)]">
            Public Library
          </div>

          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
              currentTab === 'home'
                ? 'bg-[var(--accent-blue-bg)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">Home</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('browse')}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
              currentTab === 'browse'
                ? 'bg-[var(--accent-blue-bg)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Search className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">Explore PYQs</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          <button
            type="button"
            onClick={handleUploadClick}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
              currentTab === 'upload'
                ? 'bg-[var(--accent-blue-bg)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <UploadCloud className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">Upload Paper</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          <button
            type="button"
            onClick={handleBookmarksClick}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
              currentTab === 'profile-bookmarks'
                ? 'bg-[var(--accent-blue-bg)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bookmark className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">Bookmarks</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('about')}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
              currentTab === 'about'
                ? 'bg-[var(--accent-blue-bg)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Info className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">About Studify</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                currentTab === 'admin'
                  ? 'bg-[var(--accent-mint-bg)] text-[var(--accent-mint)] font-semibold'
                  : 'text-[var(--accent-mint)] hover:bg-[var(--accent-mint-bg)]'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium">Moderation Panel</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border-divider)] bg-[var(--surface-elevated)] space-y-3">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface-main)] border border-[var(--border-divider)] text-xs">
            <span className="text-[var(--text-secondary)] font-medium">Appearance</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--surface-elevated)] text-[var(--text-primary)] font-medium cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </>
              )}
            </button>
          </div>

          {isAuthenticated && currentUser ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-[var(--surface-main)] border border-[var(--border-divider)] hover:border-[var(--border-hover)] text-left cursor-pointer"
              >
                <div className="w-8 h-8 rounded-md bg-[var(--surface-navy)] text-white flex items-center justify-center font-semibold text-xs shrink-0">
                  {currentUser.avatarInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    {currentUser.email}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  setIsLeftMenuOpen(false);
                }}
                className="w-full py-2 px-3 rounded-lg border border-[var(--border-divider)] bg-[var(--surface-main)] hover:bg-[var(--accent-red-bg)] text-[var(--color-red)] text-xs font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleNavClick('login')}
                className="w-full py-2.5 bg-[var(--accent-blue)] hover:opacity-90 text-white dark:text-[#0A2640] text-xs font-semibold rounded-lg text-center cursor-pointer"
              >
                Sign In to Studify
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('signup')}
                className="w-full py-2 bg-[var(--surface-main)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-lg text-center cursor-pointer"
              >
                Create Free Account
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
