// src/app/tfd/guards/tfd.guard.spec.ts
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  GuardResult,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tfdGuard } from './tfd.guard';
import { MessageService } from '../../core/services/message.service';
import { TfdUser } from '../models/user.model';
import { AuthService } from '../services/auth.service';

describe('tfdGuard', () => {
  let router: Router;
  let authServiceMock: {
    getCurrentUser: ReturnType<typeof vi.fn>;
    getMe: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };

  const runGuard = async (
    routeData: Record<string, unknown> = {},
    url = '/principal/tfd/solicitacoes'
  ): Promise<GuardResult> => {
    const route = { data: routeData } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    const result = await TestBed.runInInjectionContext(() => tfdGuard(route, state));
    return isObservable(result) ? firstValueFrom(result) : result;
  };

  const buildUser = (overrides: Partial<Record<string, unknown>> = {}): TfdUser =>
    ({
      professional: {
        types: ['MEDICO'],
      },
      roles: [
        {
          permissions: [{ name: 'tfd/solicitações listar' }],
        },
      ],
      ...overrides,
    }) as unknown as TfdUser;

  beforeEach(() => {
    authServiceMock = {
      getCurrentUser: vi.fn().mockReturnValue(null),
      getMe: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
      ],
    });

    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve validar diretamente usando getCurrentUser() quando professional já estiver carregado', async () => {
    authServiceMock.getCurrentUser.mockReturnValue(buildUser());

    const result = await runGuard({
      types: ['medico'],
      permission: 'solicitações listar',
    });

    expect(result).toBe(true);
    expect(authServiceMock.getMe).not.toHaveBeenCalled();
  });

  it('deve buscar usuário via getMe() quando getCurrentUser() não tiver professional', async () => {
    authServiceMock.getCurrentUser.mockReturnValue({});
    authServiceMock.getMe.mockReturnValue(of(buildUser()));

    const result = await runGuard({ types: ['medico'] });

    expect(authServiceMock.getMe).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('deve exibir mensagem e retornar UrlTree global quando getMe() falhar', async () => {
    authServiceMock.getMe.mockReturnValue(throwError(() => new Error('Erro de rede')));

    const result = await runGuard();

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/principal/dashboard');
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Falha ao carregar permissões do módulo TFD.'
    );
  });

  describe('Validação de tipos profissionais (types)', () => {
    it('deve aceitar tipos em array de objetos, valor único (type) ou objeto único', async () => {
      authServiceMock.getMe.mockReturnValueOnce(
        of(
          buildUser({
            professional: { types: [{ type: 'Enfermeiro' }, { name: 'Fisioterapeuta' }, 123, null] },
          })
        )
      );
      expect(await runGuard({ types: ['enfermeiro', ''] })).toBe(true);

      authServiceMock.getMe.mockReturnValueOnce(
        of(buildUser({ professional: { type: 'Assistente Social' } }))
      );
      expect(await runGuard({ types: 'assistente social' })).toBe(true);

      authServiceMock.getMe.mockReturnValueOnce(
        of(buildUser({ professional: { type: { name: 'Farmaceutico' } } }))
      );
      expect(await runGuard({ types: ['farmaceutico'] })).toBe(true);

      authServiceMock.getMe.mockReturnValueOnce(of(buildUser({ professional: {} })));
      expect(await runGuard({ types: [] })).toBe(true);
    });

    it('deve negar acesso, exibir mensagem e redirecionar para /principal/tfd quando tipo não corresponder', async () => {
      authServiceMock.getMe.mockReturnValue(
        of(buildUser({ professional: { types: ['Motorista'] } }))
      );

      const result = await runGuard(
        { types: ['medico'] },
        '/principal/tfd/solicitacoes?status=aberta'
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/principal/tfd');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Seu perfil profissional não possui acesso a este recurso do TFD.'
      );
    });

    it('deve redirecionar para /principal/dashboard para evitar loop quando bloqueado na rota index do módulo', async () => {
      authServiceMock.getMe.mockReturnValue(
        of(buildUser({ professional: { types: ['Motorista'] } }))
      );

      const result = await runGuard({ types: ['medico'] }, '/principal/tfd/');

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/principal/dashboard');
    });
  });

  describe('Validação de permissões (permissions / permission / requireAllPermissions)', () => {
    it('deve permitir acesso quando possuir permissão com ou sem prefixo tfd/', async () => {
      authServiceMock.getMe.mockReturnValue(
        of(
          buildUser({
            roles: [
              {
                permissions: [
                  { name: 'tfd/solicitações criar' },
                  { name: 'solicitações editar' },
                  { name: '' },
                ],
              },
              {},
            ],
          })
        )
      );

      expect(await runGuard({ permission: 'solicitações criar' })).toBe(true);
      expect(await runGuard({ permissions: ['solicitações editar'] })).toBe(true);
    });

    it('deve exigir todas as permissões quando requireAllPermissions for true', async () => {
      authServiceMock.getMe.mockReturnValue(
        of(
          buildUser({
            roles: [
              {
                permissions: [{ name: 'tfd/solicitações listar' }, { name: 'solicitações ver' }],
              },
            ],
          })
        )
      );

      expect(
        await runGuard({
          permissions: ['solicitações listar', 'solicitações ver'],
          requireAllPermissions: true,
        })
      ).toBe(true);

      expect(
        await runGuard({
          permissions: ['solicitações listar', 'solicitações excluir'],
          requireAllPermissions: true,
        })
      ).toBeInstanceOf(UrlTree);
    });

    it('deve negar acesso, exibir mensagem e redirecionar quando permissão for insuficiente', async () => {
      authServiceMock.getMe.mockReturnValue(
        of(
          buildUser({
            roles: [{ permissions: [{ name: 'tfd/outra permissão' }] }],
          })
        )
      );

      const result = await runGuard({ permissions: ['solicitações excluir'] });

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/principal/tfd');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Você não possui a permissão necessária para acessar esta página do TFD.'
      );
    });
  });
});