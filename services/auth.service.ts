import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TfdUser } from '../models/user.model';
import { AuthService as CoreAuthService } from '../../core/services/auth-service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly coreAuthService = inject(CoreAuthService);
  private readonly apiUrl = `${environment.apiTfdUrl}/users/me`;

  // 🔒 Estado reativo do TfdUser
  private readonly _currentUser = signal<TfdUser | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());

  // ➔ Computed resiliente para os tipos profissionais
  readonly userProfessionalTypes = computed<string[]>(() => {
    const user = this._currentUser();
    const professional = user?.professional;
    if (!professional) return [];

    const rawTypes = (professional as any)?.types || (professional as any)?.type || [];
    const typesList = Array.isArray(rawTypes) ? rawTypes : [rawTypes];

    return typesList
      .map((item: any) => (typeof item === 'string' ? item : item?.type || item?.name || ''))
      .filter((type): type is string => Boolean(type))
      .map((type) => type.trim());
  });

  setCurrentUser(user: TfdUser | null): void {
    this._currentUser.set(user);
    // Atualiza o core AuthService para manter sincronizado com o sistema
    this.coreAuthService.setCurrentUser(user);
  }

  getCurrentUser(): TfdUser | null {
    return this._currentUser() || this.coreAuthService.getCurrentUser<TfdUser>();
  }

  getMe(): Observable<TfdUser> {
    return this.http.get<TfdUser>(this.apiUrl).pipe(
      tap((user) => this.setCurrentUser(user))
    );
  }

  clearTfdSession(): void {
    this._currentUser.set(null);
  }
}