// src/app/tfd/services/user.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ValidationErrors } from '@angular/forms';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserService } from './user.service';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { Role } from '../../core/models/role.model';
import { TfdUser } from '../models/user.model';

function observeValidation(
  result: Observable<ValidationErrors | null> | Promise<ValidationErrors | null>,
  onNext: (value: ValidationErrors | null) => void
): void {
  if (!(result instanceof Observable)) {
    throw new Error('Expected validator to return an Observable');
  }
  result.subscribe((value: ValidationErrors | null) => onNext(value));
}

describe('Tfd UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiTfdUrl}/users`;

  const mockUser = {
    id: 1,
    name: 'Maria Souza',
    email: 'maria@saude.gov.br',
  } as unknown as TfdUser;

  const mockRoles = [{ id: 1, name: 'Administrador' }] as unknown as Role[];
  const mockApiResponse = { message: 'OK' } as unknown as ApiResponse;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), UserService],
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  it('deve consultar getMe, getUsers e getRoles via GET', () => {
    let meResult: TfdUser | undefined;
    let usersResult: TfdUser[] | undefined;
    let rolesResult: Role[] | undefined;

    service.getMe().subscribe((res) => (meResult = res));
    service.getUsers().subscribe((res) => (usersResult = res));
    service.getRoles().subscribe((res) => (rolesResult = res));

    const meReq = httpMock.expectOne(`${baseUrl}/me`);
    expect(meReq.request.method).toBe('GET');
    meReq.flush(mockUser);

    const usersReq = httpMock.expectOne(baseUrl);
    expect(usersReq.request.method).toBe('GET');
    usersReq.flush([mockUser]);

    const rolesReq = httpMock.expectOne(`${baseUrl}/roles`);
    expect(rolesReq.request.method).toBe('GET');
    rolesReq.flush(mockRoles);

    expect(meResult).toEqual(mockUser);
    expect(usersResult).toEqual([mockUser]);
    expect(rolesResult).toEqual(mockRoles);
  });

  it('deve executar createUser, updateUser e deleteUser', () => {
    let createRes: ApiResponse | undefined;
    let updateRes: ApiResponse | undefined;
    let deleteRes: ApiResponse | undefined;

    service.createUser(mockUser).subscribe((res) => (createRes = res));
    service.updateUser(7, mockUser).subscribe((res) => (updateRes = res));
    service.deleteUser(7).subscribe((res) => (deleteRes = res));

    const postReq = httpMock.expectOne(baseUrl);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual(mockUser);
    postReq.flush(mockApiResponse);

    const idReqs = httpMock.match(`${baseUrl}/7`);
    expect(idReqs).toHaveLength(2);

    const putReq = idReqs.find((r) => r.request.method === 'PUT');
    const deleteReq = idReqs.find((r) => r.request.method === 'DELETE');

    expect(putReq).toBeDefined();
    expect(putReq!.request.body).toEqual(mockUser);
    putReq!.flush(mockApiResponse);

    expect(deleteReq).toBeDefined();
    deleteReq!.flush(mockApiResponse);

    expect(createRes).toEqual(mockApiResponse);
    expect(updateRes).toEqual(mockApiResponse);
    expect(deleteRes).toEqual(mockApiResponse);
  });

  it('deve executar lockUser, validateUser e rolesUser', () => {
    let lockRes: ApiResponse | undefined;
    let validateRes: ApiResponse | undefined;
    let rolesRes: ApiResponse | undefined;

    service.lockUser(3).subscribe((res) => (lockRes = res));
    service.validateUser(3).subscribe((res) => (validateRes = res));
    service.rolesUser(3, mockRoles).subscribe((res) => (rolesRes = res));

    const lockReq = httpMock.expectOne(`${baseUrl}/3/lock`);
    expect(lockReq.request.method).toBe('PATCH');
    expect(lockReq.request.body).toEqual({});
    lockReq.flush(mockApiResponse);

    const validateReq = httpMock.expectOne(`${baseUrl}/3/validate`);
    expect(validateReq.request.method).toBe('PATCH');
    expect(validateReq.request.body).toEqual({});
    validateReq.flush(mockApiResponse);

    const rolesReq = httpMock.expectOne(`${baseUrl}/3/roles`);
    expect(rolesReq.request.method).toBe('PUT');
    expect(rolesReq.request.body).toEqual(mockRoles);
    rolesReq.flush(mockApiResponse);

    expect(lockRes).toEqual(mockApiResponse);
    expect(validateRes).toEqual(mockApiResponse);
    expect(rolesRes).toEqual(mockApiResponse);
  });

  it('deve verificar disponibilidade de e-mail com e sem parâmetro ignore', () => {
    let existsWithIgnore: boolean | undefined;
    let existsWithoutIgnore: boolean | undefined;

    service
      .checkEmailExists('  Maria@Saude.Gov.BR  ', '  Atual@Saude.Gov.BR ')
      .subscribe((res) => (existsWithIgnore = res));

    const req1 = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/availability` &&
        r.params.get('email') === 'maria@saude.gov.br' &&
        r.params.get('ignore') === 'atual@saude.gov.br'
    );
    expect(req1.request.method).toBe('GET');
    req1.flush({ available: false, exists: true });

    service.checkEmailExists('novo@saude.gov.br').subscribe((res) => (existsWithoutIgnore = res));

    const req2 = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/availability` &&
        r.params.get('email') === 'novo@saude.gov.br' &&
        !r.params.has('ignore')
    );
    expect(req2.request.method).toBe('GET');
    req2.flush({ available: true, exists: false });

    expect(existsWithIgnore).toBe(true);
    expect(existsWithoutIgnore).toBe(false);
  });

  it('deve verificar disponibilidade de CNS limpando dígitos com e sem parâmetro ignore', () => {
    let cnsExists: boolean | undefined;

    service
      .checkCnsExists('123.4567.8901-2345', '999.8887.7766-5544')
      .subscribe((res) => (cnsExists = res));

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/availability` &&
        r.params.get('cns') === '123456789012345' &&
        r.params.get('ignore') === '999888777665544'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ available: false, exists: true });

    expect(cnsExists).toBe(true);
  });

  it('deve validar e-mail de forma assíncrona ignorando inválidos e aplicando debounce de 400ms', async () => {
    vi.useFakeTimers();
    const validator = service.emailUserExistsValidator('atual@saude.gov.br');

    const invalidControl = new FormControl('email-invalido');
    let invalidResult: ValidationErrors | null | string = 'pending';
    observeValidation(validator(invalidControl), (res) => {
      invalidResult = res;
    });
    await vi.advanceTimersByTimeAsync(400);
    httpMock.expectNone(`${baseUrl}/availability`);
    expect(invalidResult).toBeNull();

    const validControl = new FormControl('  Maria@Saude.Gov.BR  ');
    let existsResult: ValidationErrors | null | string = 'pending';
    observeValidation(validator(validControl), (res) => {
      existsResult = res;
    });

    await vi.advanceTimersByTimeAsync(399);
    httpMock.expectNone(`${baseUrl}/availability`);

    await vi.advanceTimersByTimeAsync(1);
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/availability` &&
        r.params.get('email') === 'maria@saude.gov.br' &&
        r.params.get('ignore') === 'atual@saude.gov.br'
    );
    req.flush({ available: false, exists: true });
    expect(existsResult).toEqual({ emailExists: true });

    const errorControl = new FormControl('erro@saude.gov.br');
    let errorResult: ValidationErrors | null | string = 'pending';
    observeValidation(validator(errorControl), (res) => {
      errorResult = res;
    });
    await vi.advanceTimersByTimeAsync(400);
    const errReq = httpMock.expectOne(
      `${baseUrl}/availability?email=erro@saude.gov.br&ignore=atual@saude.gov.br`
    );
    errReq.flush('Erro no servidor', { status: 500, statusText: 'Internal Server Error' });
    expect(errorResult).toBeNull();
  });

  it('deve validar CNS de forma assíncrona ignorando incompletos e aplicando debounce de 400ms', async () => {
    vi.useFakeTimers();
    const validator = service.cnsUserExistsValidator('111222333444555');

    const shortControl = new FormControl('123.456');
    let shortResult: ValidationErrors | null | string = 'pending';
    observeValidation(validator(shortControl), (res) => {
      shortResult = res;
    });
    await vi.advanceTimersByTimeAsync(400);
    httpMock.expectNone(`${baseUrl}/availability`);
    expect(shortResult).toBeNull();

    const validCnsControl = new FormControl(123456789012345);
    let existsResult: ValidationErrors | null | string = 'pending';
    observeValidation(validator(validCnsControl), (res) => {
      existsResult = res;
    });

    await vi.advanceTimersByTimeAsync(400);
    const req = httpMock.expectOne(
      (r) =>
        r.url === `${baseUrl}/availability` &&
        r.params.get('cns') === '123456789012345' &&
        r.params.get('ignore') === '111222333444555'
    );
    req.flush({ available: true, exists: false });
    expect(existsResult).toBeNull();

    const errorCnsControl = new FormControl('999.8887.7766-5544');
    let errorResult: ValidationErrors | null | string = 'pending';
    observeValidation(validator(errorCnsControl), (res) => {
      errorResult = res;
    });
    await vi.advanceTimersByTimeAsync(400);
    const errReq = httpMock.expectOne(
      `${baseUrl}/availability?cns=999888777665544&ignore=111222333444555`
    );
    errReq.flush('Falha', { status: 500, statusText: 'Server Error' });
    expect(errorResult).toBeNull();
  });
});