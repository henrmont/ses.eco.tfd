import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { catchError, map, Observable, of, switchMap, timer } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { Role } from '../../core/models/role.model';
import { TfdUser as User } from '../models/user.model';

interface AvailabilityResponse {
  available: boolean;
  exists: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/users`;

  // ==========================================
  // Consultas (GET)
  // ==========================================
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`);
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`);
  }

  // ==========================================
  // Operações de Escrita / CRUD
  // ==========================================
  createUser(data: User): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.apiUrl, data);
  }

  updateUser(userId: number, data: User): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${userId}`, data);
  }

  patchUser(userId: number, partialData: Partial<User>): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${userId}`, partialData);
  }

  deleteUser(userId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${userId}`);
  }

  // ==========================================
  // Ações de Estado e Sub-recursos
  // ==========================================
  lockUser(userId: number, isEditable: boolean): Observable<ApiResponse> {
    return this.patchUser(userId, { is_editable: isEditable } as Partial<User>);
  }

  validateUser(userId: number, isValid: boolean): Observable<ApiResponse> {
    return this.patchUser(userId, { is_valid: isValid } as Partial<User>);
  }

  rolesUser(userId: number, data: Role[]): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${userId}/roles`, data);
  }

  // ==========================================
  // Métodos de Checagem HTTP (Query Params REST)
  // ==========================================
  checkEmailExists(email: string, currentEmail?: string | null): Observable<boolean> {
    let params = new HttpParams().set('email', email.trim().toLowerCase());
    if (currentEmail) {
      params = params.set('ignore', currentEmail.trim().toLowerCase());
    }

    return this.http
      .get<AvailabilityResponse>(`${this.apiUrl}/availability`, { params })
      .pipe(map((res) => res.exists));
  }

  checkCnsExists(cns: string, currentCns?: string | null): Observable<boolean> {
    const cleanCns = cns.replace(/\D/g, '');
    let params = new HttpParams().set('cns', cleanCns);

    if (currentCns) {
      params = params.set('ignore', currentCns.replace(/\D/g, ''));
    }

    return this.http
      .get<AvailabilityResponse>(`${this.apiUrl}/availability`, { params })
      .pipe(map((res) => res.exists));
  }

  // ==========================================
  // Validadores Assíncronos Nativos (com Debounce)
  // ==========================================
  emailUserExistsValidator(currentEmail?: string | null): AsyncValidatorFn {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const email = control.value?.trim().toLowerCase();

      if (!email || !EMAIL_REGEX.test(email)) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() => this.checkEmailExists(email, currentEmail)),
        map((exists) => (exists ? { emailExists: true } : null)),
        catchError(() => of(null))
      );
    };
  }

  cnsUserExistsValidator(currentCns?: string | null): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const cnsClean = control.value ? String(control.value).replace(/\D/g, '') : '';

      if (cnsClean.length !== 15) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() => this.checkCnsExists(cnsClean, currentCns)),
        map((exists) => (exists ? { cnsExists: true } : null)),
        catchError(() => of(null))
      );
    };
  }
}