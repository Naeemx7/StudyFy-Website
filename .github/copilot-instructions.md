# StudyFy AI Study Companion Frontend - Copilot Instructions

## Project Overview
This is an **Angular 20** standalone application for an AI-powered study companion platform. The project uses Angular's modern standalone APIs, Tailwind CSS, and RxJS for reactive state management. The backend integrates with OpenAI APIs.

**Key Technologies:**
- **Framework:** Angular 20.3.5 (standalone components, functional APIs)
- **Styling:** Tailwind CSS 3.4
- **Testing:** Karma + Jasmine
- **Build Tool:** Angular CLI 20.3.5
- **Language:** TypeScript 5.9.2

## Architecture & Core Patterns

### Component Structure
Components follow a **modular page-based architecture** organized in `src/app/pages/`:
```
pages/
  ├── landing/          # Public landing page (with landing-navbar subcomponent)
  ├── auth/
  │   ├── login/        # Public login page
  │   └── signup/       # Public signup page
  ├── dashboard/        # Protected: user dashboard (stub)
  ├── workspace/        # Protected: main study workspace (stub)
  ├── quiz/             # Protected: quiz interface (stub)
  ├── analytics/        # Protected: learning analytics (stub)
  ├── profile/          # Protected: user profile (stub)
  ├── settings/         # Protected: user settings (stub)
  └── roadmap/          # Protected: learning roadmap (stub)
```

**Component File Pattern:**
- `{name}.ts` - Component class with standalone decorators
- `{name}.html` - Template (uses Angular interpolation, `*ngIf`, `*ngFor`)
- `{name}.css` - Component-scoped styles (minimal, prefer Tailwind)
- `{name}.spec.ts` - Unit tests (Jasmine)

**Current Status:**
- ✅ **Complete:** LandingComponent, LoginComponent, SignupComponent (with ReactiveFormsModule)
- 🔄 **Stubs:** Dashboard, Roadmap, Workspace, Quiz, Analytics, Profile, Settings (ready for implementation)

### Routing & Guards
- **Routes:** Defined in `src/app/app.routes.ts` using Angular's functional routing
- **Protected Routes:** All routes except `/`, `/login`, `/signup` require `AuthGuard`
- **Guard Implementation:** `src/app/guards/auth.guard.ts` checks `authService.isLoggedIn()` before activating routes
- **Redirect Logic:** Unauthenticated users redirected to `/login` via `router.createUrlTree()`

### State Management (Reactive)
**AuthService** (`src/app/services/auth.service.ts`) is the single source of truth:
- Uses `BehaviorSubject` for reactive user state
- Exposes `currentUser$: Observable<AuthUser | null>`
- Persists auth to localStorage (`asc_auth_user` key)
- Mock authentication with 400-500ms simulated delays
- AuthUser interface: `{id, name, email, role: 'student'|'professional', token}`

**Pattern:** Components subscribe via `async` pipe: `{{ authService.currentUser$ | async }}`

### Signals (Modern Angular Feature)
The root App component uses Angular signals:
```typescript
protected readonly title = signal('ai-study-companion');
```
For new state, prefer signals over BehaviorSubjects unless observables are required.

## Development Workflow

### Build & Run
```bash
npm start           # ng serve (dev server on :4200)
npm run build       # Production build to dist/
npm run watch       # Watch mode for development
npm test            # Karma test runner
```

### Component Generation
Use Angular CLI schematics (preferred over manual creation):
```bash
ng generate component pages/{page-name}/{page-name}
```
This auto-generates the 4-file structure with correct imports.

### Code Style
- **Imports:** Group by Angular, third-party, then relative imports
- **Prettier Config:** 100-char line width, single quotes, Angular HTML parser
- **Naming:** PascalCase components (e.g., `DashboardComponent`), kebab-case selectors (e.g., `app-dashboard`)

## Testing
- **Framework:** Jasmine + Karma
- **Test Files:** `*.spec.ts` colocated with components
- **Test Setup:** `TestBed.configureTestingModule()` with `provideRouter([])` for route-dependent tests
- **Async Patterns:** Use `fakeAsync`, `tick()` for observable testing
- **Service Mocks:** Use `jasmine.createSpyObj()` for service dependencies
- Run tests: `npm test` (watches for changes, opens browser)

## Forms & Validation

**Current Implementation (Login/Signup):**
- Uses `ReactiveFormsModule` with `FormBuilder` for type-safe reactive forms
- Pattern: Create `FormGroup` in constructor, use `formControlName` in template
- Validation: Standard validators like `Validators.required`, `Validators.email`, `Validators.minLength()`
- Error messages displayed when form control is touched AND invalid
- Examples: See `LoginComponent` in `src/app/pages/auth/login/login.ts` and `SignupComponent` in `src/app/pages/auth/signup/signup.ts`

**For New Forms:**
```typescript
// In component constructor
this.form = this.fb.group({
  fieldName: ['', [Validators.required, Validators.email]]
});

// In template
<input formControlName="fieldName" />
<p *ngIf="form.get('fieldName')?.touched && form.get('fieldName')?.invalid">Error</p>

// In submit
if (this.form.invalid) return;
const data = this.form.value;
```

## Backend Integration (PENDING)

**HttpClient Setup:**
- Add `provideHttpClient()` to `src/app/app.config.ts`
- Example: `providers: [..., provideHttpClient()]`

**Services Needed:**
- `space.service.ts` - CRUD for Spaces, list user spaces
- `file.service.ts` - Upload files, list, retrieve content
- `quiz.service.ts` - Generate quiz, submit answers, calculate scores
- `ai.service.ts` - Summarize, flashcards, Q&A (uses OpenAI SDK ^6.16.0)
- `analytics.service.ts` - Fetch performance data, mastery status
- `badge.service.ts` - Award badges, list earned badges

**Expected API Base URL:**
- Define in `app.config.ts` or `environment.ts` (not yet created)
- Currently no environment configuration; add when needed

**Reference Pattern (from AuthService):**
```typescript
constructor(private http: HttpClient) { }

methodName(param: string): Observable<ResponseType> {
  return this.http.post<ResponseType>('/api/endpoint', { param }).pipe(
    tap(result => this.updateLocalState(result)),
    catchError(err => this.handleError(err))
  );
}
```

## Product Feature Map
The app follows this core user journey:

1. **Dashboard** (`/dashboard`) - Hub showing active Spaces, study streak, quick stats
   - Displays `Study Streak` (days), `Files Mastered`, `Quizzes Completed`, `Avg Score`
   - Space cards show progress bars (% complete)
   - Quick action buttons: "Continue Studying", "Take a Quiz", "View Analytics"

2. **Roadmap** (`/roadmap`) - Visual learning timeline for a specific Space
   - Shows all materials in a Space with mastery status (green=80%+, yellow=50-79%, red=<50%, grey=locked)
   - Progress bar shows "40% Complete, 2/5 Mastered"
   - File items display quiz scores and quick actions
   - "Needs Attention" alerts for weak areas

3. **Workspace** (`/workspace`) - Document viewer + AI companion
   - Left pane: PDF/document viewer with highlighting
   - Right pane: AI Chat interface with context-aware responses
   - Action buttons: "Summarize", "Key Concepts", "Explain Simply", "Quiz Mode"
   - Document status badge ("In Progress", "Mastered")

4. **Quiz** (`/quiz`) - Assessment interface
   - Quiz intro with expectations (e.g., "5 multiple choice, 80% to mark mastered")
   - Question display with instant feedback
   - Records quiz result, updates progress data

5. **Analytics** (`/analytics`) - Performance insights
   - Metrics: Total study time, avg quiz score, streak, topics mastered
   - Charts: Knowledge map (radar), weekly activity (bar chart)
   - "Areas Needing Review" (red) vs "Your Strengths" (green) sections
   - Exam Readiness Report (overall % ready)

6. **Profile** (`/profile`) - User stats & badges
   - User info card with role badge
   - 4-stat grid: Study Streak, Spaces Created, Quizzes Completed, Badges Earned
   - Badges section with earned achievements
   - Recent Activity feed

7. **Settings** (`/settings`) - Account management
   - Tabs: Account, Notifications, Privacy & Security, Appearance, Language & Region
   - Standard form fields (name, email, institution)

## Data Models & Key Concepts

### Core Entities
```typescript
// Space - Subject/course container
{ id, userId, title, description, progressPercent, created, files: [] }

// File - Study material within a Space
{ id, spaceId, title, type: 'pdf'|'audio'|'notes', uploadedAt, status: 'locked'|'in-progress'|'mastered' }

// Quiz - Assessment linked to a file
{ id, fileId, questions, passingScore: 80, userScore, attempts, masteredAt? }

// PerformanceData - Aggregated progress for analytics
{ userId, spaceId, totalStudyTime, avgQuizScore, topicsWithWeakSpots: [] }

// Badge - Gamification achievement
{ id, type: 'streak'|'mastery'|'volume', earnedAt, space? }
```

### Key Thresholds
- **Mastery Score:** 80%+ on quiz marks file/topic as "Mastered" (green in Roadmap)
- **Needs Review:** <50% (red alert on Roadmap)
- **In Progress:** 50-79% (yellow/amber status)

## Frontend-Backend Integration Points
**Services needed in `src/app/services/`:**
- `space.service.ts` - CRUD for Spaces, list user spaces
- `file.service.ts` - Upload, list, get file with content
- `quiz.service.ts` - Generate quiz from file (AI call), submit answers, calculate score
- `ai.service.ts` - Summarize, generate flashcards, Q&A chat (uses OpenAI SDK)
- `analytics.service.ts` - Fetch performance data, calculate mastery status
- `badge.service.ts` - Award badges, list earned badges

**Expected API responses** (backend will provide):
- `POST /spaces` → Space object
- `POST /files/:spaceId` → Upload file, get File with extracted text
- `POST /quiz/generate` → Quiz object with questions
- `POST /quiz/:quizId/submit` → { score, passed, masteredAt? }
- `GET /analytics/:spaceId` → Performance metrics

## Critical Files & Conventions
- `src/app/app.routes.ts` - All route definitions (update when adding pages)
- `src/app/app.config.ts` - Global Angular config
- `src/app/services/` - Business logic and backend integration
- `src/app/guards/auth.guard.ts` - Protects all routes except /, /login, /signup
- `src/styles.css` - Global Tailwind imports
- Color tokens: Use Tailwind utilities; status colors: green (80%+), amber (50-79%), red (<50%), grey (locked)

## Common Tasks
1. **Add Protected Page:** Create in `pages/`, define route in `app.routes.ts` with `canActivate: [AuthGuard]`
2. **Create API Service:** Add service in `services/`, inject `HttpClient`, return `Observable<T>`, use in components
3. **Display Current User:** Inject `AuthService`, bind `currentUser$ | async` in template
4. **Track Quiz Performance:** Service records score, emits to analytics aggregator, roadmap updates
5. **Award Badge:** Check badge condition (e.g., 7-day streak), call `badge.service.award()`, emit event to reload Profile

## Known Conventions
- Components are **standalone** (no module imports needed)
- Mock authentication delays (400-500ms) simulate network latency—backend API will replace
- All user-facing pages in `pages/`; future shared UI components go in `components/` folder
- Tests use `TestBed.createComponent()` pattern; mock services with `jasmine.createSpyObj()`
- Status indicators: Green (#10b981), Amber (#f59e0b), Red (#ef4444), Grey (#9ca3af)

