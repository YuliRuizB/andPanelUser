import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthenticationService } from '../../services/authentication.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login-component',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './login-component.html',
  styleUrl: './login-component.css',
})
export class LoginComponent {
  loginForm!: FormGroup;
  showPassword = false;

  constructor(private fb: FormBuilder,private notification: ToastService , private authService: AuthenticationService) {
    this.createForm();
  }

  createForm() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false]
    });
  }
  onSubmit() {
     
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { email, password, remember } = this.loginForm.value;     
      this.authService.signIn( email, password);      
      this.notification.success('Inicio de sesión exitoso', 'And Informa');
      
  }

  togglePassword() {
  this.showPassword = !this.showPassword;
}

}
