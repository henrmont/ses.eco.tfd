import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RoleService, ApiResponse } from './role-service';
import { Role } from '../models/role';
import { Permission } from '../models/permission.model';
import { environment } from '../../../environments/environment
';

describe('RoleService', () => {
  let service: RoleService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiTfdUrl}/role`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RoleService,
        provideHttpClient(),
        provideHttpClientTesting() // Configura o interceptor de testes HTTP
      ]
    });

    service = TestBed.inject(RoleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Garante que nenhuma requisição HTTP ficou pendente ou esquecida entre um teste e outro
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('deve buscar a lista de roles (getRoles) via método GET', () => {
    const mockRoles: Role[] = [
      { id: 1, name: 'tfd/administrador', permissions: [] },
      { id: 2, name: 'tfd/operador', permissions: [] }
    ];

    service.getRoles().subscribe((roles) => {
      expect(roles).toHaveLength(2);
      expect(roles).toEqual(mockRoles);
    });

    // Intercepta a chamada para a URL exata
    const req = httpMock.expectOne(`${baseUrl}/get-roles`);
    expect(req.request.method).toBe('GET');
    
    // Responde a requisição com os dados simulados
    req.flush(mockRoles);
  });

  it('deve buscar a lista de permissões (getPermissions) via método GET', () => {
    const mockPermissions: Permission[] = [
      { id: 1, name: 'tfd/regra criar' },
      { id: 2, name: 'tfd/regra deletar' }
    ];

    service.getPermissions().subscribe((permissions) => {
      expect(permissions).toEqual(mockPermissions);
    });

    const req = httpMock.expectOne(`${baseUrl}/get-permissions`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPermissions);
  });

  it('deve criar uma nova role (createRole) enviando os dados via método POST', () => {
    const newRole: Role = { id: 3, name: 'tfd/medico', permissions: [] };
    const mockResponse: ApiResponse = { message: 'Regra criada com sucesso!', status: 'success' };

    service.createRole(newRole).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${baseUrl}/create-role`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(newRole); // Valida se o payload foi enviado corretamente
    req.flush(mockResponse);
  });

  it('deve atualizar uma role existente (updateRole) via método PATCH enviando o ID na URL', () => {
    const roleId = 12;
    const updatedData: Role = { id: 12, name: 'tfd/coordenador', permissions: [] };
    const mockResponse: ApiResponse = { message: 'Regra atualizada com sucesso!' };

    service.updateRole(roleId, updatedData).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${baseUrl}/update-role/${roleId}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(updatedData);
    req.flush(mockResponse);
  });

  it('deve deletar uma role (deleteRole) via método DELETE enviando o ID na URL', () => {
    const roleId = 45;
    const mockResponse: ApiResponse = { message: 'Regra removida com sucesso!' };

    service.deleteRole(roleId).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${baseUrl}/delete-role/${roleId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(mockResponse);
  });
});