import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { catchError, map, Observable, of, switchMap, timer } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { Role } from '../models/role.model';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/users`;

  // ==========================================
  // Consultas (GET)
  // ==========================================
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/`);
  }

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`);
  }

  // ==========================================
  // Operações de Escrita / CRUD
  // ==========================================
  createUser(data: User): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/`, data);
  }

  updateUser(userId: number, data: User): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${userId}`, data);
  }

  deleteUser(userId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${userId}`);
  }

  // ==========================================
  // Ações de Usuário
  // ==========================================
  lockUser(userId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${userId}/lock`, {});
  }

  validateUser(userId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${userId}/validate`, {});
  }

  rolesUser(userId: number, data: Role[]): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${userId}/roles`, data);
  }

  // ==========================================
  // Métodos de Checagem HTTP (Simples)
  // ==========================================
  checkEmailExists(email: string, currentEmail?: string | null): Observable<boolean> {
    const encodedEmail = encodeURIComponent(email);
    const encodedCompare = encodeURIComponent(currentEmail || '');
    return this.http.get<boolean>(`${this.apiUrl}/exists-email/${encodedEmail}/${encodedCompare}`);
  }

  checkCnsExists(cns: string, currentCns?: string | null): Observable<boolean> {
    const cleanCns = cns.replace(/\D/g, '');
    const encodedCns = encodeURIComponent(cleanCns);
    const encodedCompare = encodeURIComponent(currentCns || '');
    return this.http.get<boolean>(`${this.apiUrl}/exists-cns/${encodedCns}/${encodedCompare}`);
  }

  // ==========================================
  // Validadores Assíncronos Nativos (com Debounce)
  // ==========================================
  emailUserExistsValidator(currentEmail?: string | null): AsyncValidatorFn {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const email = control.value?.trim().toLowerCase();
      
      // Só dispara se preenchido e com formato válido
      if (!email || !EMAIL_REGEX.test(email)) {
        return of(null);
      }

      // timer(400) aguarda 400ms sem digitação.
      // switchMap cancela a requisição anterior se o usuário voltar a digitar.
      return timer(400).pipe(
        switchMap(() => this.checkEmailExists(email, currentEmail)),
        map(exists => (exists ? { emailExists: true } : null)),
        catchError(() => of(null))
      );
    };
  }

  cnsUserExistsValidator(currentCns?: string | null): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const cnsClean = control.value ? String(control.value).replace(/\D/g, '') : '';

      // Só dispara se tiver exatamente 15 dígitos
      if (cnsClean.length !== 15) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() => this.checkCnsExists(cnsClean, currentCns)),
        map(exists => (exists ? { cnsExists: true } : null)),
        catchError(() => of(null))
      );
    };
  }
}