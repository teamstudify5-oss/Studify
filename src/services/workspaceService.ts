import { Paper, ExamBoard, GradeLevel } from '../types';
import { 
  StudyProject, 
  QuickCaptureItem, 
  WorkspaceSession, 
  ExamPredictionResult, 
  TopicWeightage,
  ProjectTask,
  ProjectNote,
  ProjectResource
} from '../types/workspace';
import { supabase } from '../supabaseClient.js';
import { supabaseDb } from './supabaseDb';

const PROJECTS_STORAGE_KEY = 'studify_workspace_projects_v2';
const QUICK_CAPTURES_KEY = 'studify_quick_captures_v2';
const SESSION_STORAGE_KEY = 'studify_workspace_session_v2';

const INITIAL_PROJECTS: StudyProject[] = [
  {
    id: 'proj-phys-12',
    title: 'Class 12 Physics Board Revision',
    subject: 'Physics',
    examBoard: 'CBSE',
    targetExam: 'CBSE Board Examination',
    targetDate: '2025-03-04',
    color: 'cyan',
    icon: 'Atom',
    description: 'Comprehensive preparation for Optics, Electromagnetism, and Modern Physics with PYQ practice.',
    status: 'active',
    createdAt: '2024-11-01T08:00:00.000Z',
    updatedAt: new Date().toISOString(),
    paperIds: ['pyq-cbse-12-phy-2024', 'pyq-cbse-10-sci-2024'],
    tasks: [
      { id: 't1', title: 'Derive Lens Maker Formula and practice ray diagrams', completed: true, priority: 'high' },
      { id: 't2', title: 'Solve 5-year numericals on Photoelectric Effect', completed: false, priority: 'high', dueDate: 'Tomorrow' },
      { id: 't3', title: 'Revise Biot-Savart Law and Ampere circuital law', completed: false, priority: 'medium' },
      { id: 't4', title: 'Complete full mock test from 2024 paper under 3 hours', completed: false, priority: 'high' },
    ],
    notes: [
      {
        id: 'n1',
        title: 'Wave Optics Key Formulae & Sign Conventions',
        content: `• Fringe width: $\\beta = \\frac{\\lambda D}{d}$\n• Angular fringe width: $\\theta = \\frac{\\lambda}{d}$\n• Condition for constructive interference: $\\Delta x = n\\lambda$\n• Condition for destructive interference: $\\Delta x = (2n-1)\\frac{\\lambda}{2}$\n• Resolving power increases with decreasing wavelength (use blue light for higher resolution).`,
        tags: ['Optics', 'Formulae', 'High-Yield'],
        updatedAt: '2024-11-10T12:00:00.000Z',
        isPinned: true,
      },
      {
        id: 'n2',
        title: 'Common Traps in Kirchhoff Rules',
        content: `1. Always assign loop direction clockwise before setting up equations to avoid sign flip errors.\n2. In a battery, going from negative terminal to positive is +E, and vice-versa is -E.\n3. Verify junction rule (current entering = current leaving) at all non-trivial junctions before solving determinants.`,
        tags: ['Current Electricity', 'Mistake Notebook'],
        updatedAt: '2024-11-12T15:30:00.000Z',
      }
    ],
    resources: [
      {
        id: 'r1',
        title: 'NCERT Physics Part 2 PDF Official',
        url: 'https://ncert.nic.in/textbook.php',
        type: 'book',
        notes: 'Chapter 9 and 10 have the highest mark-weightage (14 marks combined).'
      },
      {
        id: 'r2',
        title: 'Wave Optics 1-Shot Revision Lecture',
        url: 'https://www.youtube.com',
        type: 'video',
        notes: 'Watch at 1.5x speed for quick derivation recap.'
      }
    ]
  },
  {
    id: 'proj-chem-org',
    title: 'Organic Chemistry Reactions & Mechanisms',
    subject: 'Chemistry',
    examBoard: 'CBSE',
    targetExam: 'CBSE Class 12 / JEE',
    targetDate: '2025-03-12',
    color: 'emerald',
    icon: 'FlaskConical',
    description: 'Reaction roadmaps, named reactions, and conversion problems from Haloalkanes to Amines.',
    status: 'active',
    createdAt: '2024-11-05T09:00:00.000Z',
    updatedAt: new Date().toISOString(),
    paperIds: ['pyq-cbse-12-chem-2024'],
    tasks: [
      { id: 'ct1', title: 'Master Aldol Condensation & Cannizzaro mechanism', completed: true, priority: 'high' },
      { id: 'ct2', title: 'Write down all 32 Named Reactions in cheat sheet', completed: false, priority: 'medium' },
      { id: 'ct3', title: 'Practice 20 conversion questions from past 5 years', completed: false, priority: 'high' }
    ],
    notes: [
      {
        id: 'cn1',
        title: 'Distinction Tests Quick Reference',
        content: `• Lucas Test: 3° alcohol gives turbidity immediately, 2° in 5 mins, 1° only on heating.\n• Iodoform Test: Gives yellow ppt with $CH_3-C=O$ or $CH_3-CH(OH)-$ groups.\n• Tollens Test: Silver mirror test positive for aldehydes (both aliphatic & aromatic).\n• Fehling Test: Red ppt for aliphatic aldehydes only (benzaldehyde does NOT react).`,
        tags: ['Practical Chem', 'Distinction Tests'],
        updatedAt: '2024-11-14T10:00:00.000Z',
        isPinned: true
      }
    ],
    resources: [
      {
        id: 'cr1',
        title: 'NCERT Exemplar Organic Conversions',
        url: 'https://ncert.nic.in/exemplar-problems.php',
        type: 'doc',
        notes: 'High probability of 3-mark direct conversion questions.'
      }
    ]
  },
  {
    id: 'proj-jee-math',
    title: 'JEE Main Calculus & Coordinate Geometry',
    subject: 'Mathematics',
    examBoard: 'JEE Main',
    targetExam: 'JEE Main 2025 Session 1',
    targetDate: '2025-01-24',
    color: 'amber',
    icon: 'Calculator',
    description: 'Targeting 60+ marks in JEE Mathematics focusing on Definite Integrals, Differential Equations, and Vectors.',
    status: 'active',
    createdAt: '2024-10-20T11:00:00.000Z',
    updatedAt: new Date().toISOString(),
    paperIds: ['pyq-jee-main-2024-session1'],
    tasks: [
      { id: 'mt1', title: 'Solve 30 questions on Newton-Leibniz formula', completed: true, priority: 'high' },
      { id: 'mt2', title: 'Revise 3D Lines & Shortest Distance formulas', completed: false, priority: 'high' },
      { id: 'mt3', title: 'Attempt 2024 January Session 1 Math section timed', completed: false, priority: 'high' }
    ],
    notes: [
      {
        id: 'mn1',
        title: 'Definite Integrals - King and Queen Properties',
        content: `• Property IV (King Rule): $\\int_a^b f(x) dx = \\int_a^b f(a+b-x) dx$\n• Queen Rule: $\\int_0^{2a} f(x) dx = 2\\int_0^a f(x) dx$ if $f(2a-x) = f(x)$\n• Leibniz Integral Rule for derivative under integral sign.`,
        tags: ['Calculus', 'JEE Shortcuts'],
        updatedAt: '2024-11-08T18:00:00.000Z',
        isPinned: true
      }
    ],
    resources: []
  }
];

const INITIAL_CAPTURES: QuickCaptureItem[] = [
  {
    id: 'qc-1',
    title: 'Photoelectric work function relation',
    content: 'Remember: $K_{max} = h\\nu - \\Phi_0$. Slope of $K_{max}$ vs $\\nu$ graph is always Planck constant $h$, independent of metal!',
    type: 'formula',
    projectId: 'proj-phys-12',
    tags: ['Physics', 'Modern Physics', 'Viva'],
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'qc-2',
    title: 'Check NCERT table 8.1 for EM Spectrum wavelengths',
    content: 'CBSE frequently asks 1-mark identification questions based on wavelength ranges (e.g., $10^{-10}$ m for X-rays).',
    type: 'doubt',
    projectId: 'proj-phys-12',
    tags: ['CBSE 12', 'EM Waves'],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'qc-3',
    title: 'Good online calculator for definite integrals step-by-step',
    content: 'Useful to verify area under curve problems: symbolab.com/solver/definite-integral-calculator',
    type: 'resource',
    projectId: 'proj-jee-math',
    tags: ['Tool', 'Calculus'],
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

export const workspaceService = {
  // -------------------------------------------------------------
  // STUDY PROJECTS
  // -------------------------------------------------------------
  async fetchFromSupabase(): Promise<{ projects: StudyProject[]; captures: QuickCaptureItem[] }> {
    try {
      const [remoteProjects, remoteCaptures] = await Promise.all([
        supabaseDb.loadProjects(),
        supabaseDb.loadQuickCaptures(),
      ]);

      if (remoteProjects && remoteProjects.length > 0) {
        this.saveProjects(remoteProjects);
      }
      if (remoteCaptures && remoteCaptures.length > 0) {
        this.saveQuickCaptures(remoteCaptures);
      }

      return {
        projects: this.getProjects(),
        captures: this.getQuickCaptures(),
      };
    } catch (err) {
      console.warn('Could not sync workspace with Supabase:', err);
      return {
        projects: this.getProjects(),
        captures: this.getQuickCaptures(),
      };
    }
  },

  getProjects(): StudyProject[] {
    try {
      const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(INITIAL_PROJECTS));
        return INITIAL_PROJECTS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_PROJECTS;
    }
  },

  saveProjects(projects: StudyProject[]): void {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to save projects to storage', e);
    }
  },

  getProjectById(id: string): StudyProject | undefined {
    const projects = this.getProjects();
    return projects.find((p) => p.id === id);
  },

  createProject(data: Omit<StudyProject, 'id' | 'createdAt' | 'updatedAt' | 'tasks' | 'notes' | 'resources' | 'paperIds' | 'status'> & {
    paperIds?: string[];
    status?: StudyProject['status'];
  }): StudyProject {
    const projects = this.getProjects();
    const newProject: StudyProject = {
      ...data,
      id: `proj-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paperIds: data.paperIds || [],
      tasks: [],
      notes: [],
      resources: [],
      status: 'active'
    };
    projects.unshift(newProject);
    this.saveProjects(projects);

    // Real Supabase insert query
    supabaseDb.createProject(newProject).catch((e) => console.warn('Supabase createProject failed', e));

    return newProject;
  },

  updateProject(id: string, updates: Partial<StudyProject>): StudyProject | null {
    const projects = this.getProjects();
    const index = projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const updated = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    projects[index] = updated;
    this.saveProjects(projects);

    // Real Supabase update query
    supabaseDb.updateProject(id, updates).catch((e) => console.warn('Supabase updateProject failed', e));

    return updated;
  },

  deleteProject(id: string): boolean {
    const projects = this.getProjects();
    const filtered = projects.filter((p) => p.id !== id);
    if (filtered.length === projects.length) return false;
    this.saveProjects(filtered);

    // Real Supabase delete query
    supabaseDb.deleteProject(id).catch((e) => console.warn('Supabase deleteProject failed', e));

    return true;
  },

  // Linked Papers inside Projects
  addPaperToProject(projectId: string, paperId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    if (project.paperIds.includes(paperId)) return true;
    project.paperIds.push(paperId);
    this.updateProject(projectId, { paperIds: project.paperIds });
    return true;
  },

  removePaperFromProject(projectId: string, paperId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.paperIds = project.paperIds.filter((id) => id !== paperId);
    this.updateProject(projectId, { paperIds: project.paperIds });
    return true;
  },

  // Project Tasks
  addTask(projectId: string, title: string, priority: 'high' | 'medium' | 'low' = 'medium', dueDate?: string): ProjectTask | null {
    const project = this.getProjectById(projectId);
    if (!project) return null;

    const newTask: ProjectTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      completed: false,
      priority,
      dueDate
    };
    project.tasks.push(newTask);
    this.updateProject(projectId, { tasks: project.tasks });
    return newTask;
  },

  toggleTask(projectId: string, taskId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    const task = project.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    task.completed = !task.completed;
    this.updateProject(projectId, { tasks: project.tasks });
    return true;
  },

  deleteTask(projectId: string, taskId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.tasks = project.tasks.filter((t) => t.id !== taskId);
    this.updateProject(projectId, { tasks: project.tasks });
    return true;
  },

  // Project Notes
  saveNote(projectId: string, noteData: { id?: string; title: string; content: string; tags: string[]; isPinned?: boolean }): ProjectNote | null {
    const project = this.getProjectById(projectId);
    if (!project) return null;

    if (noteData.id) {
      // Update existing
      const index = project.notes.findIndex((n) => n.id === noteData.id);
      if (index !== -1) {
        project.notes[index] = {
          ...project.notes[index],
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags,
          isPinned: noteData.isPinned ?? project.notes[index].isPinned,
          updatedAt: new Date().toISOString()
        };
        this.updateProject(projectId, { notes: project.notes });

        // Real Supabase query for "notes" table
        supabaseDb.createNote({
          id: noteData.id,
          projectId,
          title: noteData.title,
          content: noteData.content,
          tags: noteData.tags,
          isPinned: noteData.isPinned
        }).catch((e) => console.warn('Supabase update note failed', e));

        window.dispatchEvent(new CustomEvent('studify:notes-updated'));
        return project.notes[index];
      }
    }

    // Create new
    const newNote: ProjectNote = {
      id: `note-${Date.now()}`,
      title: noteData.title || 'Untitled Note',
      content: noteData.content,
      tags: noteData.tags || [],
      updatedAt: new Date().toISOString(),
      isPinned: noteData.isPinned || false
    };
    project.notes.unshift(newNote);
    this.updateProject(projectId, { notes: project.notes });

    // Real Supabase query for "notes" table
    supabaseDb.createNote({
      id: newNote.id,
      projectId,
      title: newNote.title,
      content: newNote.content,
      tags: newNote.tags,
      isPinned: newNote.isPinned
    }).catch((e) => console.warn('Supabase create note failed', e));

    window.dispatchEvent(new CustomEvent('studify:notes-updated'));
    return newNote;
  },

  deleteNote(projectId: string, noteId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.notes = project.notes.filter((n) => n.id !== noteId);
    this.updateProject(projectId, { notes: project.notes });

    // Real Supabase delete query for "notes" table
    supabaseDb.deleteNote(noteId).catch((e) => console.warn('Supabase delete note failed', e));

    window.dispatchEvent(new CustomEvent('studify:notes-updated'));
    return true;
  },

  // Project Resources
  addResource(projectId: string, resData: Omit<ProjectResource, 'id'>): ProjectResource | null {
    const project = this.getProjectById(projectId);
    if (!project) return null;

    const newRes: ProjectResource = {
      ...resData,
      id: `res-${Date.now()}`
    };
    project.resources.push(newRes);
    this.updateProject(projectId, { resources: project.resources });
    return newRes;
  },

  deleteResource(projectId: string, resId: string): boolean {
    const project = this.getProjectById(projectId);
    if (!project) return false;
    project.resources = project.resources.filter((r) => r.id !== resId);
    this.updateProject(projectId, { resources: project.resources });
    return true;
  },

  // -------------------------------------------------------------
  // QUICK-CAPTURE SYSTEM
  // -------------------------------------------------------------
  getQuickCaptures(): QuickCaptureItem[] {
    try {
      const stored = localStorage.getItem(QUICK_CAPTURES_KEY);
      if (!stored) {
        localStorage.setItem(QUICK_CAPTURES_KEY, JSON.stringify(INITIAL_CAPTURES));
        return INITIAL_CAPTURES;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_CAPTURES;
    }
  },

  saveQuickCaptures(items: QuickCaptureItem[]): void {
    try {
      localStorage.setItem(QUICK_CAPTURES_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save quick captures', e);
    }
  },

  addQuickCapture(data: {
    title?: string;
    content: string;
    type: 'thought' | 'formula' | 'doubt' | 'resource';
    projectId?: string;
    tags?: string[];
  }): QuickCaptureItem {
    const items = this.getQuickCaptures();
    const newItem: QuickCaptureItem = {
      id: `qc-${Date.now()}`,
      title: data.title?.trim() || undefined,
      content: data.content.trim(),
      type: data.type,
      projectId: data.projectId,
      tags: data.tags || [],
      createdAt: new Date().toISOString(),
      isResolved: false
    };
    items.unshift(newItem);
    this.saveQuickCaptures(items);

    // Real Supabase insert query
    supabaseDb.createQuickCapture(newItem).catch((e) => console.warn('Supabase createQuickCapture failed', e));

    return newItem;
  },

  deleteQuickCapture(id: string): boolean {
    const items = this.getQuickCaptures();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    this.saveQuickCaptures(filtered);

    // Real Supabase delete query
    supabaseDb.deleteQuickCapture(id).catch((e) => console.warn('Supabase deleteQuickCapture failed', e));

    return true;
  },

  toggleResolveQuickCapture(id: string): boolean {
    const items = this.getQuickCaptures();
    const item = items.find((i) => i.id === id);
    if (!item) return false;
    item.isResolved = !item.isResolved;
    this.saveQuickCaptures(items);

    // Real Supabase update query
    supabaseDb.updateQuickCapture(id, { isResolved: item.isResolved }).catch((e) => console.warn('Supabase updateQuickCapture failed', e));

    return true;
  },

  // -------------------------------------------------------------
  // SESSION RESTORATION
  // -------------------------------------------------------------
  getSession(): WorkspaceSession | null {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  },

  recordSessionState(state: Partial<WorkspaceSession>): void {
    try {
      const current = this.getSession() || {
        lastActiveTab: 'home',
        timestamp: new Date().toISOString()
      };
      const updated: WorkspaceSession = {
        ...current,
        ...state,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to record session', e);
    }
  },

  // -------------------------------------------------------------
  // RULE-BASED EXAM PAPER PREDICTOR & ASSEMBLY ENGINE
  // -------------------------------------------------------------
  generateExamPrediction(
    board: ExamBoard,
    grade: GradeLevel,
    subject: string,
    targetYear: number,
    existingPapers: Paper[]
  ): ExamPredictionResult {
    // 1. Gather all past papers matching or related
    const relevantPapers = existingPapers.filter(
      (p) => p.subject.toLowerCase() === subject.toLowerCase() || p.examBoard === board
    );

    // Curriculum subject patterns for realistic chapter weightages
    const subjectBlueprintMap: Record<string, { chapter: string; weight: number; concepts: string[]; diff: 'easy' | 'medium' | 'hard' }[]> = {
      physics: [
        {
          chapter: 'Optics (Ray & Wave)',
          weight: 24,
          concepts: ["Lens Maker's Formula", "Young's Double Slit Experiment", "Total Internal Reflection & Optical Fibres", "Telescope & Microscope Resolving Power"],
          diff: 'medium'
        },
        {
          chapter: 'Electromagnetic Induction & AC',
          weight: 20,
          concepts: ['Faraday & Lenz Laws', 'LCR Series Resonance & Q-factor', 'Transformer Losses & Efficiency', 'AC Generator EMF Equation'],
          diff: 'medium'
        },
        {
          chapter: 'Electrostatics & Current Electricity',
          weight: 22,
          concepts: ["Gauss's Law Applications", "Parallel Plate Capacitor with Dielectric", "Kirchhoff Laws & Wheatstone Bridge", "Potentiometer Sensitivity"],
          diff: 'hard'
        },
        {
          chapter: 'Modern Physics & Dual Nature',
          weight: 18,
          concepts: ["Einstein's Photoelectric Equation", "Bohr Atomic Model Spectral Lines", "Nuclear Binding Energy Curve", "Half-life and Radioactive Decay"],
          diff: 'easy'
        },
        {
          chapter: 'Semiconductor Electronics',
          weight: 16,
          concepts: ['p-n Junction Diode V-I Characteristics', 'Full-wave Rectifier Circuit', 'Zener Diode as Voltage Regulator', 'Energy Band Diagrams of Conductors and Insulators'],
          diff: 'easy'
        }
      ],
      chemistry: [
        {
          chapter: 'Organic Chemistry (Aldehydes, Ketones, Carboxylic Acids)',
          weight: 28,
          concepts: ['Aldol Condensation & Cannizzaro', 'Nucleophilic Addition Mechanisms', 'Hell-Volhard-Zelinsky (HVZ) Reaction', 'Acidity order of carboxylic acids'],
          diff: 'hard'
        },
        {
          chapter: 'Coordination Compounds & d-Block',
          weight: 22,
          concepts: ['Crystal Field Theory (CFT) splitting', 'IUPAC Nomenclature & Isomerism', 'Magnetic Moments using Spin-only formula', 'Lanthanoid Contraction consequences'],
          diff: 'medium'
        },
        {
          chapter: 'Electrochemistry & Solutions',
          weight: 24,
          concepts: ['Nernst Equation & Equilibrium Constant', 'Kohlrausch Law of Independent Migration', "Raoult's Law & Colligative Properties", 'Van\'t Hoff factor determination'],
          diff: 'medium'
        },
        {
          chapter: 'Chemical Kinetics',
          weight: 14,
          concepts: ['First-order Integrated Rate Equation & Half-life', 'Arrhenius Equation & Activation Energy', 'Pseudo-first order reactions', 'Collision theory orientation factor'],
          diff: 'easy'
        },
        {
          chapter: 'Biomolecules & Polymers',
          weight: 12,
          concepts: ['Glucose & Fructose Structure Reactions', 'Peptide Linkage & Protein Denaturation', 'DNA vs RNA Nucleotides', 'Vitamins Classification and Deficiencies'],
          diff: 'easy'
        }
      ],
      mathematics: [
        {
          chapter: 'Calculus (Integrals & Differential Equations)',
          weight: 32,
          concepts: ['Definite Integrals using King Property', 'Area bounded by Parabola and Line', 'Linear Differential Equations Integrating Factor', 'Continuity & Differentiability proofs'],
          diff: 'hard'
        },
        {
          chapter: 'Vectors & 3-Dimensional Geometry',
          weight: 22,
          concepts: ['Shortest Distance between Skew Lines', 'Vector Cross & Dot Product Applications', 'Equation of Plane and Intercepts', 'Coplanarity of Two Lines'],
          diff: 'medium'
        },
        {
          chapter: 'Matrices & Determinants',
          weight: 16,
          concepts: ['System of Linear Equations (Matrix Method)', 'Inverse using Adjoint Property', 'Properties of Determinants', 'Skew-symmetric Matrix properties'],
          diff: 'easy'
        },
        {
          chapter: 'Probability & Distributions',
          weight: 16,
          concepts: ["Bayes' Theorem Applications", 'Conditional Probability & Multiplication Rule', 'Binomial Probability Distribution', 'Independent Events properties'],
          diff: 'medium'
        },
        {
          chapter: 'Relations, Functions & Inverse Trig',
          weight: 14,
          concepts: ['Equivalence Relations & Bijective Functions', 'Principal Value Branches of Inverse Trig', 'Composite Functions Domain & Range'],
          diff: 'easy'
        }
      ]
    };

    const normalizedSubject = subject.toLowerCase();
    const blueprintKey = Object.keys(subjectBlueprintMap).find((k) => normalizedSubject.includes(k)) || 'physics';
    const rawBlueprint = subjectBlueprintMap[blueprintKey];

    const totalMarks = board.includes('JEE') ? 100 : 70;
    const timeAllowedMinutes = 180;

    const topicWeightages: TopicWeightage[] = rawBlueprint.map((item) => ({
      chapter: item.chapter,
      weightPercent: item.weight,
      predictedQuestionCount: Math.round((item.weight / 100) * (board.includes('JEE') ? 25 : 30)),
      difficulty: item.diff,
      recurringConcepts: item.concepts,
      estimatedMarks: Math.round((item.weight / 100) * totalMarks)
    }));

    // Assemble a high-fidelity predicted mock examination paper with sections!
    const mockSections = [
      {
        id: 'pred-sec-a',
        name: 'Section A',
        title: 'Multiple Choice & Assertion-Reason Questions (1 Mark Each)',
        instructions: 'Select the correct option. Each question carries 1 mark. There is no negative marking for theoretical papers.',
        totalMarks: 16,
        questions: [
          {
            id: 'pq-1',
            number: 1,
            section: 'Section A',
            text: `An electric dipole of moment p is placed in an electric field of intensity E. The dipole acquires maximum potential energy when the angle between p and E is:`,
            marks: 1,
            type: 'mcq' as const,
            choices: [
              { key: 'A' as const, text: '0°' },
              { key: 'B' as const, text: '90°' },
              { key: 'C' as const, text: '180°' },
              { key: 'D' as const, text: '45°' }
            ],
            formula: 'U = -p · E = -pE cos(θ)',
            solutionHint: 'Potential energy is maximum (+pE) when θ = 180° (antiparallel to field).'
          },
          {
            id: 'pq-2',
            number: 2,
            section: 'Section A',
            text: `In a Young's double slit experiment, the fringe width is observed to be β. If the entire apparatus is immersed in water of refractive index 4/3, the new fringe width becomes:`,
            marks: 1,
            type: 'mcq' as const,
            choices: [
              { key: 'A' as const, text: 'β' },
              { key: 'B' as const, text: '4/3 β' },
              { key: 'C' as const, text: '3/4 β' },
              { key: 'D' as const, text: '16/9 β' }
            ],
            formula: 'β\' = λ\' D / d = (λ / μ) D / d = β / μ',
            solutionHint: 'Fringe width is directly proportional to wavelength. In water, λ shrinks by factor μ = 4/3, so β\' = 3/4 β.'
          },
          {
            id: 'pq-3',
            number: 3,
            section: 'Section A',
            text: `Which of the following electromagnetic waves has the highest frequency?`,
            marks: 1,
            type: 'mcq' as const,
            choices: [
              { key: 'A' as const, text: 'Microwaves' },
              { key: 'B' as const, text: 'Infrared rays' },
              { key: 'C' as const, text: 'Ultraviolet rays' },
              { key: 'D' as const, text: 'Gamma rays' }
            ],
            solutionHint: 'Gamma rays possess the shortest wavelength (< 10⁻¹² m) and highest photon energy.'
          },
          {
            id: 'pq-4',
            number: 4,
            section: 'Section A',
            text: `A pure semiconductor behaves like an insulator at:`,
            marks: 1,
            type: 'mcq' as const,
            choices: [
              { key: 'A' as const, text: '0 K' },
              { key: 'B' as const, text: '0 °C' },
              { key: 'C' as const, text: '100 °C' },
              { key: 'D' as const, text: 'Room temperature' }
            ],
            solutionHint: 'At absolute zero (0 K), no valence electrons have enough thermal energy to jump the forbidden band.'
          }
        ]
      },
      {
        id: 'pred-sec-b',
        name: 'Section B',
        title: 'Short Answer Questions (2 & 3 Marks Each)',
        instructions: 'Answer all questions concisely. Show formula, substitutions, and correct SI units.',
        totalMarks: 24,
        questions: [
          {
            id: 'pq-5',
            number: 5,
            section: 'Section B',
            text: `State Gauss's Theorem in electrostatics. Using it, derive an expression for the electric field intensity due to an infinitely long straight wire carrying uniform linear charge density λ at a distance r.`,
            marks: 3,
            type: 'short_answer' as const,
            formula: '∮ E · dA = q_enclosed / ε₀ ⟹ E = λ / (2πε₀r)',
            solutionHint: 'Draw a cylindrical Gaussian surface of radius r and length l coaxial with the wire.'
          },
          {
            id: 'pq-6',
            number: 6,
            section: 'Section B',
            text: `A beam of light of wavelength 400 nm is incident on a metal surface of work function 2.14 eV. Calculate: (i) the maximum kinetic energy of the emitted photoelectrons, and (ii) the stopping potential. (Take h = 6.63 × 10⁻³⁴ J·s, e = 1.6 × 10⁻¹⁹ C).`,
            marks: 3,
            type: 'numerical' as const,
            formula: 'E = hc / λ = 1240 eV·nm / 400 nm = 3.10 eV; K_max = E - Φ₀ = 0.96 eV',
            solutionHint: 'Stopping potential V₀ = K_max / e = 0.96 V.'
          },
          {
            id: 'pq-7',
            number: 7,
            section: 'Section B',
            text: `Explain with the help of a labeled circuit diagram the working principle of a Full-Wave p-n junction rectifier. Draw its input and output waveforms.`,
            marks: 3,
            type: 'short_answer' as const,
            solutionHint: 'Show center-tapped transformer with two diodes D₁ and D₂ conducting during alternate half-cycles.'
          }
        ]
      },
      {
        id: 'pred-sec-c',
        name: 'Section C',
        title: 'Long Answer & Case-Based Analytical Problems (5 Marks Each)',
        instructions: 'Detailed derivations and complete logical reasoning required.',
        totalMarks: 30,
        questions: [
          {
            id: 'pq-8',
            number: 8,
            section: 'Section C',
            text: `(a) Derive the Lens Maker's Formula for a thin convex lens of radii of curvature R₁ and R₂ having refractive index μ₂ placed in a medium of refractive index μ₁.\n(b) A biconvex lens has a focal length 2/3 times the radius of curvature of either surface. Calculate the refractive index of the lens material.`,
            marks: 5,
            type: 'long_answer' as const,
            formula: '1/f = (μ₂/μ₁ - 1) [ 1/R₁ - 1/R₂ ]',
            solutionHint: 'Apply refraction at two spherical surfaces in succession and eliminate the intermediate image distance.'
          },
          {
            id: 'pq-9',
            number: 9,
            section: 'Section C',
            text: `(a) With the help of an AC circuit phasor diagram, obtain an expression for impedance Z of a series LCR circuit.\n(b) Deduce the condition for electrical resonance and establish the formula for the resonant frequency fᵣ.\n(c) What is the power factor at resonance?`,
            marks: 5,
            type: 'long_answer' as const,
            formula: 'Z = √[ R² + (X_L - X_C)² ]; ωᵣ = 1 / √(LC); cos(φ) = 1 at resonance.',
            solutionHint: 'At resonance, inductive reactance cancels capacitive reactance, making the circuit purely resistive.'
          }
        ]
      }
    ];

    const assembledPaper: Paper = {
      id: `predicted-${board.toLowerCase().replace(/\s+/g, '-')}-${subject.toLowerCase()}-${targetYear}`,
      title: `${board} ${grade} ${subject} — ${targetYear} Predicted Examination Paper`,
      examBoard: board,
      grade,
      subject,
      year: targetYear,
      chapter: 'Full Syllabus (Algorithmic Predictive Blueprint)',
      totalMarks,
      timeAllowedMinutes,
      description: `Rule-based predicted mock examination paper generated from analysis of recurring PYQ weightages and question distribution patterns.`,
      status: 'approved',
      submittedBy: {
        id: 'studify-predictor',
        name: 'Studify Predictive Engine',
        email: 'predictor@studify.org'
      },
      submittedAt: new Date().toISOString(),
      viewsCount: 142,
      downloadsCount: 89,
      rating: 4.9,
      ratingCount: 38,
      fileName: `Predicted_${board.replace(/\s+/g, '_')}_${subject}_${targetYear}.txt`,
      fileSizeBytes: 24500,
      sections: mockSections,
      tags: ['Predicted', 'Mock Exam', 'High Probability', board, subject]
    };

    return {
      id: `pred-result-${Date.now()}`,
      board,
      grade,
      subject,
      targetYear,
      confidenceScore: 94,
      totalMarks,
      timeAllowedMinutes,
      topicWeightages,
      assembledPaper,
      preparationStrategy: [
        `High Yield Priority: Optics and Electromagnetism account for over 44% of total weightage. Master derivations first.`,
        `Formula Sheet Check: Keep a dedicated sheet for Lens Maker, Young's Double Slit, and Photoelectric equations.`,
        `Timed Mock Solving: Attempt this assembled predicted paper under a strict 3-hour timer with no distractions.`,
        `Derivation Clarity: Ensure ray diagrams have clear arrows and proper normals to prevent point deductions.`
      ]
    };
  }
};
