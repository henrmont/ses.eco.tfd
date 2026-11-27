// src/app/tfd/services/auth.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { AuthService as CoreAuthService } from '../../core/services/auth.service';
import { TfdUser } from '../models/user.model';

describe('Tfd AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let coreAuthServiceMock: {
    setCurrentUser: ReturnType<typeof vi.fn>;
    getCurrentUser: ReturnType<typeof vi.fn>;
  };

  const expectedUrl = `${environment.apiTfdUrl}/users/me`;

  const mockUser = {
    id: 10,
    name: 'Maria Souza',
    professional: {
      id: 5,
      name: 'Dra. Maria Souza',
      types: [' Médico ', { type: ' Auditor ' }, { name: ' Coordenador ' }, '', null],
    },
  } as unknown as TfdUser;

  beforeEach(() => {
    vi.clearAllMocks();

    coreAuthServiceMock = {
      setCurrentUser: vi.fn(),
      getCurrentUser: vi.fn(() => null),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        { provide: CoreAuthService, useValue: coreAuthServiceMock },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve iniciar com usuário nulo, não autenticado e sem tipos profissionais', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.userProfessionalTypes()).toEqual([]);
  });

  it('deve atualizar currentUser e sincronizar com CoreAuthService via setCurrentUser', () => {
    service.setCurrentUser(mockUser);

    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBe(true);
    expect(coreAuthServiceMock.setCurrentUser).toHaveBeenCalledTimes(1);
    expect(coreAuthServiceMock.setCurrentUser).toHaveBeenCalledWith(mockUser);

    service.setCurrentUser(null);
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(coreAuthServiceMock.setCurrentUser).toHaveBeenCalledWith(null);
  });

  it('deve retornar currentUser local ou fazer fallback para CoreAuthService em getCurrentUser', () => {
    const fallbackUser = { id: 99, name: 'Usuário Core' } as unknown as TfdUser;
    coreAuthServiceMock.getCurrentUser.mockReturnValue(fallbackUser);

    expect(service.getCurrentUser()).toEqual(fallbackUser);
    expect(coreAuthServiceMock.getCurrentUser).toHaveBeenCalledTimes(1);

    service.setCurrentUser(mockUser);
    expect(service.getCurrentUser()).toEqual(mockUser);
  });

  it('deve normalizar userProfessionalTypes para array, valor único e ausência de professional', () => {
    service.setCurrentUser(mockUser);
    expect(service.userProfessionalTypes()).toEqual(['Médico', 'Auditor', 'Coordenador']);

    service.setCurrentUser({
      id: 11,
      professional: { type: ' Enfermeiro ' },
    } as unknown as TfdUser);
    expect(service.userProfessionalTypes()).toEqual(['Enfermeiro']);

    service.setCurrentUser({
      id: 12,
      professional: { type: { name: ' Farmacêutico ' } },
    } as unknown as TfdUser);
    expect(service.userProfessionalTypes()).toEqual(['Farmacêutico']);

    service.setCurrentUser({
      id: 13,
      professional: {},
    } as unknown as TfdUser);
    expect(service.userProfessionalTypes()).toEqual([]);

    service.setCurrentUser({ id: 14 } as unknown as TfdUser);
    expect(service.userProfessionalTypes()).toEqual([]);
  });

  it('deve buscar usuário atual via GET em getMe e atualizar o estado', () => {
    let receivedUser: TfdUser | undefined;

    service.getMe().subscribe((user) => {
      receivedUser = user;
    });

    const req = httpMock.expectOne(expectedUrl);
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);

    expect(receivedUser).toEqual(mockUser);
    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBe(true);
    expect(coreAuthServiceMock.setCurrentUser).toHaveBeenCalledWith(mockUser);
  });

  it('deve limpar apenas a sessão TFD ao chamar clearTfdSession', () => {
    service.setCurrentUser(mockUser);
    coreAuthServiceMock.setCurrentUser.mockClear();

    service.clearTfdSession();

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.userProfessionalTypes()).toEqual([]);
    expect(coreAuthServiceMock.setCurrentUser).not.toHaveBeenCalled();
  });
});