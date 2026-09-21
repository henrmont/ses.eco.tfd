import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { Permission } from '../models/permission.model';
import { Role } from '../models/role.model';

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  // ==========================================
  // Injeção de Dependências & Configurações
  // ==========================================
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/roles`;

  // ==========================================
  // Métodos de Leitura (GET)
  // ==========================================
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/`);
  }

  getPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.apiUrl}/permissions`);
  }

  // ==========================================
  // Métodos de Escrita/Mutação (POST, PATCH, DELETE)
  // ==========================================
  createRole(data: Role): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/`, data);
  }

  updateRole(roleId: number, data: Role): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${roleId}`, data);
  }

  deleteRole(roleId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${roleId}`);
  }
}