// src/app/tfd/services/role.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleService } from './role.service';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { Permission } from '../../core/models/permission.model';
import { Role } from '../../core/models/role.model';

describe('Tfd RoleService', () => {
  let service: RoleService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiTfdUrl}/roles`;

  const mockRole = {
    id: 1,
    name: 'Administrador TFD',
  } as unknown as Role;

  const mockPermissions = [
    { id: 1, name: 'tfd/perfil listar' },
  ] as unknown as Permission[];

  const mockApiResponse = { message: 'OK' } as unknown as ApiResponse;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RoleService],
    });

    service = TestBed.inject(RoleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve consultar getRoles e getPermissions via GET', () => {
    let rolesResult: Role[] | undefined;
    let permissionsResult: Permission[] | undefined;

    service.getRoles().subscribe((res) => (rolesResult = res));
    service.getPermissions().subscribe((res) => (permissionsResult = res));

    const rolesReq = httpMock.expectOne(baseUrl);
    expect(rolesReq.request.method).toBe('GET');
    rolesReq.flush([mockRole]);

    const permissionsReq = httpMock.expectOne(`${baseUrl}/permissions`);
    expect(permissionsReq.request.method).toBe('GET');
    permissionsReq.flush(mockPermissions);

    expect(rolesResult).toEqual([mockRole]);
    expect(permissionsResult).toEqual(mockPermissions);
  });

  it('deve executar createRole, updateRole e deleteRole', () => {
    let createRes: ApiResponse | undefined;
    let updateRes: ApiResponse | undefined;
    let deleteRes: ApiResponse | undefined;

    service.createRole(mockRole).subscribe((res) => (createRes = res));
    service.updateRole(9, mockRole).subscribe((res) => (updateRes = res));
    service.deleteRole(9).subscribe((res) => (deleteRes = res));

    const postReq = httpMock.expectOne(baseUrl);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual(mockRole);
    postReq.flush(mockApiResponse);

    const idReqs = httpMock.match(`${baseUrl}/9`);
    expect(idReqs).toHaveLength(2);

    const putReq = idReqs.find((r) => r.request.method === 'PUT');
    const deleteReq = idReqs.find((r) => r.request.method === 'DELETE');

    expect(putReq).toBeDefined();
    expect(putReq!.request.body).toEqual(mockRole);
    putReq!.flush(mockApiResponse);

    expect(deleteReq).toBeDefined();
    deleteReq!.flush(mockApiResponse);

    expect(createRes).toEqual(mockApiResponse);
    expect(updateRes).toEqual(mockApiResponse);
    expect(deleteRes).toEqual(mockApiResponse);
  });
});