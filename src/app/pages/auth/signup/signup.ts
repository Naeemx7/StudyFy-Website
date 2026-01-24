import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, RouterLink], 
  templateUrl: './signup.html',
  styleUrl: './signup.css'
}) 
export class SignupComponent {
  selectedRole: string = 'student';

  selectRole(role: string) {
    this.selectedRole = role;
  }
}