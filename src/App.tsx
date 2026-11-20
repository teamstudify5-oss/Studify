import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { LoginRequiredModal } from './components/LoginRequiredModal';
import { LandingPage } from './pages/LandingPage';
import { AboutPage } from './pages/AboutPage';
import { BrowsePage } from './pages/BrowsePage';
import { PaperDetailsPage } from './pages/PaperDetailsPage';
import { ProfilePage } from './pages/ProfilePage';
import { UploadPage } from './pages/UploadPage';
import { AdminPage } from './pages/AdminPage';
import { SubmissionsPage } from './pages/SubmissionsPage';
import { AuthPage } from './pages/AuthPage';
import { Paper, FilterState } from './types';
import { storageService } from './services/storage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { supabase } from './supabaseClient.js';
import { WorkspacePage } from './pages/WorkspacePage';
import { CommandCenter } from './components/workspace/CommandCenter';
import { QuickCaptureModal } from './components/workspace/QuickCaptureModal';
import { workspaceService } from './services/workspaceService';
import { downloadPaperAsset } from './services/paperDownloadService';
import { DownloadLimitModal } from './components/DownloadLimitModal';
import { downloadQuotaService, DownloadQuota } from './services/downloadQuotaService';

function MainApp() {
  const { isAuthenticated, currentUser, authReady, openAuthModal } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('home');
  const currentTabRef = useRef<string>('home');
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [browseFilters, setBrowseFilters] = useState<Partial<FilterState> & { search?: string }>({});
  const [papers, setPapers] = useState<Paper[]>([]);
  const [savedPaperIds, setSavedPaperIds] = useState<string[]>([]);
  const [isLoginRequiredOpen, setIsLoginRequiredOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'info' | 'error'>('info');
  const activeDownloadsRef = useRef<Set<string>>(new Set());
  const [downloadingPaperIds, setDownloadingPaperIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);

  // Student Workspace & Command Center State
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState<boolean>(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState<boolean>(false);
  const [selectedWorkspaceProjectId, setSelectedWorkspaceProjectId] = useState<string | undefined>(undefined);

  // Feature 2: PDF Download Quota State
  const [isDownloadLimitModalOpen, setIsDownloadLimitModalOpen] = useState<boolean>(false);
  const [downloadQuota, setDownloadQuota] = useState<DownloadQuota | null>(null);

  useEffect(() => {
    downloadQuotaService.getQuota().then(setDownloadQuota);
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentUser?.id) {
      downloadQuotaService.mergeAnonymousQuotaIntoUser(currentUser.id).then(setDownloadQuota);
    } else {
      downloadQuotaService.getQuota().then(setDownloadQuota);
    }
  }, [isAuthenticated, currentUser?.id]);

  // Authoritatively hydrate PYQ library, bookmarks, and workspace references
  // once auth session hydration is ready AND whenever authentication state or user changes.
  useEffect(() => {
    if (!authReady) return;
    let active = true;

    const syncLibraryAndBookmarks = async () => {
      if (!isAuthenticated || !currentUser?.id) {
        workspaceService.clearLocalWorkspaceCache();
      }

      const [papersRes, savedRes] = await Promise.all([
        storageService.fetchPapersFromSupabaseWithStatus(),
        storageService.fetchSavedPaperIdsFromSupabaseWithStatus(),
      ]);

      if (!active) return;

      if (papersRes.synced) {
        setPapers(papersRes.papers);

        const validIds = new Set(papersRes.papers.map((p) => p.id));

        // Refresh selectedPaper from authoritative feed, but keep it intact when viewing
        // paper-details so PaperDetailsPage can render the official removal notice if unpublished.
        setSelectedPaper((prev) => {
          if (!prev) return null;
          if (!validIds.has(prev.id)) {
            return currentTabRef.current === 'paper-details' ? prev : null;
          }
          return papersRes.papers.find((p) => p.id === prev.id) || prev;
        });

        // Sync bookmarks and workspace projects without deleting references to
        // papers that may simply be pending, rejected, or unpublished.
        setSavedPaperIds(savedRes.synced ? savedRes.ids : []);

        if (isAuthenticated && currentUser?.id) {
          const wsRes = await workspaceService.fetchFromSupabase();
          if (active && wsRes.synced) {
            window.dispatchEvent(new CustomEvent('studify:workspace-updated'));
          }
        }
      } else {
        // Never silently display stale local papers when Supabase sync fails
        setPapers([]);
        setSavedPaperIds(savedRes.synced ? savedRes.ids : []);
        if (papersRes.error) {
          console.error('Failed to load Community PYQs from Supabase:', papersRes.error.message);
          showToast(papersRes.error.message || 'Could not load Community PYQs from Supabase.', 'error');
        }
      }
    };

    syncLibraryAndBookmarks();

    return () => {
      active = false;
    };
  }, [authReady, isAuthenticated, currentUser?.id]);

  useEffect(() => {
    const handleCachesCleared = () => {
      storageService.clearInMemoryState();
      setPapers([]);
      setSavedPaperIds([]);
      setSelectedPaper(null);
      downloadQuotaService.getQuota().then(setDownloadQuota);
    };
    window.addEventListener('studify:caches-cleared', handleCachesCleared);

    // Keyboard shortcut for Command Center (Cmd+K / Ctrl+K)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandCenterOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Check URL path on startup and protect private pages
    const path = window.location.pathname.replace(/^\//, '').toLowerCase();
    const privateRoutes = ['profile', 'profile-bookmarks', 'upload', 'admin', 'submissions'];

    if (path === 'workspace') {
      setCurrentTab('workspace');
    } else if (path === 'login') {
      setCurrentTab('login');
    } else if (path === 'signup') {
      setCurrentTab('signup');
    } else if (privateRoutes.includes(path)) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setCurrentTab('login');
          if (window.location.pathname !== '/login') {
            window.history.pushState(null, '', '/login');
          }
        } else {
          setCurrentTab(path);
        }
      });
    }

    const handlePopState = () => {
      const currentPath = window.location.pathname.replace(/^\//, '').toLowerCase();
      if (currentPath === 'login') {
        setCurrentTab('login');
      } else if (currentPath === 'signup') {
        setCurrentTab('signup');
      } else if (privateRoutes.includes(currentPath)) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) {
            setCurrentTab('login');
            if (window.location.pathname !== '/login') {
              window.history.pushState(null, '', '/login');
            }
          } else {
            setCurrentTab(currentPath);
          }
        });
      } else if (currentPath === '' || currentPath === 'home') {
        setCurrentTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('studify:caches-cleared', handleCachesCleared);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && (currentTab === 'login' || currentTab === 'signup')) {
      setCurrentTab('home');
    }
  }, [isAuthenticated, currentTab]);

  const showToast = (msg: string, variant: 'info' | 'error' = 'info') => {
    setToastVariant(variant);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), variant === 'error' ? 4000 : 2500);
  };

  const handleSelectPaper = (paper: Paper) => {
    setSelectedPaper(paper);
    setCurrentTab('paper-details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToBrowse = (filters?: Partial<FilterState> & { search?: string }) => {
    if (filters) {
      setBrowseFilters(filters);
    } else {
      setBrowseFilters({});
    }
    setCurrentTab('browse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookmarkPaper = (paper: Paper, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      setIsLoginRequiredOpen(true);
      return;
    }

    const wasAdded = storageService.toggleSavePaper(paper.id);
    setSavedPaperIds(storageService.getSavedPaperIds());
    showToast(wasAdded ? 'Saved to bookmarks' : 'Removed from bookmarks');
  };

  const handleDownloadPaper = async (paper: Paper, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (activeDownloadsRef.current.has(paper.id)) {
      return;
    }

    // Enforce download quota before starting download
    const quotaCheck = await downloadQuotaService.canDownload();
    setDownloadQuota(quotaCheck.quota);

    if (!quotaCheck.allowed) {
      setIsDownloadLimitModalOpen(true);
      return;
    }

    activeDownloadsRef.current.add(paper.id);
    setDownloadingPaperIds(new Set(activeDownloadsRef.current));
    try {
      const result = await downloadPaperAsset(paper);

      // Record download & quota ONLY after asset download actually succeeds
      storageService.recordDownload(paper.id);
      setPapers(storageService.getPapers());

      const recordResult = await downloadQuotaService.recordSuccessfulDownload(paper.id, paper.title);
      setDownloadQuota(recordResult.quota);

      const remainingNotice =
        recordResult.quota.remainingDownloads > 0
          ? `(${recordResult.quota.remainingDownloads} free downloads left)`
          : '(10/10 downloads used)';

      const prefix =
        result.kind === 'zip'
          ? 'Downloaded ZIP bundle'
          : 'Download started';

      showToast(`${prefix} ${remainingNotice}`);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Could not download this paper. Please try again.';
      showToast(message, 'error');
    } finally {
      activeDownloadsRef.current.delete(paper.id);
      setDownloadingPaperIds(new Set(activeDownloadsRef.current));
    }
  };

  const handlePaperSubmitted = (_newPaper: Paper) => {
    setPapers(storageService.getPapers());
    storageService.fetchPapersFromSupabaseWithStatus().then((res) => {
      if (res.synced) {
        setPapers(res.papers);
      }
    });
  };

  const handlePaperUpdated = (updated: Paper) => {
    if (updated.status === 'removed' || updated.isRemoved) {
      storageService.removePaperFromLocalCache(updated.id);
      setPapers(storageService.getPapers().filter((p) => p.id !== updated.id));
      if (selectedPaper?.id === updated.id) {
        setSelectedPaper(updated);
      }
      showToast('Paper unpublished reversibly');
      return;
    }

    storageService.savePaper(updated);
    setPapers(storageService.getPapers());
    if (selectedPaper?.id === updated.id) {
      setSelectedPaper(updated);
    }
    storageService.fetchPapersFromSupabaseWithStatus().then((res) => {
      if (res.synced) {
        setPapers(res.papers);
      }
    });
    showToast(updated.status === 'approved' || updated.status === 'active' ? 'Paper published to library' : 'Paper updated');
  };

  const handlePaperDeleted = (id: string) => {
    storageService.removePaperFromLocalCache(id);
    workspaceService.removePaperReferenceEverywhere(id);
    setPapers(storageService.getPapers());
    setSavedPaperIds(storageService.getSavedPaperIds());
    if (selectedPaper?.id === id) {
      setSelectedPaper(null);
      if (currentTab === 'paper-details') {
        setCurrentTab('browse');
      }
    }
    Promise.all([
      storageService.fetchPapersFromSupabaseWithStatus(),
      storageService.fetchSavedPaperIdsFromSupabaseWithStatus(),
    ]).then(([papersRes, savedRes]) => {
      if (papersRes.synced) {
        setPapers(papersRes.papers);
      }
      if (savedRes.synced) {
        setSavedPaperIds(savedRes.ids);
      }
    });
    showToast('Paper deleted');
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[var(--text-primary)] transition-colors duration-200 relative overflow-x-hidden">
      {/* Visual reference atmospheric layered gradient background */}
      <div className="atmospheric-bg" aria-hidden="true" />

      {/* Floating Top Navigation */}
      <div className="relative z-30 pt-2 sm:pt-4">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            const privateRoutes = ['profile', 'profile-bookmarks', 'upload', 'admin', 'submissions'];
            if (privateRoutes.includes(tab)) {
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (!session) {
                  setCurrentTab('login');
                  if (window.location.pathname !== '/login') {
                    window.history.pushState(null, '', '/login');
                  }
                  return;
                }
                setCurrentTab(tab);
                workspaceService.recordSessionState({ lastActiveTab: tab });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              });
              return;
            }
            setCurrentTab(tab);
            workspaceService.recordSessionState({ lastActiveTab: tab });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onRequireLogin={() => setIsLoginRequiredOpen(true)}
          onOpenCommandCenter={() => setIsCommandCenterOpen(true)}
          onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
        />
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 relative z-10 pb-12">
        {currentTab === 'home' && (
          <LandingPage
            samplePapers={papers}
            onNavigateToSearch={() => {
              setCurrentTab('browse');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectPaper={handleSelectPaper}
          />
        )}

        {currentTab === 'about' && (
          <AboutPage
            onExploreMaterials={() => {
              setCurrentTab('browse');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateToHome={() => {
              setCurrentTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentTab === 'browse' && (
          <BrowsePage
            papers={papers}
            initialFilters={browseFilters}
            onSelectPaper={handleSelectPaper}
            onDownloadPaper={handleDownloadPaper}
            onBookmarkPaper={handleBookmarkPaper}
            onPaperUpdated={handlePaperUpdated}
            onPaperDeleted={handlePaperDeleted}
            savedPaperIds={savedPaperIds}
            downloadingPaperIds={downloadingPaperIds}
          />
        )}

        {currentTab === 'paper-details' && selectedPaper && (
          <PaperDetailsPage
            paper={selectedPaper}
            allPapers={papers}
            onBack={() => setCurrentTab('browse')}
            onSelectPaper={handleSelectPaper}
            onDownloadPaper={handleDownloadPaper}
            onBookmarkPaper={handleBookmarkPaper}
            isBookmarked={savedPaperIds.includes(selectedPaper.id)}
            onRequireLogin={() => setIsLoginRequiredOpen(true)}
            onPaperUpdated={handlePaperUpdated}
            onPaperDeleted={handlePaperDeleted}
            downloadingPaperIds={downloadingPaperIds}
          />
        )}

        {(currentTab === 'profile' || currentTab === 'profile-bookmarks') && (
          <ProtectedRoute onRedirectToLogin={() => setCurrentTab('login')}>
            <ProfilePage
              papers={papers}
              initialSection={currentTab === 'profile-bookmarks' ? 'bookmarks' : 'overview'}
              onSelectPaper={handleSelectPaper}
              onNavigateToBrowse={() => {
                setCurrentTab('browse');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigateToUpload={() => {
                setCurrentTab('upload');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onDownloadPaper={handleDownloadPaper}
              onBookmarkPaper={handleBookmarkPaper}
              savedPaperIds={savedPaperIds}
              onPaperUpdated={handlePaperUpdated}
              onPaperDeleted={handlePaperDeleted}
              onRedirectToLogin={() => setCurrentTab('login')}
              downloadingPaperIds={downloadingPaperIds}
            />
          </ProtectedRoute>
        )}

        {currentTab === 'upload' && (
          <ProtectedRoute onRedirectToLogin={() => setCurrentTab('login')}>
            <UploadPage
              onPaperSubmitted={handlePaperSubmitted}
              onNavigateToSubmissions={() => {
                setCurrentTab('profile');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onNavigateToBrowse={() => {
                setCurrentTab('browse');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onRedirectToLogin={() => setCurrentTab('login')}
            />
          </ProtectedRoute>
        )}

        {currentTab === 'admin' && (
          <ProtectedRoute onRedirectToLogin={() => setCurrentTab('login')}>
            <AdminPage
              papers={papers}
              onPaperUpdated={handlePaperUpdated}
              onPaperDeleted={handlePaperDeleted}
              onSelectPaper={handleSelectPaper}
              onRedirectToLogin={() => setCurrentTab('login')}
            />
          </ProtectedRoute>
        )}

        {currentTab === 'submissions' && (
          <ProtectedRoute onRedirectToLogin={() => setCurrentTab('login')}>
            <SubmissionsPage
              papers={papers}
              onSelectPaper={handleSelectPaper}
              onNavigateToUpload={() => {
                setCurrentTab('upload');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPaperDeleted={handlePaperDeleted}
              onPaperUpdated={handlePaperUpdated}
              onRedirectToLogin={() => setCurrentTab('login')}
            />
          </ProtectedRoute>
        )}

        {(currentTab === 'login' || currentTab === 'signup') && (
          <AuthPage
            initialMode={currentTab === 'signup' ? 'signup' : 'login'}
            onSwitchMode={(mode) => {
              setCurrentTab(mode);
              try {
                const url = new URL(window.location.href);
                url.pathname = `/${mode}`;
                window.history.pushState(null, '', url.toString());
              } catch {
                // ignore
              }
            }}
            onNavigateToHome={() => {
              setCurrentTab('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onNavigateToBrowse={() => {
              setCurrentTab('browse');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentTab === 'workspace' && (
          <WorkspacePage
            papers={papers}
            onSelectPaper={handleSelectPaper}
            onDownloadPaper={handleDownloadPaper}
            onNavigateToBrowse={() => {
              setCurrentTab('browse');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            initialProjectId={selectedWorkspaceProjectId}
          />
        )}
      </main>

      {/* Atmospheric Footer */}
      <footer className="relative z-10 border-t border-[var(--border-divider)] py-8 px-4 text-xs text-[var(--text-secondary)] text-center bg-[var(--surface-main)]/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-[var(--text-primary)]">
            <span className="text-[var(--accent-blue)]">Studify</span>
            <span className="text-[var(--border-divider)]">·</span>
            <span className="text-[11px] text-[var(--text-secondary)] font-normal">Personal Study Workspace & PYQ Library</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--text-secondary)]">
            <button onClick={() => setCurrentTab('home')} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">Home</button>
            <button onClick={() => setCurrentTab('workspace')} className="hover:text-[var(--accent-blue)] font-semibold transition-colors cursor-pointer">Study Workspace</button>
            <button onClick={() => setCurrentTab('browse')} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">Explore PYQs</button>
            <button onClick={() => setCurrentTab('about')} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">About</button>
            <button onClick={() => setCurrentTab('upload')} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">Upload</button>
            <button onClick={() => setCurrentTab('login')} className="hover:text-[var(--accent-blue)] transition-colors cursor-pointer">Sign In</button>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]/70">100% Free Public Student Workspace</p>
        </div>
      </footer>

      {/* Universal Command Center Modal (Cmd+K / Ctrl+K) */}
      <CommandCenter
        isOpen={isCommandCenterOpen}
        onClose={() => setIsCommandCenterOpen(false)}
        papers={papers}
        onNavigate={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSelectPaper={handleSelectPaper}
        onOpenProject={(projectId) => {
          setSelectedWorkspaceProjectId(projectId);
          setCurrentTab('workspace');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
      />

      {/* Global Quick Capture Modal */}
      <QuickCaptureModal
        isOpen={isQuickCaptureOpen}
        onClose={() => setIsQuickCaptureOpen(false)}
        onSaved={(title) => showToast(`Captured: ${title}`)}
      />

      {/* Sign-in Modal */}
      <AuthModal />

      {/* "Make Studify Yours" Login Required Dialog */}
      <LoginRequiredModal
        isOpen={isLoginRequiredOpen}
        onClose={() => setIsLoginRequiredOpen(false)}
        onSignIn={() => openAuthModal('login')}
        onCreateAccount={() => openAuthModal('signup')}
      />

      {/* Feature 2: PDF Download Quota Exhausted & Contribution Unlock Modal */}
      <DownloadLimitModal
        isOpen={isDownloadLimitModalOpen}
        onClose={() => setIsDownloadLimitModalOpen(false)}
        quota={downloadQuota}
        isAuthenticated={isAuthenticated}
        onNavigateToUpload={() => {
          setIsDownloadLimitModalOpen(false);
          setCurrentTab('upload');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onRequireLogin={() => {
          setIsDownloadLimitModalOpen(false);
          setIsLoginRequiredOpen(true);
        }}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 bg-[var(--surface-main)] text-[var(--text-primary)] border text-xs px-3.5 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2 ${
            toastVariant === 'error'
              ? 'border-[var(--color-red)]/50'
              : 'border-[var(--border-divider)]'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              toastVariant === 'error' ? 'bg-[var(--color-red)]' : 'bg-[var(--accent-blue)]'
            }`}
          />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
