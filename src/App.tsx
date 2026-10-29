import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { AuthPage } from './pages/AuthPage';
import { Paper, FilterState } from './types';
import { storageService } from './services/storage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { supabase } from './supabaseClient.js';
import { WorkspacePage } from './pages/WorkspacePage';
import { ExamPredictorPage } from './pages/ExamPredictorPage';
import { CommandCenter } from './components/workspace/CommandCenter';
import { QuickCaptureModal } from './components/workspace/QuickCaptureModal';
import { workspaceService } from './services/workspaceService';
import { supabaseStorage } from './services/supabaseStorage';

function MainApp() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [browseFilters, setBrowseFilters] = useState<Partial<FilterState> & { search?: string }>({});
  const [papers, setPapers] = useState<Paper[]>([]);
  const [savedPaperIds, setSavedPaperIds] = useState<string[]>([]);
  const [isLoginRequiredOpen, setIsLoginRequiredOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Student Workspace & Command Center State
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState<boolean>(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState<boolean>(false);
  const [selectedWorkspaceProjectId, setSelectedWorkspaceProjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loaded = storageService.getPapers();
    setPapers(loaded);
    setSavedPaperIds(storageService.getSavedPaperIds());

    // Hydrate saved bookmarks from Supabase for authenticated user
    storageService.fetchSavedPaperIdsFromSupabase().then((ids) => {
      if (ids && ids.length > 0) setSavedPaperIds(ids);
    });

    // Hydrate papers from Supabase if published in database
    storageService.fetchPapersFromSupabase().then((remotePapers) => {
      if (remotePapers && remotePapers.length > 0) {
        setPapers(remotePapers);
      }
    });

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
    } else if (path === 'exam-predictor' || path === 'predictor') {
      setCurrentTab('exam-predictor');
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
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isAuthenticated && (currentTab === 'login' || currentTab === 'signup')) {
      setCurrentTab('home');
    }
  }, [isAuthenticated, currentTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
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

    storageService.recordDownload(paper.id);
    setPapers(storageService.getPapers());

    // If paper has a fileUrl in Supabase Storage, retrieve private signed URL and download
    if (paper.fileUrl) {
      try {
        const signedUrl = await supabaseStorage.getSignedFileUrl(paper.fileUrl);
        if (signedUrl) {
          const a = document.createElement('a');
          a.href = signedUrl;
          a.download = paper.fileName || `${paper.subject}_${paper.year}.pdf`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          showToast('Download started');
          return;
        }
      } catch (err) {
        console.warn('Storage file download error, proceeding with document export', err);
      }
    }

    const questionsText = (paper.sections || [])
      .map(
        (sec) =>
          `\n--- ${sec.name}: ${sec.title} (${sec.totalMarks} Marks) ---\n` +
          (sec.instructions ? `Instructions: ${sec.instructions}\n\n` : '\n') +
          sec.questions
            .map(
              (q) =>
                `Q.${q.number} [${q.marks} Marks]\n${q.text}\n` +
                (q.formula ? `Formula: ${q.formula}\n` : '') +
                (q.choices
                  ? q.choices.map((c) => `  (${c.key}) ${c.text}`).join('\n') + '\n'
                  : '')
            )
            .join('\n')
      )
      .join('\n');

    const fileContent =
      `${paper.examBoard.toUpperCase()} — ${paper.grade}\n` +
      `Subject: ${paper.subject} (${paper.year})\n` +
      `Title: ${paper.title}\n` +
      `Total Marks: ${paper.totalMarks}\n` +
      `Time: ${paper.timeAllowedMinutes / 60} Hours\n\n` +
      `============================================================\n` +
      questionsText +
      `\n\n============================================================\n` +
      `Downloaded from Studify (100% Free Study Repository)\n`;

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (paper.fileName || `${paper.subject}_${paper.year}`).replace(/\.pdf$/i, '') + '.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Download started');
  };

  const handlePaperSubmitted = (newPaper: Paper) => {
    setPapers(storageService.getPapers());
  };

  const handlePaperUpdated = (updated: Paper) => {
    setPapers(storageService.getPapers());
    if (selectedPaper?.id === updated.id) {
      setSelectedPaper(updated);
    }
    showToast(updated.status === 'approved' ? 'Paper approved' : 'Paper updated');
  };

  const handlePaperDeleted = (id: string) => {
    setPapers(storageService.getPapers());
    if (selectedPaper?.id === id) {
      setSelectedPaper(null);
      setCurrentTab('browse');
    }
    showToast('Paper deleted');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#050914] text-[#F8FAFC] selection:bg-cyan-500/20 selection:text-cyan-200 relative overflow-x-hidden">
      {/* Visual reference atmospheric layered gradient background (deep navy, cyan, blue, emerald) */}
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
            savedPaperIds={savedPaperIds}
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
              onPaperDeleted={handlePaperDeleted}
              onRedirectToLogin={() => setCurrentTab('login')}
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
            onNavigateToPredictor={() => {
              setCurrentTab('exam-predictor');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            initialProjectId={selectedWorkspaceProjectId}
          />
        )}

        {currentTab === 'exam-predictor' && (
          <ExamPredictorPage
            papers={papers}
            onSelectPaper={handleSelectPaper}
            onDownloadPaper={handleDownloadPaper}
            onNavigateToWorkspace={() => {
              setCurrentTab('workspace');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Atmospheric Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-8 px-4 text-xs text-[#A7B4C8] text-center bg-[#0A1222]/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold text-white">
            <span className="text-cyan-400">Studify</span>
            <span className="text-white/20">·</span>
            <span className="text-[11px] text-[#A7B4C8] font-normal">Personal Study Workspace & PYQ Library</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[#A7B4C8]">
            <button onClick={() => setCurrentTab('home')} className="hover:text-white transition-colors">Home</button>
            <button onClick={() => setCurrentTab('workspace')} className="hover:text-cyan-400 font-semibold transition-colors">Study Workspace</button>
            <button onClick={() => setCurrentTab('exam-predictor')} className="hover:text-emerald-400 font-semibold transition-colors">Exam Predictor</button>
            <button onClick={() => setCurrentTab('browse')} className="hover:text-white transition-colors">Explore PYQs</button>
            <button onClick={() => setCurrentTab('about')} className="hover:text-white transition-colors">About</button>
            <button onClick={() => setCurrentTab('upload')} className="hover:text-white transition-colors">Upload</button>
            <button onClick={() => setCurrentTab('login')} className="hover:text-cyan-400 transition-colors">Sign In</button>
          </div>
          <p className="text-[11px] text-[#A7B4C8]/60">100% Free Public Student Workspace</p>
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

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#101B2D] text-[#F8FAFC] border border-white/[0.14] text-xs px-4 py-2.5 rounded-xl shadow-2xl shadow-cyan-950/80 animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
