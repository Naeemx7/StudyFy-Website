import { Component, inject, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html'
})
export class NavbarComponent {
  private elementRef = inject(ElementRef);
  private auth = inject(AuthService);
  private router = inject(Router);
  
  currentUser$ = this.auth.currentUser$;
  isDropdownOpen = false;

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

  getInitials(name: string | undefined): string {
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
