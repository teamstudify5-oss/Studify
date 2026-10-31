import React, { useState, useEffect } from 'react';
import { 
  User, 
  Bookmark, 
  UploadCloud, 
  Star, 
  Settings, 
  LogOut, 
  ShieldCheck, 
  Clock, 
  Download, 
  Trash2, 
  Eye, 
  PlusCircle, 
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Award,
  Flag,
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
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-14 h-14 bg-[#101B2D] border border-white/[0.14] rounded-2xl flex items-center justify-center mx-auto text-cyan-400 shadow-xl shadow-cyan-950/30">
          <User className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-[#F8FAFC]">
          Sign in to view your library
        </h1>
        <p className="text-xs sm:text-sm text-[#A7B4C8] leading-relaxed max-w-sm mx-auto">
          Access your personal study library, bookmarked question papers, uploaded materials, and community reviews.
        </p>
        <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
          <button
            onClick={() => openAuthModal('login')}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20"
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
        console.warn('Error fetching notes count in ProfilePage:', error.message);
        return;
      }
      setTotalNotes(count ?? 0);
    } catch (err) {
      console.warn('fetchProfileNotesCount exception:', err);
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
  const [removalRequests, setRemovalRequests] = useState<PaperRemovalRequest[]>(() =>
    removalService.getRequestsForUploader(currentUser.id, currentUser.email)
  );

  const refreshRemovalRequests = () => {
    setRemovalRequests(removalService.getRequestsForUploader(currentUser.id, currentUser.email));
  };

  useEffect(() => {
    refreshRemovalRequests();
    const handleUpdate = () => refreshRemovalRequests();
    window.addEventListener('studify:removal-requests-updated', handleUpdate);
    return () => window.removeEventListener('studify:removal-requests-updated', handleUpdate);
  }, [currentUser]);

  const pendingRemovalRequests = removalRequests.filter((r) => r.status === 'pending');

  // Collect all reviews authored by currentUser or left on user's uploads
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
      icon: <ShieldCheck className="w-4 h-4 text-amber-400" />, 
      badge: pendingRemovalRequests.length,
      badgeColor: pendingRemovalRequests.length > 0 ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold animate-pulse' : undefined
    },
    { id: 'reviews', label: 'My Reviews', icon: <Star className="w-4 h-4" />, badge: userReviews.length },
    { id: 'settings', label: 'Account Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Mobile Top Navigation Tabs */}
      <div className="lg:hidden flex overflow-x-auto gap-2 pb-4 mb-6 scrollbar-none border-b border-white/[0.08]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
              activeSection === item.id
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm'
                : 'bg-[#101B2D]/70 text-[#A7B4C8] hover:text-[#F8FAFC] border border-white/[0.08]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sidebar Rail (Desktop) */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-24 space-y-4">
          {/* User ID Card */}
          <div className="bg-[#101B2D]/85 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-black text-base shadow-md shadow-cyan-950/30">
                {currentUser.avatarInitials}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#F8FAFC] truncate">
                  {currentUser.name}
                </h3>
                <p className="text-[11px] text-[#A7B4C8] truncate">
                  {currentUser.email}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                    {currentUser.role === 'owner' ? 'Owner / Admin' : 'Student'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Navigation Rail */}
          <nav className="bg-[#101B2D]/80 backdrop-blur-md border border-white/[0.12] rounded-2xl p-2 shadow-xl space-y-1 text-xs">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all text-left ${
                  activeSection === item.id
                    ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/15 text-cyan-300 border border-cyan-400/40 shadow-sm'
                    : 'text-[#A7B4C8] hover:text-[#F8FAFC] hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className={`px-2 py-0.5 text-[10px] font-mono rounded-full ${
                    activeSection === item.id ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/[0.08] text-[#A7B4C8]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}

            <div className="pt-2 mt-2 border-t border-white/[0.08]">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-xs"
              >
                <LogOut className="w-4 h-4" />
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
                <h1 className="text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
                  Welcome back, {currentUser.name.split(' ')[0]}
                </h1>
                <p className="text-xs sm:text-sm text-[#A7B4C8] mt-1">
                  Manage your personal exam library, tracked papers, and uploaded past exams.
                </p>
              </div>

              {/* Pending Removal Requests Banner for Uploader */}
              {pendingRemovalRequests.length > 0 && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/60 via-amber-950/40 to-[#101B2D] border border-amber-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[#F8FAFC]">
                          {pendingRemovalRequests.length} Pending Paper Removal Request{pendingRemovalRequests.length > 1 ? 's' : ''}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 animate-pulse">
                          Review Needed
                        </span>
                      </div>
                      <p className="text-xs text-[#A7B4C8] mt-1">
                        Students or reviewers requested the removal of paper(s) you uploaded. Review their stated reason and choose to delete or dismiss.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSection('removal_requests')}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shrink-0 self-start sm:self-center"
                  >
                    Review Requests →
                  </button>
                </div>
              )}

              {/* Metric Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div 
                  onClick={() => setActiveSection('bookmarks')}
                  className="bg-[#101B2D]/80 backdrop-blur-md border border-white/[0.12] hover:border-cyan-400/40 rounded-2xl p-4 cursor-pointer transition-all shadow-lg hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between text-[#A7B4C8] text-xs">
                    <span>Saved Papers</span>
                    <Bookmark className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#F8FAFC] font-mono">
                    {bookmarkedPapers.length}
                  </div>
                  <div className="text-[11px] text-cyan-300 hover:underline mt-1">
                    View saved →
                  </div>
                </div>

                <div 
                  onClick={() => setActiveSection('uploads')}
                  className="bg-[#101B2D]/80 backdrop-blur-md border border-white/[0.12] hover:border-teal-400/40 rounded-2xl p-4 cursor-pointer transition-all shadow-lg hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between text-[#A7B4C8] text-xs">
                    <span>My Uploads</span>
                    <UploadCloud className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#F8FAFC] font-mono">
                    {userUploads.length}
                  </div>
                  <div className="text-[11px] text-teal-300 hover:underline mt-1">
                    View materials →
                  </div>
                </div>

                <div 
                  onClick={() => setActiveSection('reviews')}
                  className="bg-[#101B2D]/80 backdrop-blur-md border border-white/[0.12] hover:border-amber-400/40 rounded-2xl p-4 cursor-pointer transition-all shadow-lg hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between text-[#A7B4C8] text-xs">
                    <span>Total Notes</span>
                    <Star className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#F8FAFC] font-mono">
                    {totalNotes}
                  </div>
                  <div className="text-[11px] text-amber-300 hover:underline mt-1">
                    View notes & reviews →
                  </div>
                </div>

                <div className="bg-[#101B2D]/80 backdrop-blur-md border border-white/[0.12] rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center justify-between text-[#A7B4C8] text-xs">
                    <span>Impact Downloads</span>
                    <Download className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-black text-[#F8FAFC] font-mono">
                    {totalDownloadsOfUserPapers}
                  </div>
                  <div className="text-[11px] text-emerald-400 mt-1">
                    Total student reads
                  </div>
                </div>
              </div>

              {/* Quick Action Shortcuts */}
              <div className="bg-gradient-to-r from-cyan-950/40 via-[#101B2D] to-emerald-950/40 border border-white/[0.14] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    Need to find a question paper for revision?
                  </h3>
                  <p className="text-xs text-[#A7B4C8]">
                    Explore 100% free CBSE, ICSE, JEE, and NEET past papers with solutions.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={onNavigateToBrowse}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all shadow-md shadow-cyan-500/20"
                  >
                    Explore PYQs
                  </button>
                  <button
                    onClick={onNavigateToUpload}
                    className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    Upload Paper
                  </button>
                </div>
              </div>

              {/* Recent Bookmarks Preview */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    Recently Saved Papers
                  </h3>
                  {bookmarkedPapers.length > 0 && (
                    <button
                      onClick={() => setActiveSection('bookmarks')}
                      className="text-xs text-cyan-300 hover:underline flex items-center gap-1"
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
                  <div className="p-6 text-center text-xs text-[#A7B4C8] border border-white/[0.08] rounded-2xl bg-[#101B2D]/50 space-y-2">
                    <p>No papers bookmarked yet.</p>
                    <button
                      onClick={onNavigateToBrowse}
                      className="text-cyan-400 hover:underline font-semibold"
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
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
                    Bookmarked Papers
                  </h1>
                  <p className="text-xs text-[#A7B4C8] mt-1">
                    Question papers you saved for quick study and offline download.
                  </p>
                </div>

                <button
                  onClick={onNavigateToBrowse}
                  className="px-3.5 py-1.5 bg-[#101B2D] hover:bg-[#15233D] border border-white/[0.12] text-xs font-semibold text-cyan-300 rounded-xl transition-all"
                >
                  Browse More
                </button>
              </div>

              {bookmarkedPapers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                <div className="py-16 text-center text-xs text-[#A7B4C8] border border-white/[0.1] rounded-3xl bg-[#101B2D]/70 p-8 space-y-3">
                  <Bookmark className="w-10 h-10 text-cyan-400/40 mx-auto" />
                  <h3 className="text-base font-bold text-[#F8FAFC]">No bookmarked papers</h3>
                  <p className="max-w-xs mx-auto">
                    Click the bookmark icon on any paper to save it to your personal study dashboard.
                  </p>
                  <button
                    onClick={onNavigateToBrowse}
                    className="mt-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20"
                  >
                    Explore Question Papers
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: UPLOADS */}
          {activeSection === 'uploads' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
                    My Uploaded Papers
                  </h1>
                  <p className="text-xs text-[#A7B4C8] mt-1">
                    Track moderation status, community reads, and student feedback.
                  </p>
                </div>

                <button
                  onClick={onNavigateToUpload}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-[#050914] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Upload Paper</span>
                </button>
              </div>

              {userUploads.length > 0 ? (
                <div className="space-y-3.5">
                  {userUploads.map((paper) => (
                    <div
                      key={paper.id}
                      className="bg-[#101B2D]/85 backdrop-blur-md border border-white/[0.12] hover:border-cyan-400/30 rounded-2xl p-5 shadow-xl space-y-3 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-[#F8FAFC]">
                            {paper.title}
                          </h3>
                          <div className="text-xs text-[#A7B4C8] flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-cyan-400">{paper.examBoard}</span>
                            <span className="text-white/20">·</span>
                            <span>{paper.grade}</span>
                            <span className="text-white/20">·</span>
                            <span>{paper.subject} ({paper.year})</span>
                            <span className="text-white/20">·</span>
                            <span className="font-mono text-[11px] text-white/60">
                              Submitted {new Date(paper.submittedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge & Actions */}
                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          {paper.status === 'pending' && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-400/30">
                              Waiting for review
                            </span>
                          )}
                          {paper.status === 'approved' && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approved</span>
                            </span>
                          )}
                          {paper.status === 'rejected' && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-400/30 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Not approved</span>
                            </span>
                          )}

                          {paper.status === 'approved' && (
                            <button
                              onClick={() => onSelectPaper(paper)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] rounded-xl transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          )}

                          <button
                            onClick={() => setEditingUpload(paper)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] rounded-xl transition-colors flex items-center gap-1"
                            title="Edit paper"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleDeleteUpload(paper.id)}
                            className="p-1.5 text-[#A7B4C8] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete upload"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Pending Removal Request Alert for this specific paper */}
                      {removalRequests.filter((r) => r.paperId === paper.id && r.status === 'pending').map((req) => (
                        <div key={req.id} className="p-3.5 bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-[#101B2D] border border-amber-500/35 rounded-xl text-xs space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                              <ShieldCheck className="w-4 h-4 text-amber-400" />
                              <span>Removal Requested by {req.reporterName}</span>
                            </div>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              {req.reasonCategory.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[#F8FAFC] text-[11px] bg-black/30 p-2.5 rounded-lg border border-white/[0.06] italic">
                            "{req.reasonDetails}"
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-[#A7B4C8]">
                              Submitted {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDismissRemovalRequest(req.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-[#A7B4C8] hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-lg transition-colors"
                              >
                                Dismiss Request
                              </button>
                              <button
                                onClick={() => handleAcceptRemovalRequest(req.id, paper.id)}
                                className="px-3 py-1 text-[11px] font-bold text-rose-200 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3 text-rose-400" />
                                <span>Remove Paper</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Rejection Feedback Note */}
                      {paper.status === 'rejected' && paper.rejectionReason && (
                        <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl text-xs text-rose-200">
                          <strong>Feedback from moderator:</strong> {paper.rejectionReason}
                        </div>
                      )}

                      {/* Metrics bar */}
                      <div className="pt-2 border-t border-white/[0.06] flex items-center gap-4 text-xs font-mono text-[#A7B4C8]">
                        <span>{paper.downloadsCount || 0} Downloads</span>
                        <span>·</span>
                        <span>{paper.viewsCount || 0} Views</span>
                        <span>·</span>
                        <span className="text-amber-300">★ {paper.rating || '5.0'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-[#A7B4C8] border border-white/[0.1] rounded-3xl bg-[#101B2D]/70 p-8 space-y-3">
                  <UploadCloud className="w-10 h-10 text-teal-400/40 mx-auto" />
                  <h3 className="text-base font-bold text-[#F8FAFC]">No papers uploaded yet</h3>
                  <p className="max-w-xs mx-auto">
                    Share Previous Year Question papers with fellow students and build our open archive.
                  </p>
                  <button
                    onClick={onNavigateToUpload}
                    className="mt-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20"
                  >
                    Upload Your First Paper
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: REMOVAL REQUESTS */}
          {activeSection === 'removal_requests' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
                    Paper Removal Requests
                  </h1>
                  <p className="text-xs text-[#A7B4C8] mt-1">
                    Direct feedback and removal requests sent to your account from students and reviewers.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#101B2D] border border-white/[0.12] text-xs text-[#A7B4C8] flex items-center gap-2 self-start sm:self-center">
                  <span>Pending Action:</span>
                  <strong className="text-amber-300 font-mono">{pendingRemovalRequests.length}</strong>
                </div>
              </div>

              {removalRequests.length > 0 ? (
                <div className="space-y-4">
                  {removalRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`backdrop-blur-md rounded-2xl p-5 sm:p-6 shadow-xl border transition-all space-y-4 ${
                        req.status === 'pending'
                          ? 'bg-[#121B2E] border-amber-500/35 hover:border-amber-400/50'
                          : req.status === 'removed'
                          ? 'bg-[#0D1526]/80 border-rose-500/20 opacity-80'
                          : 'bg-[#0D1526]/80 border-white/[0.08] opacity-75'
                      }`}
                    >
                      {/* Top Header of Request Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-cyan-400">{req.paperExamBoard}</span>
                            <span className="text-white/20">·</span>
                            <span className="text-xs text-[#A7B4C8]">{req.paperSubject} ({req.paperYear})</span>
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-[#F8FAFC]">
                            {req.paperTitle}
                          </h3>
                        </div>

                        {/* Status Badge */}
                        <div className="self-start sm:self-center shrink-0">
                          {req.status === 'pending' && (
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1.5 animate-pulse">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Action Requested</span>
                            </span>
                          )}
                          {req.status === 'removed' && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Paper Removed by You</span>
                            </span>
                          )}
                          {req.status === 'dismissed' && (
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/[0.08] text-[#A7B4C8] border border-white/[0.12] flex items-center gap-1.5">
                              <span>Dismissed / Retained</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reason Box */}
                      <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#A7B4C8]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white">Reported Reason:</span>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-semibold uppercase tracking-wider text-[10px]">
                              {req.reasonCategory.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            Reported by: <span className="text-white font-medium">{req.reporterName}</span>
                            {req.reporterEmail && <span className="text-[#A7B4C8]/80"> ({req.reporterEmail})</span>}
                          </div>
                        </div>

                        <p className="text-sm text-[#F8FAFC] leading-relaxed pt-1">
                          "{req.reasonDetails}"
                        </p>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-2 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <span className="text-[11px] text-[#A7B4C8] font-mono">
                          Received {new Date(req.createdAt).toLocaleDateString()} at{' '}
                          {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        {req.status === 'pending' ? (
                          <div className="flex items-center gap-2.5">
                            <button
                              onClick={() => handleDismissRemovalRequest(req.id)}
                              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[#A7B4C8] hover:text-white font-semibold transition-colors"
                            >
                              Dismiss Request
                            </button>
                            <button
                              onClick={() => handleAcceptRemovalRequest(req.id, req.paperId)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-400 hover:to-amber-500 text-white font-bold transition-all shadow-md shadow-rose-950/30 flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove Paper from Studify</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#A7B4C8] italic">
                            Resolved on {req.resolvedAt ? new Date(req.resolvedAt).toLocaleDateString() : 'recently'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-[#A7B4C8] border border-white/[0.1] rounded-3xl bg-[#101B2D]/70 p-8 space-y-3">
                  <ShieldCheck className="w-10 h-10 text-emerald-400/40 mx-auto" />
                  <h3 className="text-base font-bold text-[#F8FAFC]">No Removal Requests</h3>
                  <p className="max-w-sm mx-auto">
                    Your uploaded papers have no pending disputes or removal requests. If a student flags a question error or copyright issue, it will appear here for your review.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SECTION: REVIEWS */}
          {activeSection === 'reviews' && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
                  My Reviews & Notes
                </h1>
                <p className="text-xs text-[#A7B4C8] mt-1">
                  Ratings and feedback submitted on question papers across Studify.
                </p>
              </div>

              {userReviews.length > 0 ? (
                <div className="space-y-3">
                  {userReviews.map(({ review, paper }) => (
                    <div
                      key={review.id}
                      className="bg-[#101B2D]/85 border border-white/[0.12] rounded-2xl p-5 shadow-xl space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          onClick={() => onSelectPaper(paper)}
                          className="text-sm font-bold text-cyan-300 hover:underline cursor-pointer truncate"
                        >
                          {paper.title}
                        </div>
                        <div className="flex items-center gap-1 text-amber-300 font-mono text-xs">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < review.stars ? 'fill-amber-300 text-amber-300' : 'text-white/20'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {review.text && (
                        <p className="text-xs text-[#F8FAFC] leading-relaxed">
                          "{review.text}"
                        </p>
                      )}

                      <div className="text-[11px] text-[#A7B4C8] font-mono">
                        Reviewed on {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-[#A7B4C8] border border-white/[0.1] rounded-3xl bg-[#101B2D]/70 p-8 space-y-3">
                  <Star className="w-10 h-10 text-amber-400/40 mx-auto" />
                  <h3 className="text-base font-bold text-[#F8FAFC]">No reviews yet</h3>
                  <p className="max-w-xs mx-auto">
                    Rate past exam papers you have practiced to help other students assess quality.
                  </p>
                  <button
                    onClick={onNavigateToBrowse}
                    className="mt-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-[#050914] text-xs font-bold rounded-xl shadow-md shadow-cyan-500/20"
                  >
                    Browse Papers
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SECTION: SETTINGS */}
          {activeSection === 'settings' && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#F8FAFC] tracking-tight">
                  Account Settings
                </h1>
                <p className="text-xs text-[#A7B4C8] mt-1">
                  Manage your Studify identity and preview switcher.
                </p>
              </div>

              {/* Profile Card */}
              <div className="bg-[#101B2D]/85 border border-white/[0.12] rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-bold text-[#F8FAFC]">
                  Profile Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[#A7B4C8] mb-1 font-mono uppercase text-[10px]">Full Name</label>
                    <div className="p-3 rounded-xl bg-[#0A1222] border border-white/[0.1] text-white font-medium">
                      {currentUser.name}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#A7B4C8] mb-1 font-mono uppercase text-[10px]">Email Address</label>
                    <div className="p-3 rounded-xl bg-[#0A1222] border border-white/[0.1] text-white font-medium">
                      {currentUser.email}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#A7B4C8] mb-1 font-mono uppercase text-[10px]">Account Role</label>
                    <div className="p-3 rounded-xl bg-[#0A1222] border border-white/[0.1] text-emerald-400 font-semibold uppercase">
                      {currentUser.role}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#A7B4C8] mb-1 font-mono uppercase text-[10px]">Joined Date</label>
                    <div className="p-3 rounded-xl bg-[#0A1222] border border-white/[0.1] text-[#A7B4C8] font-mono">
                      {new Date(currentUser.joinedDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>



              {/* Sign Out Card */}
              <div className="bg-[#101B2D]/85 border border-red-500/20 rounded-2xl p-6 shadow-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-red-300">
                    Sign Out of Studify
                  </h3>
                  <p className="text-xs text-[#A7B4C8] mt-0.5">
                    End your active study session on this browser.
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl transition-all"
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
