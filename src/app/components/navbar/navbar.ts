/**
 * Navbar Component
 * 
 * The top navigation bar shown on all protected pages.
 * Shows:
 * - App logo and name
 * - Navigation links (Dashboard, Analytics)
 * - User profile dropdown with logout
 * 
 * Uses currentUser$ from AuthService to display user info.
 */

import { Component, inject, ElementRef, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SpaceService } from '../../services/space.service';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html'
})
export class NavbarComponent implements OnInit {
  private elementRef = inject(ElementRef);
  private auth = inject(AuthService);
  private spaceService = inject(SpaceService);
  private analyticsService = inject(AnalyticsService);
  private router = inject(Router);
  
  currentUser$ = this.auth.currentUser$;
  isDropdownOpen = false;
  streak = 0;

  ngOnInit(): void {
    this.analyticsService.getGlobalAnalytics().subscribe({
      next: (data) => { this.streak = data.currentStreak ?? 0; },
      error: () => { /* silent fail — streak stays 0 */ },
    });
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  // Close dropdown when clicking outside
  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isDropdownOpen = false;
    }
  }

  /**
   * Get user initials for avatar
   * Uses first char of display name
   */
  getInitials(userName: string | undefined): string {
    return userName ? userName.charAt(0).toUpperCase() : 'U';
  }

  /**
   * Get display-friendly name
   * For Google users who sign in with email, strips the @domain part
   */
  getDisplayName(userName: string | undefined): string {
    if (!userName) return 'User';
    // If it's an email address, strip the domain
    if (userName.includes('@')) return userName.split('@')[0];
    // Otherwise show as-is (works for both full names and plain usernames)
    return userName;
  }

  /**
   * Logout user
   * Clears auth data, clears cached spaces, redirects to login
   */
  logout() {
    this.auth.logout();
    this.spaceService.clearSpaces();
    this.router.navigate(['/login']);
  }
}
