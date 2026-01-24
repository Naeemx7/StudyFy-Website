import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './landing-navbar.html',
  styleUrls: ['./landing-navbar.css'],
})
export class LandingNavbar {
  isMenuOpen = signal(false);

  toggleMenu() {
    this.isMenuOpen.update(value => !value);
  }

  closeMenu() {
    this.isMenuOpen.set(false);
  }
}
