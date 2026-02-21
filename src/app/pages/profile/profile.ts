import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; 
  iconBg: string; // Tailwind class for icon background
  iconColor: string; // Tailwind class for icon color
  earned: boolean;
}

interface Activity {
  id: string;
  type: 'quiz' | 'study' | 'mastery';
  action: string;   // e.g. "Completed quiz"
  subject: string;  // e.g. "Virtual Memory"
  details?: string; // e.g. "(80%)"
  time: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, NavbarComponent, RouterLink], 
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfileComponent {
  authService = inject(AuthService);
  currentUser$ = this.authService.currentUser$; 

  // Mock Stats matching the screenshot
  stats = {
    streak: 7,
    spacesCreated: 3,
    quizzesCompleted: 23,
    badgesEarned: 3
  };

  // Mock Badges matching screenshot
  badges: Badge[] = [
    {
      id: '1',
      name: '7-Day Streak',
      description: 'Studied for 7 consecutive days',
      icon: '🔥',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      earned: true
    },
    {
      id: '2',
      name: 'Quiz Master',
      description: 'Completed 10 quizzes',
      icon: '🎯', 
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      earned: true
    },
    {
      id: '3',
      name: 'First Space',
      description: 'Created your first study space',
      icon: '🚀', 
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      earned: true
    }
  ];

  // Mock Activity splitting action/subject for bolding
  activities: Activity[] = [
    {
      id: '1',
      type: 'quiz',
      action: 'Completed quiz',
      subject: 'Virtual Memory',
      details: '(80%)',
      time: '2 hours ago'
    },
    {
      id: '2',
      type: 'study',
      action: 'Started studying',
      subject: 'Page Replacement',
      time: '3 hours ago'
    },
    {
      id: '3',
      type: 'mastery',
      action: 'Mastered topic',
      subject: 'Paging Basics',
      time: '1 day ago'
    }
  ];

  getInitials(name: string | undefined): string {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 1).toUpperCase() : 'U';
  }
}
