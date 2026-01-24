import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-navbar.html',
  styleUrls: ['./landing-navbar.css'],
})
export class LandingNavbar {}
