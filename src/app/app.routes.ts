import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { Login } from './pages/auth/login/login';
import { Signup } from './pages/auth/signup/signup';
import { Dashboard } from './pages/dashboard/dashboard';
import { Workspace } from './pages/workspace/workspace';
import { Roadmap } from './pages/roadmap/roadmap';
import { Quiz } from './pages/quiz/quiz';
import { Analytics } from './pages/analytics/analytics';
import { Profile } from './pages/profile/profile';
import { Settings } from './pages/settings/settings';

export const routes: Routes = [
  { path: '', component: Landing },
  { path: 'login', component: Login },
  { path: 'signup', component: Signup },
  { path: 'dashboard', component: Dashboard },
  { path: 'workspace', component: Workspace },
  { path: 'roadmap', component: Roadmap },
  { path: 'quiz', component: Quiz },
  { path: 'analytics', component: Analytics },
  { path: 'profile', component: Profile },
  { path: 'settings', component: Settings },
];