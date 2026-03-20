import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing';
import { LoginComponent } from './pages/auth/login/login';
import { SignupComponent } from './pages/auth/signup/signup';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { WorkspaceComponent } from './pages/workspace/workspace';
import { RoadmapComponent } from './pages/roadmap/roadmap';
import { QuizComponent } from './pages/quiz/quiz';
import { AnalyticsComponent } from './pages/analytics/analytics';
import { ProfileComponent } from './pages/profile/profile';
import { SettingsComponent } from './pages/settings/settings';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'roadmap/:spaceId', component: RoadmapComponent, canActivate: [AuthGuard] },
  { path: 'workspace/:spaceId', component: WorkspaceComponent, canActivate: [AuthGuard] },
  { path: 'quiz/:spaceId', component: QuizComponent, canActivate: [AuthGuard] },
  { path: 'analytics', component: AnalyticsComponent, canActivate: [AuthGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
];
