import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LandingNavbar } from './landing-navbar/landing-navbar';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, LandingNavbar],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingComponent  {
currentYear: any;
}
