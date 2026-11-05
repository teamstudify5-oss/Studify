import React, { useState, useEffect } from 'react';
import { 
  User, 
  Bookmark, 
  UploadCloud, 
  Star, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  Download, 
  Trash2, 
  Eye, 
  PlusCircle, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Edit2
} from 'lucide-react';
import { Paper } from '../types';
import { PaperRemovalRequest } from '../types/removal';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storage';
import { removalService } from '../services/removalService';
import { PaperCard } from '../components/PaperCard';
import { supabase } from '../supabaseClient.js';
import { EditCommunityPyqModal } from '../components/EditCommunityPyqModal';

interface ProfilePageProps {
  papers: Paper[];
  initialSection?: 'overview' | 'bookmarks' | 'uploads' | 'removal_requests' | 'reviews' | 'settings';
  onSelectPaper: (paper: Paper) => void;
  onNavigateToBrowse: () => void;
  onNavigateToUpload: () => void;
  onDownloadPaper: (paper: Paper, e?: React.MouseEvent) => void;
  onBookmarkPaper: (paper: Paper, e: React.MouseEvent) => void;
  savedPaperIds: string[];
  onPaperDeleted: (id: string) => void;
  onRedirectToLogin?: () => void;
}

type ProfileSection = 'overview' | 'bookmarks' | 'uploads' | 'removal_requests' | 'reviews' | 'settings';

export const ProfilePage: React.FC<ProfilePageProps> = ({
  papers,
  initialSection = 'overview',
  onSelectPaper,
  onNavigateToBrowse,
  onNavigateToUpload,
  onDownloadPaper,
  onBookmarkPaper,
  savedPaperIds,
  onPaperDeleted,
  onRedirectToLogin,
}) => {
  const { currentUser, isAuthenticated, logout, openAuthModal } = useAuth();
  const [activeSection, setActiveSection] = useState<ProfileSection>(initialSection);
  const [editingUpload, setEditingUpload] = useState<Paper | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        if (window.location.pathname !== '/login') {
          window.history.pushState(null, '', '/login');
        }
        if (onRedirectToLogin) {
          onRedirectToLogin();
        } else {
          window.location.href = '/login';
        }
      }
    });
  }, [onRedirectToLogin]);

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl flex items-center justify-center mx-auto text-[var(--accent-blue)] shadow-xs">
          <User className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Sign in to view your library
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-sm mx-auto">
          Access your personal study library, bookmarked question papers, uploaded materials, and community reviews.
        </p>
        <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="w-full py-2.5 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 shadow-xs cursor-pointer btn-quad-border"
          >
            Sign In to Studify
          </button>
        </div>
      </div>
    );
  }

  const [totalNotes, setTotalNotes] = useState<number>(0);

  const fetchProfileNotesCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setTotalNotes(0);
        return;
      }
      const { count, error } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) {
        return;
      }
      setTotalNotes(count ?? 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchProfileNotesCount();

    const channel = supabase
      .channel('profile-notes-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        fetchProfileNotesCount();
      })
      .subscribe();

    const handleNotesUpdated = () => {
      fetchProfileNotesCount();
    };
    window.addEventListener('studify:notes-updated', handleNotesUpdated);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('studify:notes-updated', handleNotesUpdated);
    };
  }, []);

  const bookmarkedPapers = papers.filter((p) => savedPaperIds.includes(p.id));
  const userUploads = papers.filter((p) => p.submittedBy.id === currentUser.id);

  // Removal requests state targeted at this uploader
  const [removalRequests, setRemovalRequests] = useState<PaperRemovalRequest[]>([]);

  const refreshRemovalRequests = () => {
    if (currentUser?.id) {
      removalService.getRequestsForUploader(currentUser.id, currentUser.email).then((data) => {
        setRemovalRequests(data);
      });
    }
  };

  useEffect(() => {
    refreshRemovalRequests();
    const handleUpdate = () => refreshRemovalRequests();
    window.addEventListener('studify:removal-requests-updated', handleUpdate);
    return () => window.removeEventListener('studify:removal-requests-updated', handleUpdate);
  }, [currentUser]);

  const pendingRemovalRequests = removalRequests.filter((r) => r.status === 'pending');

  const userReviews = papers.flatMap((p) =>
    (p.reviews || [])
      .filter((r) => r.authorName.toLowerCase() === currentUser.name.toLowerCase() || r.authorName === 'Student Reviewer')
      .map((r) => ({ review: r, paper: p }))
  );

  const totalDownloadsOfUserPapers = userUploads.reduce((acc, p) => acc + (p.downloadsCount || 0), 0);

  const handleDeleteUpload = (id: string) => {
    if (window.confirm('Delete this submission permanently?')) {
      storageService.deletePaper(id);
      onPaperDeleted(id);
    }
  };

  const handleDismissRemovalRequest = (requestId: string) => {
    removalService.dismissRequest(requestId);
    refreshRemovalRequests();
  };

  const handleAcceptRemovalRequest = (requestId: string, paperId: string) => {
    if (window.confirm('Are you sure you want to remove this paper permanently from Studify as requested?')) {
      removalService.removePaperViaRequest(requestId, paperId);
      onPaperDeleted(paperId);
      refreshRemovalRequests();
    }
  };

  const navItems: { id: ProfileSection; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { id: 'overview', label: 'Overview', icon: <User className="w-4 h-4" /> },
    { id: 'bookmarks', label: 'Bookmarked Papers', icon: <Bookmark className="w-4 h-4" />, badge: bookmarkedPapers.length },
    { id: 'uploads', label: 'My Uploads', icon: <UploadCloud className="w-4 h-4" />, badge: userUploads.length },
    { 
      id: 'removal_requests', 
      label: 'Removal Requests', 
      icon: <ShieldCheck className="w-4 h-4 text-[var(--color-yellow)]" />, 
      badge: pendingRemovalRequests.length,
      badgeColor: pendingRemovalRequests.length > 0 ? 'bg-[var(--accent-red-bg)] text-[var(--color-red)] font-bold' : undefined
    },
    { id: 'reviews', label: 'My Reviews', icon: <Star className="w-4 h-4" />, badge: userReviews.length },
    { id: 'settings', label: 'Account Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Mobile Top Navigation Tabs */}
      <div className="lg:hidden flex overflow-x-auto gap-2 pb-3 mb-5 border-b border-[var(--border-divider)]">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSection(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer btn-quad-border ${
              activeSection === item.id
                ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
                : 'bg-[var(--surface-main)]/85 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-divider)]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-[var(--surface-elevated)] text-[var(--text-primary)] font-mono">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar Rail (Desktop) */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-20 space-y-3">
          {/* User ID Card */}
          <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-bold text-sm flex items-center justify-center shrink-0">
                {currentUser.avatarInitials}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {currentUser.name}
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                  {currentUser.email}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium uppercase tracking-wider bg-[var(--surface-elevated)] text-[var(--accent-blue)]">
                    {currentUser.role === 'owner' ? 'Owner / Admin' : 'Student'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Navigation Rail */}
          <nav className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-1.5 shadow-xs space-y-1 text-xs">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-medium transition-colors text-left cursor-pointer btn-quad-border ${
                  activeSection === item.id
                    ? 'bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded ${
                    activeSection === item.id ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}

            <div className="pt-1.5 mt-1.5 border-t border-[var(--border-divider)]">
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[var(--color-red)] hover:bg-[var(--accent-red-bg)] transition-colors text-xs cursor-pointer btn-quad-border"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Right Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* SECTION: OVERVIEW */}
          {activeSection === 'overview' && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  Welcome back, {currentUser.name.split(' ')[0]}
                </h1>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                  Manage your personal exam library, tracked papers, and uploaded past exams.
                </p>
              </div>

              {/* Pending Removal Requests Banner for Uploader */}
              {pendingRemovalRequests.length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--surface-main)] border border-[var(--color-yellow)]/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                          {pendingRemovalRequests.length} Pending Paper Removal Request{pendingRemovalRequests.length > 1 ? 's' : ''}
                        </h3>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[var(--accent-red-bg)] text-[var(--color-red)]">
                          Review Needed
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Students or reviewers requested the removal of paper(s) you uploaded.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSection('removal_requests')}
                    className="px-3 py-1.5 bg-[var(--accent-blue)] text-white dark:text-[#1C2530] text-xs font-semibold rounded-lg shrink-0 cursor-pointer"
                  >
                    Review Requests →
                  </button>
                </div>
              )}

              {/* Metric Statistics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-divider)] shadow-xs">
                <div 
                  onClick={() => setActiveSection('bookmarks')}
                  className="p-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
                    <span>Saved Papers</span>
                    <Bookmark className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                  </div>
                  <div className="mt-1 text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">
                    {bookmarkedPapers.length}
                  </div>
                  <div className="text-[11px] text-[var(--accent-blue)] hover:underline mt-0.5">
                    View saved →
                  </div>
                </div>

                <div 
                  onClick={() => setActiveSection('uploads')}
                  className="p-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
                    <span>My Uploads</span>
                    <UploadCloud className="w-3.5 h-3.5 text-[var(--color-green)]" />
                  </div>
                  <div className="mt-1 text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">
                    {userUploads.length}
                  </div>
                  <div className="text-[11px] text-[var(--accent-blue)] hover:underline mt-0.5">
                    View materials →
                  </div>
                </div>

                <div 
                  onClick={() => setActiveSection('reviews')}
                  className="p-4 cursor-pointer hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
                    <span>Total Notes</span>
                    <Star className="w-3.5 h-3.5 text-[var(--color-yellow)]" />
                  </div>
                  <div className="mt-1 text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">
                    {totalNotes}
                  </div>
                  <div className="text-[11px] text-[var(--color-yellow)] hover:underline mt-0.5">
                    View notes →
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between text-[var(--text-secondary)] text-xs">
                    <span>Downloads</span>
                    <Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                  <div className="mt-1 text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">
                    {totalDownloadsOfUserPapers}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Total student reads
                  </div>
                </div>
              </div>

              {/* Quick Action Shortcuts */}
              <div className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="space-y-0.5 text-center sm:text-left">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Need to find a question paper for revision?
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Explore 100% free CBSE, ICSE, JEE, and NEET past papers.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={onNavigateToBrowse}
                    className="px-3.5 py-1.5 bg-[var(--accent-blue)] text-white dark:text-[#1C2530] text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Explore PYQs
                  </button>
                  <button
                    onClick={onNavigateToUpload}
                    className="px-3.5 py-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    Upload Paper
                  </button>
                </div>
              </div>

              {/* Recent Bookmarks Preview */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Recently Saved Papers
                  </h3>
                  {bookmarkedPapers.length > 0 && (
                    <button
                      onClick={() => setActiveSection('bookmarks')}
                      className="text-xs text-[var(--accent-blue)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>View all ({bookmarkedPapers.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {bookmarkedPapers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {bookmarkedPapers.slice(0, 2).map((paper) => (
                      <PaperCard
                        key={paper.id}
                        paper={paper}
                        onSelect={onSelectPaper}
                        onDownload={onDownloadPaper}
                        onBookmark={onBookmarkPaper}
                        isBookmarked={true}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] space-y-1.5">
                    <p>No papers bookmarked yet.</p>
                    <button
                      onClick={onNavigateToBrowse}
                      className="text-[var(--accent-blue)] hover:underline font-medium cursor-pointer"
                    >
                      Browse question papers to save for later →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECTION: BOOKMARKS */}
          {activeSection === 'bookmarks' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                    Bookmarked Papers
                  </h1>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Question papers you saved for quick study and offline practice.
                  </p>
                </div>

                <button
                  onClick={onNavigateToBrowse}
                  className="px-3 py-1.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] text-xs font-medium text-[var(--accent-blue)] rounded-lg transition-colors cursor-pointer"
                >
                  Browse More
                </button>
              </div>

              {bookmarkedPapers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bookmarkedPapers.map((paper) => (
                    <PaperCard
                      key={paper.id}
                      paper={paper}
                      onSelect={onSelectPaper}
                      onDownload={onDownloadPaper}
                      onBookmark={onBookmarkPaper}
                      isBookmarked={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-6 space-y-2.5">
                  <Bookmark className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">No bookmarked papers</h3>
                  <p className="max-w-xs mx-auto">
                    Click the bookmark icon on any paper to save it to your personal library.
                  </p>
                  <button
                    onClick={onNavigateToBrowse}
                    className="mt-1 px-4 py-2 bg-[var(--accent-blue)] text-white dark:text-[#1C2530] text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    Explore Question Papers
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: UPLOADS */}
          {activeSection === 'uploads' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                    My Uploaded Papers
                  </h1>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Track moderation status, community reads, and student feedback.
                  </p>
                </div>

                <button
                  onClick={onNavigateToUpload}
                  className="px-3 py-1.5 bg-[var(--accent-blue)] text-white dark:text-[#1C2530] text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Upload Paper</span>
                </button>
              </div>

              {userUploads.length > 0 ? (
                <div className="space-y-3">
                  {userUploads.map((paper) => (
                    <div
                      key={paper.id}
                      className="bg-[var(--surface-main)] border border-[var(--border-divider)] hover:border-[var(--border-hover)] rounded-xl p-4 shadow-xs space-y-2.5 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {paper.title}
                          </h3>
                          <div className="text-xs text-[var(--text-secondary)] flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[var(--accent-blue)]">{paper.examBoard}</span>
                            <span className="text-[var(--text-muted)] opacity-60">·</span>
                            <span>{paper.grade}</span>
                            <span className="text-[var(--text-muted)] opacity-60">·</span>
                            <span>{paper.subject} ({paper.year})</span>
                            <span className="text-[var(--text-muted)] opacity-60">·</span>
                            <span className="font-mono text-[11px] text-[var(--text-muted)]">
                              Submitted {new Date(paper.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge & Actions */}
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          {paper.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)]">
                              Waiting for review
                            </span>
                          )}
                          {paper.status === 'approved' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--accent-green-bg)] text-[var(--color-green)] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approved</span>
                            </span>
                          )}
                          {paper.status === 'rejected' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--accent-red-bg)] text-[var(--color-red)] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>Not approved</span>
                            </span>
                          )}

                          {paper.status === 'approved' && (
                            <button
                              onClick={() => onSelectPaper(paper)}
                              className="px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View</span>
                            </button>
                          )}

                          <button
                            onClick={() => setEditingUpload(paper)}
                            className="px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] border border-[var(--border-divider)] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            title="Edit paper"
                          >
                            <Edit2 className="w-3 h-3 text-[var(--accent-blue)]" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleDeleteUpload(paper.id)}
                            className="p-1 text-[var(--text-muted)] hover:text-[var(--color-red)] rounded transition-colors cursor-pointer"
                            title="Delete upload"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Pending Removal Request Alert for this specific paper */}
                      {removalRequests.filter((r) => r.paperId === paper.id && r.status === 'pending').map((req) => (
                        <div key={req.id} className="p-3 bg-[var(--surface-secondary)] border border-[var(--color-yellow)]/40 rounded-lg text-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[var(--color-yellow)] font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Removal Requested by {req.reporterName}</span>
                            </div>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-[var(--accent-red-bg)] text-[var(--color-red)]">
                              {req.reasonCategory.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[var(--text-primary)] text-[11px] bg-[var(--surface-main)] p-2 rounded border border-[var(--border-divider)] italic">
                            "{req.reasonDetails}"
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              Submitted {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDismissRemovalRequest(req.id)}
                                className="px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded transition-colors cursor-pointer"
                              >
                                Dismiss
                              </button>
                              <button
                                onClick={() => handleAcceptRemovalRequest(req.id, paper.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-[var(--color-red)] bg-[var(--accent-red-bg)] rounded border border-[var(--color-red)]/30 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Paper</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Rejection Feedback Note */}
                      {paper.status === 'rejected' && paper.rejectionReason && (
                        <div className="p-2.5 bg-[var(--accent-red-bg)] border border-[var(--color-red)]/20 rounded-lg text-xs text-[var(--color-red)]">
                          <strong>Moderator note:</strong> {paper.rejectionReason}
                        </div>
                      )}

                      {/* Metrics bar */}
                      <div className="pt-2 border-t border-[var(--border-divider)] flex items-center gap-3 text-xs font-mono text-[var(--text-muted)]">
                        <span>{paper.downloadsCount || 0} Downloads</span>
                        <span>·</span>
                        <span>{paper.viewsCount || 0} Views</span>
                        <span>·</span>
                        <span className="text-[var(--color-yellow)]">★ {paper.rating || '5.0'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-6 space-y-2.5">
                  <UploadCloud className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">No papers uploaded yet</h3>
                  <p className="max-w-xs mx-auto">
                    Share Previous Year Question papers with fellow students and build our open archive.
                  </p>
                  <button
                    onClick={onNavigateToUpload}
                    className="mt-1 px-4 py-2 bg-[var(--accent-blue)] text-white dark:text-[#1C2530] text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                  >
                    Upload Your First Paper
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: REMOVAL REQUESTS */}
          {activeSection === 'removal_requests' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                    Paper Removal Requests
                  </h1>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Direct feedback and removal requests sent to your account from students and reviewers.
                  </p>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-xs text-[var(--text-secondary)] flex items-center gap-1.5 self-start sm:self-center">
                  <span>Pending:</span>
                  <strong className="text-[var(--color-yellow)] font-mono">{pendingRemovalRequests.length}</strong>
                </div>
              </div>

              {removalRequests.length > 0 ? (
                <div className="space-y-3">
                  {removalRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl p-4 sm:p-5 border border-[var(--border-divider)] bg-[var(--surface-main)] shadow-xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                            <span className="font-semibold text-[var(--accent-blue)]">{req.paperExamBoard}</span>
                            <span className="text-[var(--text-muted)] opacity-60">·</span>
                            <span>{req.paperSubject} ({req.paperYear})</span>
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                            {req.paperTitle}
                          </h3>
                        </div>

                        <div className="self-start sm:self-center shrink-0">
                          {req.status === 'pending' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--accent-yellow-bg)] text-[var(--color-yellow)] border border-[var(--color-yellow)]/30">
                              Action Requested
                            </span>
                          )}
                          {req.status === 'removed' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--accent-red-bg)] text-[var(--color-red)]">
                              Paper Removed
                            </span>
                          )}
                          {req.status === 'dismissed' && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-elevated)] text-[var(--text-muted)]">
                              Dismissed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-divider)] space-y-1.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[var(--text-primary)]">Reason:</span>
                            <span className="px-1.5 py-0.2 rounded bg-[var(--surface-main)] text-[var(--accent-blue)] font-medium uppercase text-[10px]">
                              {req.reasonCategory.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            Reported by: <span className="text-[var(--text-primary)]">{req.reporterName}</span>
                          </div>
                        </div>

                        <p className="text-xs text-[var(--text-primary)] leading-relaxed pt-0.5">
                          "{req.reasonDetails}"
                        </p>
                      </div>

                      <div className="pt-1.5 border-t border-[var(--border-divider)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">
                          Received {new Date(req.createdAt).toLocaleDateString()}
                        </span>

                        {req.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDismissRemovalRequest(req.id)}
                              className="px-2.5 py-1 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-medium transition-colors cursor-pointer"
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => handleAcceptRemovalRequest(req.id, req.paperId)}
                              className="px-3 py-1 rounded-lg bg-[var(--accent-red-bg)] hover:opacity-90 text-[var(--color-red)] border border-[var(--color-red)]/30 text-xs font-semibold transition-opacity flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove Paper</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-6 space-y-2.5">
                  <ShieldCheck className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">No Removal Requests</h3>
                  <p className="max-w-sm mx-auto">
                    Your uploaded papers have no pending disputes or removal requests.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SECTION: REVIEWS */}
          {activeSection === 'reviews' && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                  My Reviews & Notes
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Ratings and feedback submitted on question papers across Studify.
                </p>
              </div>

              {userReviews.length > 0 ? (
                <div className="space-y-2.5">
                  {userReviews.map(({ review, paper }) => (
                    <div
                      key={review.id}
                      className="bg-[var(--surface-main)] border border-[var(--border-divider)] rounded-xl p-4 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          onClick={() => onSelectPaper(paper)}
                          className="text-sm font-semibold text-[var(--accent-blue)] hover:underline cursor-pointer truncate"
                        >
                          {paper.title}
                        </div>
                        <div className="flex items-center gap-1 text-[var(--color-yellow)] font-mono text-xs">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < review.stars ? 'fill-current' : 'opacity-30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {review.text && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                          "{review.text}"
                        </p>
                      )}

                      <div className="text-[11px] text-[var(--text-muted)] font-mono">
                        Reviewed on {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-secondary)] border border-[var(--border-divider)] rounded-xl bg-[var(--surface-main)] p-6 space-y-2.5">
                  <Star className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">No reviews yet</h3>
                  <p className="max-w-xs mx-auto">
                    Rate past exam papers you have practiced to help other students assess quality.
                  </p>
                  <button
                    type="button"
                    onClick={onNavigateToBrowse}
                    className="mt-1 px-4 py-2 bg-[var(--accent-blue)] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer btn-quad-border"
                  >
                    Browse Papers
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: SETTINGS */}
          {activeSection === 'settings' && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                  Account Settings
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Manage your Studify identity and account details.
                </p>
              </div>

              {/* Profile Card */}
              <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 shadow-xs space-y-3.5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Profile Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1 font-mono uppercase text-[10px]">Full Name</label>
                    <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-primary)] font-medium">
                      {currentUser.name}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1 font-mono uppercase text-[10px]">Email Address</label>
                    <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-primary)] font-medium">
                      {currentUser.email}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1 font-mono uppercase text-[10px]">Account Role</label>
                    <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--accent-blue)] font-semibold uppercase">
                      {currentUser.role}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[var(--text-secondary)] mb-1 font-mono uppercase text-[10px]">Joined Date</label>
                    <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-divider)] text-[var(--text-secondary)] font-mono">
                      {new Date(currentUser.joinedDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sign Out Card */}
              <div className="bg-[var(--surface-main)]/85 backdrop-blur-md border border-[var(--border-divider)] rounded-xl p-5 shadow-xs flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-red)]">
                    Sign Out of Studify
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    End your active study session on this browser.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3.5 py-1.5 bg-[var(--accent-red-bg)] text-[var(--color-red)] border border-[var(--color-red)]/30 text-xs font-semibold rounded-lg transition-colors cursor-pointer btn-quad-border"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingUpload && (
        <EditCommunityPyqModal
          paper={editingUpload}
          isOpen={Boolean(editingUpload)}
          onClose={() => setEditingUpload(null)}
          onUpdated={(updated) => {
            setEditingUpload(null);
            const all = storageService.getPapers();
            storageService.savePapers(all.map((p) => (p.id === updated.id ? updated : p)));
          }}
        />
      )}
    </div>
  );
};
