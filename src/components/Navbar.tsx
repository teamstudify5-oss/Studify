import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  UploadCloud, 
  Bookmark, 
  User, 
  ShieldAlert, 
  LogOut, 
  Sparkles, 
  Menu, 
  X,
  ChevronRight,
  Folder,
  Zap,
  Moon,
  Sun
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
  onOpenQuickCapture 
}) => {
  const { currentUser, isOwner, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isLeftMenuOpen, setIsLeftMenuOpen] = useState(false);

  // Close left menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLeftMenuOpen) {
        setIsLeftMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLeftMenuOpen]);

  // Lock body scroll when left drawer is open
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

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-2.5 sm:top-3 z-40 px-3 sm:px-6 max-w-6xl mx-auto w-full transition-all">
        <div className="bg-[var(--surface-main)]/90 backdrop-blur-xl border border-[var(--border-divider)] rounded-2xl px-3 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 shadow-xl">
          
          {/* Left: Left Side Menu Toggle Button + Brand Wordmark Studify */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Left Side Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setIsLeftMenuOpen(true)}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] btn-quad-border text-[var(--accent-blue)] transition-all flex items-center gap-2 cursor-pointer group shadow-xs shrink-0"
              aria-label="Open Navigation Menu"
              title="Open Navigation Menu"
            >
              <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[var(--accent-blue)] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-[var(--text-primary)] hidden sm:inline">Menu</span>
            </button>

            {/* Brand Wordmark — Simple text wordmark Studify without standalone logo mark */}
            <button
              type="button"
              onClick={() => setCurrentTab('home')}
              className="flex items-center text-left group shrink-0 cursor-pointer py-1"
            >
              <div className="flex flex-col">
                <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent-blue)] transition-colors">
                  Studify
                </span>
                <span className="text-[10px] text-[var(--text-secondary)] font-medium tracking-wide hidden lg:inline">
                  Past Papers & Study Library
                </span>
              </div>
            </button>
          </div>

          {/* Center Quick Tools: Search Palette & Workspace Direct Link */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {onOpenCommandCenter && (
              <button
                type="button"
                onClick={onOpenCommandCenter}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] btn-quad-border text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                title="Search everything (Cmd+K)"
              >
                <Search className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                <span>Search</span>
                <kbd className="text-[10px] bg-[var(--surface-main)] px-1.5 py-0.5 rounded text-[var(--text-secondary)] font-mono border border-[var(--border-divider)]">⌘K</kbd>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentTab('workspace')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer btn-quad-border ${
                currentTab === 'workspace'
                  ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)]'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
              <span>Workspace</span>
            </button>

            {onOpenQuickCapture && (
              <button
                type="button"
                onClick={onOpenQuickCapture}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 btn-quad-border text-amber-400 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                title="Quick Capture (Note, Formula, Link)"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Capture</span>
              </button>
            )}
          </div>

          {/* Right Actions: Theme Toggle + User Identity */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] btn-quad-border text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center cursor-pointer shadow-xs"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-300 transition-transform hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-[#3478D4] transition-transform hover:-rotate-12" />
              )}
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] btn-quad-border text-xs font-medium text-[var(--text-primary)] transition-all cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] flex items-center justify-center font-bold text-[10px]">
                    {currentUser?.avatarInitials}
                  </div>
                  <span className="max-w-[70px] sm:max-w-[100px] truncate hidden sm:inline">{currentUser?.name.split(' ')[0]}</span>
                </button>

                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-2xl p-2.5 z-50 text-xs shadow-2xl animate-in fade-in backdrop-blur-xl"
                    onMouseLeave={() => setProfileDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-[var(--border-divider)] mb-1.5">
                      <div className="font-semibold text-[var(--text-primary)] truncate">{currentUser?.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate">{currentUser?.email}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('profile');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer btn-quad-border mb-1"
                    >
                      <User className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                      <span>My Profile & Library</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('profile-bookmarks');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-primary)] flex items-center gap-2 cursor-pointer btn-quad-border mb-1"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                      <span>Bookmarked Papers</span>
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentTab('admin');
                          setProfileDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400 flex items-center gap-2 cursor-pointer btn-quad-border mb-1"
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
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-500/15 text-rose-400 flex items-center gap-2 mt-1 border-t border-[var(--border-divider)] pt-2 cursor-pointer btn-quad-border"
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
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[var(--accent-blue)] hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer btn-quad-border"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* LEFT SIDE MENU DRAWER & BACKDROP OVERLAY */}
      {/* ========================================================================= */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/75 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isLeftMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsLeftMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Left Drawer Menu */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[var(--surface-main)] backdrop-blur-2xl border-r border-[var(--border-divider)] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isLeftMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation Menu"
      >
        {/* Drawer Header — Clean text wordmark Studify without emblem */}
        <div className="p-4 sm:p-5 border-b border-[var(--border-divider)] flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
              Studify
            </span>
            <span className="text-[10px] text-[var(--text-secondary)]">
              Past Papers & Study Library
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsLeftMenuOpen(false)}
            className="w-8 h-8 rounded-xl bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer btn-quad-border"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items in Left Side Menu */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin">
          <div className="px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase text-[var(--accent-blue)] font-semibold flex items-center justify-between">
            <span>Student Workspace</span>
            <span className="text-[9px] bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] px-1.5 py-0.2 rounded font-mono">WORKSPACE</span>
          </div>

          {/* Study Workspace */}
          <button
            type="button"
            onClick={() => handleNavClick('workspace')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer btn-quad-border ${
              currentTab === 'workspace'
                ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] font-semibold border border-[var(--accent-blue)]/30 shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'workspace' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)]'
              }`}>
                <Folder className="w-4 h-4 text-[var(--accent-blue)]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Study Workspace</span>
                <span className="text-[11px] text-[var(--text-secondary)]/80">Personal desktop, projects & notes</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'workspace' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]/40'
            }`} />
          </button>

          <div className="pt-2 px-3 py-1 text-[10px] font-mono tracking-wider uppercase text-[var(--text-secondary)]/70 font-semibold">
            Public Library
          </div>

          {/* Home */}
          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer btn-quad-border ${
              currentTab === 'home'
                ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] font-semibold border border-[var(--accent-blue)]/30 shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'home' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)]'
              }`}>
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Home</span>
                <span className="text-[11px] text-[var(--text-secondary)]/80">Explore highlights & library overview</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'home' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]/40'
            }`} />
          </button>

          {/* Explore PYQs */}
          <button
            type="button"
            onClick={() => handleNavClick('browse')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer btn-quad-border ${
              currentTab === 'browse'
                ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] font-semibold border border-[var(--accent-blue)]/30 shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'browse' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)]'
              }`}>
                <Search className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Explore PYQs</span>
                <span className="text-[11px] text-[var(--text-secondary)]/80">Browse previous year papers & questions</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'browse' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]/40'
            }`} />
          </button>

          {/* About */}
          <button
            type="button"
            onClick={() => handleNavClick('about')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer btn-quad-border ${
              currentTab === 'about'
                ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] font-semibold border border-[var(--accent-blue)]/30 shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'about' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)]'
              }`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">About</span>
                <span className="text-[11px] text-[var(--text-secondary)]/80">Our educational mission & story</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'about' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]/40'
            }`} />
          </button>

          {/* Upload */}
          <button
            type="button"
            onClick={handleUploadClick}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer btn-quad-border ${
              currentTab === 'upload'
                ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] font-semibold border border-[var(--accent-blue)]/30 shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'upload' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)]'
              }`}>
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Upload Paper</span>
                <span className="text-[11px] text-[var(--text-secondary)]/80">Contribute new study materials</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'upload' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]/40'
            }`} />
          </button>

          {/* Bookmarks */}
          <button
            type="button"
            onClick={handleBookmarksClick}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer btn-quad-border ${
              currentTab === 'profile-bookmarks'
                ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] font-semibold border border-[var(--accent-blue)]/30 shadow-md'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'profile-bookmarks' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--accent-blue)]'
              }`}>
                <Bookmark className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Bookmarks</span>
                <span className="text-[11px] text-[var(--text-secondary)]/80">Your saved exam questions</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'profile-bookmarks' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]/40'
            }`} />
          </button>

          {/* Admin / Review Papers */}
          {isOwner && (
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer btn-quad-border ${
                currentTab === 'admin'
                  ? 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/40 shadow-md'
                  : 'text-emerald-400 hover:bg-emerald-500/10 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Moderation Panel</span>
                  <span className="text-[11px] text-emerald-400/70">Reports & submission review</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400/50 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* Drawer Footer / Theme & User Section */}
        <div className="p-4 border-t border-[var(--border-divider)] bg-[var(--surface-secondary)]/60 space-y-3">
          {/* Drawer Theme Switcher */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-xs">
            <span className="text-[var(--text-secondary)] font-medium">Appearance</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface-main)] text-[var(--text-primary)] font-semibold shadow-xs cursor-pointer btn-quad-border"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-300" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
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
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-elevated)] transition-all text-left cursor-pointer group btn-quad-border"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--border-divider)] flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.avatarInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent-blue)] transition-colors">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">
                    {currentUser.email}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]/50 group-hover:text-[var(--accent-blue)] group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  setIsLeftMenuOpen(false);
                }}
                className="w-full py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer btn-quad-border"
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
                className="w-full py-2.5 bg-[var(--accent-blue)] hover:opacity-95 text-white text-xs font-bold rounded-xl transition-all shadow-md text-center cursor-pointer btn-quad-border"
              >
                Sign In to Studify
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('signup')}
                className="w-full py-2 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-xl transition-all text-center cursor-pointer btn-quad-border"
              >
                Create Free Account
              </button>
            </div>
          )}

          <div className="text-[10px] text-[var(--text-secondary)]/70 text-center font-medium">
            100% Free Public Student Repository
          </div>
        </div>
      </aside>
    </>
  );
};
