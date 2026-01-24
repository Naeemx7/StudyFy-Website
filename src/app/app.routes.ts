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

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'workspace', component: WorkspaceComponent },
  { path: 'roadmap', component: RoadmapComponent },
  { path: 'quiz', component: QuizComponent },
  { path: 'analytics', component: AnalyticsComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'settings', component: SettingsComponent },
];