import { Component } from '@angular/core';
import { LandingNavbar } from './landing-navbar/landing-navbar';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [LandingNavbar],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingComponent {}
