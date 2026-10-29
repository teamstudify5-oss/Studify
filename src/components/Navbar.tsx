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
  Command
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
        <div className="bg-[#0A1222]/85 backdrop-blur-xl border border-white/[0.12] rounded-2xl px-3 sm:px-6 h-15 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 shadow-2xl shadow-cyan-950/20">
          
          {/* Left: Left Side Menu Toggle Button + Brand Wordmark (Studify remains as it is) */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Left Side Menu Toggle Button — replaces the old horizontal scrolling bar */}
            <button
              type="button"
              onClick={() => setIsLeftMenuOpen(true)}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/[0.06] hover:bg-cyan-500/15 border border-white/[0.12] hover:border-cyan-400/40 text-cyan-300 hover:text-white transition-all flex items-center gap-2 cursor-pointer group shadow-sm shrink-0"
              aria-label="Open Left Side Menu"
              title="Open Navigation Menu"
            >
              <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold text-[#F8FAFC] hidden sm:inline">Menu</span>
            </button>

            {/* Brand Wordmark — preserves exact layout, styling & branding */}
            <button
              type="button"
              onClick={() => setCurrentTab('home')}
              className="flex items-center gap-2 sm:gap-2.5 text-left group shrink-0 cursor-pointer"
            >
              <div className="w-7 h-7 sm:w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 via-teal-500/20 to-emerald-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform shadow-sm shadow-cyan-500/20">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base font-bold tracking-tight text-[#F8FAFC] group-hover:text-cyan-300 transition-colors">
                  Studify
                </span>
                <span className="text-[10px] text-[#A7B4C8] font-medium tracking-wide hidden lg:inline">
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
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.1] text-xs text-[#A7B4C8] hover:text-white transition-all cursor-pointer"
                title="Search everything (Cmd+K)"
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span>Search</span>
                <kbd className="text-[10px] bg-white/[0.08] px-1.5 py-0.5 rounded text-white/80 font-mono">⌘K</kbd>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentTab('workspace')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                currentTab === 'workspace'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                  : 'text-[#A7B4C8] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-cyan-400" />
              <span>Workspace</span>
            </button>

            {onOpenQuickCapture && (
              <button
                type="button"
                onClick={onOpenQuickCapture}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                title="Quick Capture (Thought, Formula, Link)"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Capture</span>
              </button>
            )}
          </div>

          {/* Right CTA / User Identity */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-[#101B2D] hover:bg-[#15233D] border border-white/[0.14] text-xs font-medium text-[#F8FAFC] transition-all cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 text-cyan-300 flex items-center justify-center font-bold text-[10px]">
                    {currentUser?.avatarInitials}
                  </div>
                  <span className="max-w-[70px] sm:max-w-[100px] truncate hidden sm:inline">{currentUser?.name.split(' ')[0]}</span>
                </button>

                {profileDropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 bg-[#101B2D] border border-white/[0.14] rounded-2xl p-2.5 z-50 text-xs shadow-2xl shadow-cyan-950/40 animate-in fade-in"
                    onMouseLeave={() => setProfileDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-white/[0.08] mb-1.5">
                      <div className="font-semibold text-white truncate">{currentUser?.name}</div>
                      <div className="text-[11px] text-[#A7B4C8] truncate">{currentUser?.email}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('profile');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.08] text-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      <span>My Profile & Library</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentTab('profile-bookmarks');
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.08] text-[#F8FAFC] flex items-center gap-2 cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Bookmarked Papers</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setProfileDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 flex items-center gap-2 mt-1 border-t border-white/[0.06] pt-2 cursor-pointer"
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
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer"
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
        className={`fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[#0A1222]/98 backdrop-blur-2xl border-r border-white/[0.14] z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          isLeftMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation Menu"
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.1] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 via-teal-500/20 to-emerald-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-sm shadow-cyan-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-[#F8FAFC]">
                Studify
              </span>
              <span className="text-[10px] text-[#A7B4C8]">
                Past Papers & Study Library
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsLeftMenuOpen(false)}
            className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] flex items-center justify-center text-[#A7B4C8] hover:text-white transition-all cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items in Left Side Menu */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin">
          <div className="px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase text-cyan-400/90 font-semibold flex items-center justify-between">
            <span>Student Workspace</span>
            <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono">NEW</span>
          </div>

          {/* Study Workspace */}
          <button
            type="button"
            onClick={() => handleNavClick('workspace')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
              currentTab === 'workspace'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 font-semibold border border-cyan-400/30 shadow-md shadow-cyan-950/20'
                : 'text-[#A7B4C8] hover:text-[#F8FAFC] hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'workspace' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.05] text-[#A7B4C8] group-hover:text-cyan-300'
              }`}>
                <Folder className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Study Workspace</span>
                <span className="text-[11px] text-[#A7B4C8]/70">Personal desktop, projects & notes</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'workspace' ? 'text-cyan-400' : 'text-white/20'
            }`} />
          </button>

          {/* Exam Paper Predictor */}
          <button
            type="button"
            onClick={() => handleNavClick('exam-predictor')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
              currentTab === 'exam-predictor'
                ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 font-semibold border border-emerald-400/30 shadow-md'
                : 'text-[#A7B4C8] hover:text-[#F8FAFC] hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'exam-predictor' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.05] text-[#A7B4C8] group-hover:text-emerald-300'
              }`}>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Exam Predictor</span>
                <span className="text-[11px] text-[#A7B4C8]/70">Rule-based pattern analysis & mocks</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'exam-predictor' ? 'text-emerald-400' : 'text-white/20'
            }`} />
          </button>

          <div className="pt-2 px-3 py-1 text-[10px] font-mono tracking-wider uppercase text-[#A7B4C8]/60 font-semibold">
            Public Library
          </div>

          {/* Home */}
          <button
            type="button"
            onClick={() => handleNavClick('home')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
              currentTab === 'home'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 font-semibold border border-cyan-400/30 shadow-md shadow-cyan-950/20'
                : 'text-[#A7B4C8] hover:text-[#F8FAFC] hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'home' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.05] text-[#A7B4C8] group-hover:text-cyan-300'
              }`}>
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Home</span>
                <span className="text-[11px] text-[#A7B4C8]/70">Explore highlights & library overview</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'home' ? 'text-cyan-400' : 'text-white/20'
            }`} />
          </button>

          {/* Explore PYQs */}
          <button
            type="button"
            onClick={() => handleNavClick('browse')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
              currentTab === 'browse'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 font-semibold border border-cyan-400/30 shadow-md shadow-cyan-950/20'
                : 'text-[#A7B4C8] hover:text-[#F8FAFC] hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'browse' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.05] text-[#A7B4C8] group-hover:text-cyan-300'
              }`}>
                <Search className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Explore PYQs</span>
                <span className="text-[11px] text-[#A7B4C8]/70">Browse previous year papers & questions</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'browse' ? 'text-cyan-400' : 'text-white/20'
            }`} />
          </button>

          {/* About */}
          <button
            type="button"
            onClick={() => handleNavClick('about')}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
              currentTab === 'about'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 font-semibold border border-cyan-400/30 shadow-md shadow-cyan-950/20'
                : 'text-[#A7B4C8] hover:text-[#F8FAFC] hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'about' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.05] text-[#A7B4C8] group-hover:text-cyan-300'
              }`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">About</span>
                <span className="text-[11px] text-[#A7B4C8]/70">Our educational mission & story</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'about' ? 'text-cyan-400' : 'text-white/20'
            }`} />
          </button>

          {/* Upload */}
          <button
            type="button"
            onClick={handleUploadClick}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
              currentTab === 'upload'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 font-semibold border border-cyan-400/30 shadow-md shadow-cyan-950/20'
                : 'text-[#A7B4C8] hover:text-[#F8FAFC] hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'upload' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.05] text-[#A7B4C8] group-hover:text-cyan-300'
              }`}>
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Upload Paper</span>
                <span className="text-[11px] text-[#A7B4C8]/70">Contribute new study materials</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'upload' ? 'text-cyan-400' : 'text-white/20'
            }`} />
          </button>

          {/* Bookmarks */}
          <button
            type="button"
            onClick={handleBookmarksClick}
            className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
              currentTab === 'profile-bookmarks'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 font-semibold border border-cyan-400/30 shadow-md shadow-cyan-950/20'
                : 'text-[#A7B4C8] hover:text-[#F8FAFC] hover:bg-white/[0.05] border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${
                currentTab === 'profile-bookmarks' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/[0.05] text-[#A7B4C8] group-hover:text-cyan-300'
              }`}>
                <Bookmark className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Bookmarks</span>
                <span className="text-[11px] text-[#A7B4C8]/70">Your saved exam questions</span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              currentTab === 'profile-bookmarks' ? 'text-cyan-400' : 'text-white/20'
            }`} />
          </button>

          {/* Admin / Review Papers */}
          {isOwner && (
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                currentTab === 'admin'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-md'
                  : 'text-emerald-400/90 hover:text-emerald-300 hover:bg-emerald-500/10 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Review Papers</span>
                  <span className="text-[11px] text-emerald-300/60">Admin moderation queue</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400/50 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* Drawer Footer / User Section */}
        <div className="p-4 border-t border-white/[0.1] bg-[#070D18]/90 space-y-3">
          {isAuthenticated && currentUser ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.06] transition-all text-left cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 text-cyan-300 border border-cyan-400/30 flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.avatarInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-[#A7B4C8] truncate">
                    {currentUser.email}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
              </button>

              <button
                type="button"
                onClick={() => {
                  logout();
                  setIsLeftMenuOpen(false);
                }}
                className="w-full py-2 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
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
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20 text-center cursor-pointer"
              >
                Sign In to Studify
              </button>
              <button
                type="button"
                onClick={() => handleNavClick('signup')}
                className="w-full py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-[#F8FAFC] text-xs font-medium rounded-xl transition-all text-center cursor-pointer"
              >
                Create Free Account
              </button>
            </div>
          )}

          <div className="text-[10px] text-[#A7B4C8]/60 text-center font-medium">
            100% Free Public Student Repository
          </div>
        </div>
      </aside>
    </>
  );
};
