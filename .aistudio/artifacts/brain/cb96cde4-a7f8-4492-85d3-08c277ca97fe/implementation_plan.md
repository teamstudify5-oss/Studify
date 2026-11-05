# Studify — Complete UI Investigation & Atmospheric Redesign Plan

This document presents a comprehensive, evidence-based investigation of the Studify codebase and an authoritative implementation plan to restore the atmospheric multi-layered gradient aesthetic using the new five-colour identity (**Red, Blue, Yellow, Green, and Black/Charcoal**), ensure 100% theme consistency across both light and dark modes, apply a universal four-colour button outline across every interactive button, fix responsive button layouts without introducing duplicate navigation systems, and cleanly decouple examination marks and duration from paper descriptions.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions govern this plan:
>
> - **Navigation Architecture Preservation**: The codebase already contains an authoritative top navigation bar (`Navbar.tsx`) with a complete responsive slide-out drawer containing all application destinations (`Home`, `Workspace`, `Library`, `Upload`, `Bookmarks`, `About`, `Profile`, `Admin`). The separate `MobileBottomNav.tsx` file is currently unmounted; mounting it would create duplicate navigation controls and crowd small screens. We preserve the single existing navigation system and fix responsive button clipping, wrapping, and touch targets within it.
> - **Universal Four-Colour Button Outline (`.btn-quad-border`)**: Every interactive button across the app (primary CTAs, secondary actions, icon-only controls, modal triggers, pagination, filter tabs, drawer links) receives a continuous, thin 1px gradient outline in the exact sequence **Red → Yellow → Blue → Green**. Text inputs, selects, textareas, static badges, and plain content cards are strictly excluded.
> - **Atmospheric Illumination Level**: Soft, diffused atmospheric glow positioned behind translucent surfaces with `backdrop-blur-md` depth. Both dark and light themes use the same blended five-colour signature without flat recoloring or muddy grey overlays.
> - **Strict Layout & Feature Preservation**: The existing layout, page hierarchy, route destinations, database models, and original Studify homepage remain intact. No replacement dashboard, no fake statistics, and no standalone S-shaped logo emblems.

---

## 1. Investigation Report

### A. Original Atmospheric Effect Investigation & Project Comparison

#### 1. How the Original Effect Was Constructed
The original Studify visual design used a layered atmospheric lighting composite:
- **Full-Viewport Fixed Canvas**: An `.atmospheric-bg` container fixed to `inset-0`, positioned at `z-index: 0` with `pointer-events: none` directly under the root application layout.
- **Overlapping Radial Light Fields**: Multiple asymmetric radial gradients placed at different viewport coordinates, simulating ambient light emitters.
- **Deep Navy / Slate Base**: A deep dark foundation that served as the dark canvas upon which the light fields diffused.
- **Translucent Component Surfaces**: Cards, navigation bars, and modals used semi-transparent background fills (`rgba(...)` or `bg-[var(--surface-main)]/80`) paired with `backdrop-filter: blur(...)` to allow the underlying background light to softly illuminate the component borders and surfaces.
- **Subtle Coloured Borders & Ambient Glows**: Borders used translucent accent-tinted dividers (`border-cyan-500/20`, `border-teal-500/20`), with soft drop-shadows reflecting the ambient light.

#### 2. Comparison with Current Codebase State
- **Current `.atmospheric-bg` in `src/index.css` (lines 100–123)**:
  Currently contains:
  ```css
  .atmospheric-bg {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
    background-color: var(--bg-app);
    background-image:
      radial-gradient(circle at 50% 12%, rgba(114, 168, 245, 0.08) 0%, transparent 60%),
      radial-gradient(circle at 80% 40%, rgba(101, 198, 155, 0.07) 0%, transparent 55%),
      radial-gradient(circle at 20% 65%, rgba(114, 168, 245, 0.06) 0%, transparent 50%),
      radial-gradient(circle at 65% 85%, rgba(101, 198, 155, 0.05) 0%, transparent 45%);
  }
  ```
- **Why Previous Attempts Produced Flat Backgrounds or Muddy Grey**:
  1. **Opaque Wrapper Occlusion**: In `src/App.tsx` (line 258), the root wrapper specifies `bg-[var(--bg-app)]`. Because `var(--bg-app)` was opaque charcoal (`#252D36`) or light grey (`#E7EBEF`), and child containers also had opaque background classes, the radial gradients beneath them were visually obscured.
  2. **Insufficient Gradient Opacity & Spread**: The radial gradient opacities were set too low (`0.05` to `0.08`) and lacked color range, giving the impression of a flat solid background rather than ambient illumination.
  3. **100% Opaque Component Surfaces**: Cards in `PaperCard.tsx`, `LandingPage.tsx`, and `WorkspacePage.tsx` were assigned 100% opaque fills (`bg-[#2D3741]` or `bg-[#EDF0F3]`), completely blocking background light diffusion.
  4. **Muddy Light Mode**: Light mode used `#E7EBEF` with flat grey surfaces, giving the impression of an unstyled grey wash rather than the crisp, airy light design with subtle ambient color that was originally desired.

#### 3. What Must Be Reconstructed
- Rebuild `.atmospheric-bg` with higher diffusion radial gradients utilizing the new five-colour palette.
- Remove opaque background fills from `App.tsx` and main layout wrappers so the `.atmospheric-bg` layer visibly illuminates the entire canvas.
- Convert solid card/panel surfaces to translucent surfaces (`80%–88%` opacity) with `backdrop-blur-md` across both dark and light modes.

---

### B. Current Light/Dark Theme Diagnosis

A complete audit of all routes and shared components revealed the following issues:

| File / Component | Existing Issue | Root Cause |
| :--- | :--- | :--- |
| **`src/App.tsx`** | Root layout has opaque `bg-[var(--bg-app)]` on outer `<div>` (line 258), blocking background gradients. | Hardcoded background class on the main wrapper. |
| **`src/components/Navbar.tsx`** | Sign-In button has hardcoded `from-blue-600 to-teal-500` gradient (line 262); avatar container has hardcoded `from-blue-500/30 to-teal-500/30` (line 190). | Residual legacy gradient classes. |
| **`src/components/PaperCard.tsx`** | Cards use opaque `bg-[var(--surface-main)]` without translucent alpha channel or backdrop blur. | Lacks translucent token binding (`bg-[var(--surface-main)]/85`). |
| **`src/pages/LandingPage.tsx`** | Showcase cards (lines 100–125) and feature containers use solid opaque backgrounds; hero background lacks atmospheric integration. | Hardcoded solid surface classes without translucency. |
| **`src/pages/BrowsePage.tsx`** | Search input and filter button deck use solid background fills without glassmorphic depth. | Opaque background styling on container and filter buttons. |
| **`src/pages/PaperDetailsPage.tsx`** | Document header card (line 275), viewer container, and discussion box use opaque surface backgrounds; action buttons lack uniform gradient outlines. | Solid background fills preventing background illumination. |
| **`src/pages/WorkspacePage.tsx`** | Workspace stat strip, project cards, and quick-note cards use opaque containers. | Solid surface fills without glass transparency. |
| **`src/components/workspace/ProjectWorkspaceView.tsx`** | Task list items, attached paper list, and notes tabs use flat opaque container fills. | Opaque surface tokens. |
| **`src/pages/SubmissionsPage.tsx`** | Empty state card (line 188) and submissions table (line 116) use solid cards; action buttons lack four-colour outline. | Opaque card backgrounds. |
| **`src/pages/UploadPage.tsx`** | File dropzone and form cards use opaque containers. | Solid background fills. |
| **`src/pages/ProfilePage.tsx`** | Overview metric tiles, bookmarks list, and settings tabs use flat opaque cards. | Solid surface tokens without translucency. |
| **`src/pages/AdminPage.tsx`** | Moderation queue cards, audit table rows, and action modals use opaque containers. | Opaque surface classes. |
| **`src/pages/AuthPage.tsx` & `AuthCard.tsx`** | Auth container and tab switchers use solid backgrounds. | Needs translucent glass container. |
| **Modals (`ReportRemovalModal`, `AddToProjectModal`, `QuickCaptureModal`, `LoginRequiredModal`, `EditCommunityPyqModal`)** | Dialogs use opaque bodies with standard borders instead of translucent glass surfaces with four-colour action button outlines. | Inconsistent modal background and button styling. |
| **`src/components/PaperViewer.tsx`** | Reading canvas container uses opaque styling; toolbar zoom controls need four-colour button outline alignment. | Solid background on toolbar and document canvas. |

---

### C. Five-Colour Blending Proposal for Both Themes

The new atmospheric blending architecture integrates the five requested colours (**Red, Blue, Yellow, Green, and Black/Charcoal**):

#### 1. Dark Mode (Default)
- **Base Foundation**: `#090D14` (Deep obsidian charcoal/black).
- **Main Surfaces**: `#131922` with 80% opacity (`backdrop-blur-md`).
- **Elevated Surfaces**: `#1B2430` with 85% opacity.
- **Secondary Surfaces**: `#222D3B` with 90% opacity.
- **Dividers & Borders**: `#2C3949` (Subtle hairline border).
- **Primary Text**: `#F1F5F9`.
- **Secondary Text**: `#94A3B8`.
- **Radial Gradient Emitters (Overlapping & Diffused)**:
  - **Red (`#E95F70`)**: Positioned at `18% 15%`, radius `48%`, opacity `16%`.
  - **Blue (`#528DEB`)**: Positioned at `82% 20%`, radius `55%`, opacity `20%`.
  - **Yellow (`#E7C25E`)**: Positioned at `52% 52%`, radius `42%`, opacity `12%`.
  - **Green (`#47B982`)**: Positioned at `24% 82%`, radius `50%`, opacity `16%`.
  - **Ambient Blue-Green Horizon**: Positioned at `75% 85%`, radius `45%`, opacity `14%`.

#### 2. Light Mode (Crisp, Airy, Non-Muddy)
- **Base Foundation**: `#F8FAFC` (Clean, bright slate canvas — NOT dull grey).
- **Main Surfaces**: `#FFFFFF` with 85% opacity (`backdrop-blur-md`).
- **Elevated Surfaces**: `#F1F4F7` with 90% opacity.
- **Secondary Surfaces**: `#E8EEF4` with 90% opacity.
- **Dividers & Borders**: `#E2E8F0`.
- **Primary Text**: `#0F172A`.
- **Secondary Text**: `#64748B`.
- **Radial Gradient Emitters (Soft Pastel Illumination)**:
  - **Red (`#D96B78`)**: Positioned at `18% 15%`, radius `48%`, opacity `6%`.
  - **Blue (`#477FD0`)**: Positioned at `82% 20%`, radius `55%`, opacity `8%`.
  - **Yellow (`#D2A849`)**: Positioned at `52% 52%`, radius `42%`, opacity `5%`.
  - **Green (`#399B73`)**: Positioned at `24% 82%`, radius `50%`, opacity `6%`.
  - **Ambient Blue Horizon**: Positioned at `75% 85%`, radius `45%`, opacity `5%`.

#### 3. Visual Stacking Hierarchy
```
Viewport Top
▲
│ [Modal Overlays & Dialogs] (z-50: backdrop-blur-md, bg-black/60)
│ [Top Navigation Bar & Drawer] (z-40: backdrop-blur-xl, bg-[var(--surface-main)]/90)
│ [Interactive Page Elements & Buttons] (z-10: .btn-quad-border, hover transitions)
│ [Translucent Card & Panel Surfaces] (z-10: bg-[var(--surface-main)]/85, backdrop-blur-md)
│ [Scroll Container] (z-0: transparent background, zero occlusion)
│ [.atmospheric-bg Canvas] (z-0: fixed inset-0, 5-colour overlapping radial gradients)
▼
Viewport Bottom
```

---

### D. Universal Four-Colour Button Outline Strategy & Complete Audit

#### 1. CSS Implementation (`.btn-quad-border`)
Implemented via a single reusable CSS utility class in `src/index.css` using `mask-composite: exclude`:
```css
/* Universal 4-Colour Gradient Outline: Red -> Yellow -> Blue -> Green */
.btn-quad-border {
  position: relative;
  isolation: isolate;
  background-clip: padding-box;
}

.btn-quad-border::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(135deg, var(--accent-red) 0%, var(--accent-yellow) 33%, var(--accent-blue) 66%, var(--accent-green) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  transition: opacity 0.2s ease, filter 0.2s ease;
  opacity: 0.85;
}

.btn-quad-border:hover::before {
  opacity: 1;
  filter: brightness(1.15);
}

.btn-quad-border:active::before {
  opacity: 1;
  filter: brightness(0.95);
}

.btn-quad-border:disabled::before {
  opacity: 0.35;
}
```

#### 2. Key Technical Advantages of This Implementation
- **Zero Layout Shift**: Because the gradient is rendered via an absolute `::before` pseudo-element with `inset: 0` and `padding: 1px`, it occupies exactly 1px without shifting layout, padding, font metrics, or child alignments.
- **Preserves Button Interiors**: Primary CTA buttons retain their solid accent fills, secondary buttons retain their translucent glass fills, and icon buttons retain their neutral states.
- **Preserves Focus Rings**: Native `:focus-visible` outlines (`outline: 2px solid var(--accent-blue); outline-offset: 2px;`) remain completely unobstructed.
- **Cross-Browser Compatible**: Uses standard CSS mask composites supported by all modern mobile and desktop browsers (Chrome, Safari, iOS WebKit, Firefox, Edge).

#### 3. Complete Button Audit Across the Application
Every actual button element throughout the project will receive `.btn-quad-border`:
1. **Header & Navigation (`src/components/Navbar.tsx`)**:
   - Menu drawer toggle button (`Menu`).
   - Home wordmark trigger.
   - Search palette trigger (`Search ⌘K`).
   - Workspace shortcut button.
   - Quick capture trigger (`Zap Capture`).
   - Theme toggle button (`Sun / Moon`).
   - User profile dropdown trigger.
   - Sign-In CTA button.
   - Mobile drawer links (`Workspace`, `Home`, `Browse`, `Upload`, `Bookmarks`, `About`, `Sign In/Profile`).
   - Mobile drawer close button (`X`).
2. **Landing Page (`src/pages/LandingPage.tsx`)**:
   - Hero primary CTA (`Browse Question Papers`).
   - Hero secondary CTA (`Launch Workspace`).
   - Showcase card action buttons (`Explore CBSE Class 12`, `Explore JEE Main`).
   - Feature section exploration buttons.
   - Bottom CTA banner button (`Get Started Free`).
3. **Library & Search (`src/pages/BrowsePage.tsx`)**:
   - Search submit button.
   - Search clear button (`X`).
   - Filter chips / segmented buttons (`All Boards`, `CBSE`, `ICSE`, `JEE Main`, `JEE Advanced`, `NEET UG`).
   - Grade level selector buttons (`All Classes`, `Class 10`, `Class 12`, `Competitive`).
   - Reset all filters button.
   - Pagination Previous / Next buttons.
4. **Document Cards (`src/components/PaperCard.tsx`)**:
   - Card title trigger.
   - Card `View` button.
   - Card `Download` button.
   - Card `Add to Project` button.
5. **Paper Details (`src/pages/PaperDetailsPage.tsx`)**:
   - Back to search button (`ArrowLeft`).
   - Top action: `Download PDF`.
   - Top action: `Add to Project`.
   - Top action: `Bookmark / Save`.
   - Top action: `Request Removal`.
   - Review form star rating buttons (1–5 stars).
   - Review submit button.
   - Discussion comment submit button.
   - Related paper preview buttons.
6. **Paper Viewer (`src/components/PaperViewer.tsx`)**:
   - Zoom out button (`ZoomOut`).
   - Zoom in button (`ZoomIn`).
   - Top toolbar `Download` button.
   - Open full image / Open new window button.
7. **Workspace & Projects (`src/pages/WorkspacePage.tsx` & `ProjectWorkspaceView.tsx`)**:
   - `New Study Project` button.
   - `Quick Capture Note` button.
   - Project card action buttons (`Open Project`, `Manage`).
   - Workspace view tab selectors (`Tasks`, `Attached Papers`, `Notes`, `Resources`).
   - `Add Task` button.
   - `Attach Paper` button.
   - Task completion checkboxes (styled toggle buttons).
   - Task delete buttons.
   - Export project summary button.
8. **Submissions (`src/pages/SubmissionsPage.tsx`)**:
   - `Upload Another Paper` button.
   - Submission row `View` button.
   - Submission row `Edit` button.
   - Submission row `Delete` button.
   - Empty state `Upload Your First Paper` CTA button.
9. **Upload Flow (`src/pages/UploadPage.tsx`)**:
   - File selector dropzone trigger button.
   - File remove / clear button.
   - `Cancel` button.
   - `Submit Paper` primary button.
10. **Profile & Account (`src/pages/ProfilePage.tsx`)**:
    - Sub-tab buttons (`Overview`, `Bookmarks`, `Uploads`, `Removal Requests`, `Settings`).
    - Bookmark item `View` and `Remove` buttons.
    - Settings `Save Changes` button.
11. **Admin Moderation (`src/pages/AdminPage.tsx`)**:
    - Moderation tab selectors (`Pending Queue`, `Removal Reports`, `Audit Trail`).
    - Queue `Approve` button.
    - Queue `Reject` button.
    - Report `Dismiss` button.
    - Report `Takedown` button.
12. **Authentication (`src/pages/AuthPage.tsx`, `AuthCard.tsx`, `SignIn.tsx`, `SignUp.tsx`)**:
    - Mode toggle tab buttons (`Sign In` vs `Sign Up`).
    - Primary authentication submit button (`Sign In to Studify` / `Create Account`).
    - Google OAuth button.
    - Back to Studify button.
13. **Modals & Dialogs**:
    - `ReportRemovalModal.tsx`: Close button, cancel button, submit report button.
    - `AddToProjectModal.tsx`: Close button, project item select buttons, create new project button.
    - `QuickCaptureModal.tsx`: Close button, capture type buttons (Thought, Formula, Doubt, Link), add tag button, remove tag button, save note button.
    - `LoginRequiredModal.tsx`: Close button, sign in button, create account button.
    - `EditCommunityPyqModal.tsx`: Close button, cancel button, update metadata button.

#### 4. Explicit Exclusions (What Is NOT Styled With `.btn-quad-border`)
- Text inputs (`<input type="text">`, `<input type="email">`, `<input type="password">`).
- Textareas (`<textarea>`).
- Dropdown select elements (`<select>`).
- Static metadata chips or informational tags.
- Content cards, bento boxes, or modal window frames.
- Table headers and data cells.

---

### E. Responsive Navigation and Button Audit

#### 1. Investigation of `MobileBottomNav.tsx`
- **Current State**: `src/components/MobileBottomNav.tsx` exists in the repository, but is **NOT mounted** anywhere in `App.tsx` or any page component.
- **Direct Comparison with Existing Navigation (`Navbar.tsx`)**:
  - `MobileBottomNav.tsx` renders 5 fixed bottom buttons: `Home`, `PYQs/Library`, `Upload`, `Saved`, `Profile/Sign in`.
  - `Navbar.tsx` already contains a dedicated Left Slide-Out Drawer (`isLeftMenuOpen`) containing:
    1. `Study Workspace`
    2. `Public Library / Browse`
    3. `Home`
    4. `Upload Past Paper`
    5. `Bookmarked Papers`
    6. `About Platform`
    7. `Sign In / Profile`
    8. `Theme Toggle`
    9. `Moderation Panel` (for owners)
- **Why Mounting `MobileBottomNav` Would Be Redundant and Detrimental**:
  - If `MobileBottomNav` were mounted on mobile screens:
    1. A fixed 56px bottom bar would sit permanently above the mobile safe area.
    2. The top navigation bar would still have the `Menu` button opening the drawer containing the exact same destinations.
    3. This duplicates destinations, crowds the viewport, reduces reading area on phones, and violates the 15% mobile sticky height cap.
- **Authoritative Resolution**:
  - **Preserve the existing single navigation architecture** via `Navbar.tsx` and its mobile drawer.
  - Do NOT mount `MobileBottomNav.tsx`.
  - Optimize the existing `Navbar.tsx` header bar and slide-out drawer so they perform reliably on all mobile screen sizes (320px–414px) without clipping, overlapping, or hiding controls.

#### 2. Responsive Button Layout Audit & Corrections

1. **`Navbar.tsx` (Top Header on 320px–380px)**:
   - **Problem**: On small screens (<380px), the header contains the Menu button, Studify wordmark, Theme toggle, and Sign In button. If padding is wide, buttons crowd or truncate.
   - **Correction**: Set `px-2.5 sm:px-4` on the header inner container, ensure `Menu` and `Theme Toggle` have compact 40px touch targets, and ensure the wordmark doesn't wrap (`whitespace-nowrap`).
2. **`PaperDetailsPage.tsx` (Action Bar on 320px–414px)**:
   - **Problem**: The action group (`Request Removal`, `Add to Project`, `Save`, `Download PDF`) uses `items-center gap-2`. On mobile screens, `hidden sm:inline` hides button labels, turning `Request Removal` into an unlabelled shield icon and `Add to Project` into an unlabelled folder icon, creating accessibility violations and unaligned heights.
   - **Correction**: Apply a responsive flex-wrap layout:
     ```tsx
     <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
       <button aria-label="Request Removal" className="btn-quad-border ...">...</button>
       <button aria-label="Add to Project" className="btn-quad-border ...">...</button>
       <button aria-label="Save to Bookmarks" className="btn-quad-border ...">...</button>
       <button aria-label="Download Document" className="btn-quad-border ...">...</button>
     </div>
     ```
     Ensure all buttons have explicit `aria-label` attributes and minimum touch targets of 44px.
3. **`BrowsePage.tsx` (Filter Chips on 320px–414px)**:
   - **Problem**: Filter chips for exam boards wrap onto multiple rows and can cause vertical layout jumps during filtering.
   - **Correction**: Wrap filter pills in a horizontal scroll container (`flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none sm:flex-wrap`) so users on 320px–390px screens can swipe through filters cleanly without layout distortion.
4. **`WorkspacePage.tsx` (Action Bar on 320px–414px)**:
   - **Problem**: `New Project` and `Quick Capture` buttons crowd the page title on narrow screens.
   - **Correction**: Use a stacked column header on `<640px` (`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`), placing the two action buttons in a full-width 2-column grid (`grid grid-cols-2 gap-2 w-full sm:w-auto`).

---

### F. Description-Generation Audit & Elimination of Appended Marks/Time

#### 1. Audit of Files That Generate or Render Descriptions
1. **`src/pages/PaperDetailsPage.tsx` (line 300)**:
   - **Existing Code**:
     ```tsx
     <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
       {currentPaper.description || `${currentPaper.subject} previous year examination paper with full question structure and official marking scheme.`}
     </p>
     ```
   - **Problem**: While the fallback itself doesn't hardcode numerical marks, previous versions concatenated `(70 Marks, 3 Hours)` directly into `paper.description`. Furthermore, the technical strip immediately below (lines 307–313) displays `{currentPaper.totalMarks} Marks` and `{currentPaper.timeAllowedMinutes / 60} Hours`.
   - **Correction**: Ensure description strictly displays genuine syllabus and educational curriculum notes. Total marks and duration are exclusively rendered in the technical specs strip, never inside the descriptive paragraph.
2. **`src/components/PaperCard.tsx` (line 77)**:
   - **Existing Code**:
     ```tsx
     <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
       {paper.description || `${paper.subject} previous year question paper with marking scheme.`}
     </p>
     ```
   - **Correction**: Clean fallback to strictly reference curriculum context without appending marks or time allowed.
3. **`src/pages/UploadPage.tsx` (lines 137–140)**:
   - **Existing Code**: The upload form previously suggested entering marks/time in the description box (`placeholder="e.g. CBSE Class 12 Physics 2024 board exam paper with complete question set..."`).
   - **Correction**: Clarify placeholder to guide students to write conceptual descriptions (e.g. syllabus topics covered, term 1/2, or question paper code). Marks and duration are collected in their own dedicated inputs or default metadata, not in the description text.
4. **`src/services/workspaceService.ts` (lines 817)**:
   - **Existing Code**:
     ```ts
     description: `Rule-based predicted mock examination paper generated from analysis of recurring PYQ weightages and question distribution patterns.`
     ```
   - **Correction**: Verified that predicted mock paper description does not append marks or time sentences.
5. **`src/App.tsx` (lines 213–217)**:
   - **Existing Code**: In the text export generator:
     ```ts
     `Subject: ${paper.subject} (${paper.year})\n` +
     `Title: ${paper.title}\n` +
     `Total Marks: ${paper.totalMarks}\n` +
     `Time: ${paper.timeAllowedMinutes / 60} Hours\n\n`
     ```
   - **Verification**: This is an exported plain-text document header, which is correct for downloaded exam papers. It does NOT modify `paper.description`.

#### 2. Preservation Rules
- Canonical fields `totalMarks` and `timeAllowedMinutes` remain intact in database tables (`community_pyqs`) and TypeScript interfaces.
- User-written descriptions are never modified or truncated.
- Marks and time continue to be prominently displayed in their dedicated UI badges.

---

### G. Complete File-by-File Implementation Plan

#### 1. `src/index.css`
- **Existing Behaviour**: Defines dark/light variables using grey/charcoal foundation and an incomplete 2-color radial gradient in `.atmospheric-bg`.
- **Specific Problem**: Gradients are too dim (`0.05`–`0.08`), wrong colours, and no universal 4-colour outline class exists.
- **Exact Proposed Change**:
  - Update `:root` and `.dark` variables to the new five-colour palette (**Red, Blue, Yellow, Green, Black/Charcoal** in dark mode; crisp `#F8FAFC` in light mode).
  - Define translucent surface tokens: `--surface-main-glass`, `--surface-elevated-glass`.
  - Rebuild `.atmospheric-bg` with 5 overlapping radial gradients using the exact hex coordinates and diffusion percentages.
  - Implement `.btn-quad-border` utility class with `mask-composite: exclude` for thin 1px continuous gradient borders.
- **Dependencies/Risks**: Foundational stylesheet; all components consume these tokens.

#### 2. `src/App.tsx`
- **Existing Behaviour**: Opaque `bg-[var(--bg-app)]` on outer `<div>` (line 258); `MobileBottomNav` unmounted.
- **Specific Problem**: Outer wrapper's opaque background prevents `.atmospheric-bg` from showing through.
- **Exact Proposed Change**:
  - Change line 258 from `bg-[var(--bg-app)]` to transparent background with relative positioning, allowing `.atmospheric-bg` to illuminate the entire layout.
  - Retain the clean, authoritative navigation architecture via `Navbar.tsx` (do not mount duplicate bottom navigation).
  - Verify theme provider and auth modal wiring.
- **Dependencies/Risks**: Core layout root; ensures global atmospheric visibility.

#### 3. `src/components/Navbar.tsx`
- **Existing Behaviour**: Solid surfaces with legacy gradient classes on Sign-In button and avatar initials.
- **Specific Problem**: Legacy teal gradients present; buttons lack universal `.btn-quad-border`.
- **Exact Proposed Change**:
  - Replace solid background with translucent glass (`bg-[var(--surface-main)]/90 backdrop-blur-xl`).
  - Replace legacy teal gradient on Sign-In button (line 262) with solid accent fill plus `.btn-quad-border`.
  - Replace legacy teal gradient on avatar (line 190) with design token classes.
  - Apply `.btn-quad-border` to all interactive buttons: Menu toggle, Search palette, Workspace shortcut, Quick Capture, Theme toggle, Profile trigger, Sign-In button, and Drawer links.
  - Optimize mobile spacing (<380px) to prevent button wrapping.
- **Dependencies/Risks**: Primary navigation component; must maintain working handlers for drawer, modal triggers, and theme toggle.

#### 4. `src/components/PaperCard.tsx`
- **Existing Behaviour**: Opaque card background; standard button borders.
- **Specific Problem**: Card blocks background gradient diffusion; buttons lack 4-colour outline.
- **Exact Proposed Change**:
  - Update card container to use translucent glass (`bg-[var(--surface-main)]/85 backdrop-blur-sm`).
  - Apply `.btn-quad-border` to card action buttons (`View`, `Download`, `Add to Project`).
  - Ensure fallback description does not append marks or time sentences.
- **Dependencies/Risks**: Rendered in Library, Homepage, and Workspace.

#### 5. `src/pages/LandingPage.tsx`
- **Existing Behaviour**: Clean layout with opaque surface cards.
- **Specific Problem**: Showcase cards and feature containers block atmospheric gradient glow; hero CTA buttons lack 4-colour outline.
- **Exact Proposed Change**:
  - Apply translucent surface depth to hero showcase cards, feature blocks, and CTA banner.
  - Apply `.btn-quad-border` to hero CTAs (`Browse Question Papers`, `Launch Workspace`) and showcase action buttons.
  - Verify zero S-logo emblems; ensure plain text wordmark **Studify**.
- **Dependencies/Risks**: Public landing page; must preserve all existing sections and content.

#### 6. `src/pages/BrowsePage.tsx`
- **Existing Behaviour**: Opaque search container and filter pills; standard borders.
- **Specific Problem**: Filter chips lack 4-colour outline and can cause layout jumps on small screens.
- **Exact Proposed Change**:
  - Apply translucent glass styling to search card and results container.
  - Apply `.btn-quad-border` to search button, filter toggle buttons, and pagination controls.
  - Add horizontal scrolling container (`overflow-x-auto`) for filter chips on `<640px` screens.
- **Dependencies/Risks**: Library view; filter states must remain fully functional.

#### 7. `src/pages/PaperDetailsPage.tsx`
- **Existing Behaviour**: Opaque document card; action buttons wrap awkwardly on mobile; fallback description phrasing.
- **Specific Problem**: Action buttons lack touch target consistency and 4-colour outline; description needs decoupling from specs.
- **Exact Proposed Change**:
  - Decouple description from technical specifications: description strictly displays curriculum notes.
  - Marks (`70 Marks`) and duration (`3 Hours`) remain exclusively in the technical specs bar with dedicated icons.
  - Wrap action buttons in a responsive container with `flex-wrap gap-2.5`, minimum 44px touch targets, and `.btn-quad-border`.
  - Apply translucent surfaces to discussion threads, related papers, and paper viewer container.
- **Dependencies/Risks**: Core document consumption view.

#### 8. `src/components/PaperViewer.tsx`
- **Existing Behaviour**: Document preview container with zoom and download controls.
- **Specific Problem**: Zoom buttons and download button lack 4-colour outline; container is opaque.
- **Exact Proposed Change**:
  - Apply translucent glass styling to viewer header toolbar.
  - Apply `.btn-quad-border` to `ZoomOut`, `ZoomIn`, `Download`, and `Open External` buttons.
- **Dependencies/Risks**: Embedded in PaperDetailsPage.

#### 9. `src/pages/WorkspacePage.tsx` & `ProjectWorkspaceView.tsx`
- **Existing Behaviour**: Study workspace with project cards, stat strip, and task views.
- **Specific Problem**: Surfaces are opaque; workspace action buttons lack 4-colour outline.
- **Exact Proposed Change**:
  - Apply translucent surface panels over the atmospheric background.
  - Apply `.btn-quad-border` to workspace actions (`New Project`, `Quick Capture`, `Add Paper`, tab selectors, export summary).
  - Ensure descriptions for projects and tasks remain clean of artificial marks text.
- **Dependencies/Risks**: Workspace feature suite; maintains localStorage + Supabase persistence.

#### 10. `src/pages/SubmissionsPage.tsx`
- **Existing Behaviour**: Contributor papers list with opaque cards.
- **Specific Problem**: Lacks atmospheric translucency; action buttons lack 4-colour outline.
- **Exact Proposed Change**:
  - Apply translucent surface styling with `backdrop-blur-sm`.
  - Apply `.btn-quad-border` to action buttons (`Upload Another Paper`, `View`, `Edit`, `Delete`).
  - Ensure paper description preview is free of redundant marks text.
- **Dependencies/Risks**: Contributor document management.

#### 11. `src/pages/UploadPage.tsx`
- **Existing Behaviour**: Upload form with file dropzone.
- **Specific Problem**: Opaque container; buttons lack 4-colour outline; description helper text could encourage marks insertion.
- **Exact Proposed Change**:
  - Clarify description placeholder and helper text to focus strictly on syllabus topics.
  - Apply `.btn-quad-border` to `Select File`, `Remove`, and `Submit Paper` buttons.
  - Translucent styling for the dropzone container.
- **Dependencies/Risks**: 20MB upload pipeline and community paper database record.

#### 12. `src/pages/ProfilePage.tsx` & `AdminPage.tsx`
- **Existing Behaviour**: User profile tabs and administrator moderation tables.
- **Specific Problem**: Opaque card containers; buttons lack 4-colour outline.
- **Exact Proposed Change**:
  - Tokenize all sub-tabs (Overview, Bookmarks, Uploads, Settings) and moderation controls with translucent glass surfaces.
  - Apply `.btn-quad-border` to all interactive buttons (Edit Profile, Save Settings, Approve, Reject, Takedown).
- **Dependencies/Risks**: Protected and administrative views.

#### 13. `src/pages/AuthPage.tsx`, `AuthCard.tsx`, `SignIn.tsx`, `SignUp.tsx`
- **Existing Behaviour**: Authentication screens and modal overlays.
- **Specific Problem**: Opaque cards; buttons lack 4-colour outline.
- **Exact Proposed Change**:
  - Apply translucent surface card styling with `backdrop-blur-md`.
  - Apply `.btn-quad-border` to primary authentication buttons (Submit, Google Sign-In, mode toggles).
- **Dependencies/Risks**: Authentication flow and Google OAuth.

#### 14. Modals (`ReportRemovalModal.tsx`, `AddToProjectModal.tsx`, `QuickCaptureModal.tsx`, `LoginRequiredModal.tsx`, `EditCommunityPyqModal.tsx`)
- **Existing Behaviour**: Modal dialogs.
- **Specific Problem**: Dialog bodies are opaque; buttons lack 4-colour outline.
- **Exact Proposed Change**:
  - Modal overlay with `bg-black/60 backdrop-blur-sm`.
  - Modal content cards with translucent surfaces and `.btn-quad-border` on primary submit, cancel, and action buttons.
- **Dependencies/Risks**: Interactive dialogs across the app.

---

### H. Responsive and Theme Verification Matrix

| Viewport Width | Device Target | Verification Items |
| :--- | :--- | :--- |
| **320px** | iPhone SE (1st gen) | Zero horizontal clipping; Navbar wordmark fits without wrapping; Menu drawer opens cleanly; action buttons wrap without overflow; 4-colour outline visible on all buttons. |
| **360px** | Galaxy S8 / Android Mini | 44px touch targets; search filter chips scrollable/wrapped; paper cards readable; atmospheric glow subtly visible through card surfaces. |
| **390px** | iPhone 13/14/15/16 | PaperDetailsPage action buttons formatted cleanly with labels; reading canvas responsive; safe-area respected; dark mode foundation `#090D14` verified. |
| **414px** | iPhone Plus / Max | Modal dialogs centered with adequate padding; drawer navigation comfortably accessible; light mode foundation `#F8FAFC` verified. |
| **768px** | iPad Mini / Tablet Portrait | Smooth tablet layout; 2-column card grid; navigation links and actions spaced cleanly; background radial gradients blend without hard edges. |
| **1024px** | iPad Pro / Small Laptop | Full desktop navigation bar visible; 3-column library grid; atmospheric gradients nicely distributed across wide canvas. |
| **1440px** | Desktop Baseline | Content container max-w-6xl balanced; atmospheric glow creates rich depth without visual clutter; theme toggle operates instantaneously. |

---

### I. Final Scope Checklist

- [ ] **1. Atmospheric Design**: Multi-layer radial gradient background rebuilt with high diffusion in `src/index.css`; root wrapper in `App.tsx` made transparent; cards and panels given translucent surface fills with `backdrop-blur-md`.
- [ ] **2. Five-Colour Identity**: Dark mode uses `#090D14` base with Red (`#E95F70`), Blue (`#528DEB`), Yellow (`#E7C25E`), and Green (`#47B982`); Light mode uses `#F8FAFC` base with Red (`#D96B78`), Blue (`#477FD0`), Yellow (`#D2A849`), and Green (`#399B73`).
- [ ] **3. Complete Theme Coverage**: All routes (Homepage, Library, Paper Details, Workspace, Submissions, Upload, Profile, Admin, Auth) and shared components (modals, dropdowns, forms, document viewers) respond to theme toggling without leftover dark or light styles.
- [ ] **4. Universal Button Outline**: Reusable `.btn-quad-border` class applies a thin continuous gradient border in exact order **Red → Yellow → Blue → Green** across every interactive button, while strictly excluding inputs, textareas, selects, and static badges.
- [ ] **5. Responsive Navigation & Buttons**: Preserves the existing `Navbar.tsx` and slide-out drawer architecture without injecting redundant bottom navigation; resolves button clipping, touch targets, and wrapping on 320px–414px screens.
- [ ] **6. Description Cleanliness**: Marks and duration are completely decoupled from descriptive prose in `PaperDetailsPage`, `PaperCard`, `UploadPage`, and prediction services; dedicated metadata badges remain intact.
- [ ] **7. Visual Stacking & Readability**: Atmospheric glow provides rich background depth without impairing text contrast or legibility.
- [ ] **8. Layout & Feature Preservation**: Existing routes, section order, database integrations, authentication flows, and the original Studify homepage are 100% preserved. No standalone S-emblem is reintroduced.
- [ ] **9. Code Quality**: Zero TypeScript or compilation errors (`tsc --noEmit` and Vite build).
