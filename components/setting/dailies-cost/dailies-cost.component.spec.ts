// src/app/tfd/components/setting/dailies-cost/dailies-cost.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DailiesCostComponent } from './dailies-cost.component';
import { DailyCostUpdateComponent } from '../daily-cost-update/daily-cost-update.component';
import { AuthService } from '../../../../core/services/auth.service';
import { DailyCost } from '../../../models/daily-cost.model';
import { TfdUser as User } from '../../../models/user.model';
import { SettingService } from '../../../services/setting.service';

class MockBroadcastChannel {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
}

describe('DailiesCostComponent', () => {
  let component: DailiesCostComponent;
  let fixture: ComponentFixture<DailiesCostComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let settingServiceMock: {
    getDailyCosts: ReturnType<typeof vi.fn>;
  };
  let currentUserSignal: ReturnType<typeof signal<User | null>>;
  let authServiceMock: {
    currentUser: ReturnType<typeof signal<User | null>>;
  };
  let dialogAfterClosed$: Subject<unknown>;
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;

  const mockDailyCosts: DailyCost[] = [
    { id: 1, type: 'Alimentação', amount: 85 } as unknown as DailyCost,
    { id: 2, type: 'Pousada', amount: 140 } as unknown as DailyCost,
  ];

  const mockUserWithPermissions: User = {
    id: 10,
    name: 'Ana Costa',
    roles: [
      {
        id: 1,
        name: 'gestor',
        permissions: [
          { id: 101, name: 'TFD/Configuração Editar' },
          { id: 102, name: 'outro.permissao' },
        ],
      },
    ],
  } as unknown as User;

  async function createComponent(
    dailyCostsResponse = of(mockDailyCosts),
    initialUser: User | null = mockUserWithPermissions
  ): Promise<void> {
    currentUserSignal.set(initialUser);
    settingServiceMock.getDailyCosts.mockReturnValue(dailyCostsResponse);
    dialogAfterClosed$ = new Subject<unknown>();

    dialogOpenSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
      afterClosed: () => dialogAfterClosed$.asObservable(),
    } as never);

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [DailiesCostComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: SettingService, useValue: settingServiceMock },
          { provide: AuthService, useValue: authServiceMock },
        ],
      })
      .overrideComponent(DailiesCostComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DailiesCostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    broadcastChannelMock = new MockBroadcastChannel();

    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return broadcastChannelMock;
      })
    );

    currentUserSignal = signal<User | null>(mockUserWithPermissions);
    authServiceMock = {
      currentUser: currentUserSignal,
    };

    settingServiceMock = {
      getDailyCosts: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e carregar os valores de diárias', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-settings-channel');
    expect(settingServiceMock.getDailyCosts).toHaveBeenCalledTimes(1);
    expect(component['dailiesCost']()).toEqual(mockDailyCosts);
    expect(component['isLoading']()).toBe(false);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Carregamento de Diárias', () => {
    it('deve definir dailiesCost como array vazio quando getDailyCosts falhar', async () => {
      await createComponent(throwError(() => new Error('Erro de rede')));

      expect(component['dailiesCost']()).toEqual([]);
      expect(component['isLoading']()).toBe(false);
    });

    it('deve atualizar os dados sem alterar isLoading quando acionado via BroadcastChannel com update_dailies', () => {
      const updatedCosts = [
        { id: 1, type: 'Alimentação', amount: 95 } as unknown as DailyCost,
      ];
      const pending$ = new Subject<DailyCost[]>();
      settingServiceMock.getDailyCosts.mockReturnValue(pending$.asObservable());

      broadcastChannelMock.onmessage?.({ data: 'outro_evento' } as MessageEvent<string>);
      expect(settingServiceMock.getDailyCosts).toHaveBeenCalledTimes(1);

      broadcastChannelMock.onmessage?.({ data: 'update_dailies' } as MessageEvent<string>);
      expect(settingServiceMock.getDailyCosts).toHaveBeenCalledTimes(2);
      expect(component['isLoading']()).toBe(false);

      pending$.next(updatedCosts);
      pending$.complete();
      fixture.detectChanges();

      expect(component['dailiesCost']()).toEqual(updatedCosts);
      expect(component['isLoading']()).toBe(false);
    });
  });

  describe('Verificação de Permissões (checkPermissions)', () => {
    it('deve retornar true quando o usuário não possuir permissões', async () => {
      await createComponent(of(mockDailyCosts), null);
      expect(component['checkPermissions']('configuração editar')).toBe(true);

      await createComponent(of(mockDailyCosts), { id: 10, roles: [] } as unknown as User);
      expect(component['checkPermissions']('configuração editar')).toBe(true);
    });

    it('deve retornar false quando a permissão existir diretamente ou com prefixo tfd/', () => {
      expect(component['checkPermissions']('  Configuração Editar  ')).toBe(false);
      expect(component['checkPermissions']('OUTRO.PERMISSAO')).toBe(false);
    });

    it('deve retornar true quando a permissão não constar nas permissões do usuário', () => {
      expect(component['checkPermissions']('configuração excluir')).toBe(true);
    });
  });

  describe('Atualização via Dialog (updateDailyCost)', () => {
    const targetDaily = mockDailyCosts[0];

    it('deve abrir o dialog de atualização de diária com os parâmetros corretos', () => {
      component['updateDailyCost'](targetDaily);

      expect(dialogOpenSpy).toHaveBeenCalledWith(
        DailyCostUpdateComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.any(Object),
          data: { daily_cost: targetDaily },
        })
      );
    });

    it('deve recarregar os dados e notificar o BroadcastChannel quando o dialog fechar com resultado verdadeiro', () => {
      const refreshedCosts = [
        { id: 1, type: 'Alimentação', amount: 110 } as unknown as DailyCost,
      ];
      settingServiceMock.getDailyCosts.mockReturnValue(of(refreshedCosts));

      component['updateDailyCost'](targetDaily);
      dialogAfterClosed$.next(true);
      dialogAfterClosed$.complete();
      fixture.detectChanges();

      expect(settingServiceMock.getDailyCosts).toHaveBeenCalledTimes(2);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update_dailies');
      expect(component['dailiesCost']()).toEqual(refreshedCosts);
    });

    it('não deve recarregar os dados nem notificar o BroadcastChannel quando o dialog fechar sem resultado verdadeiro', () => {
      component['updateDailyCost'](targetDaily);
      dialogAfterClosed$.next(false);
      dialogAfterClosed$.complete();
      fixture.detectChanges();

      expect(settingServiceMock.getDailyCosts).toHaveBeenCalledTimes(1);
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});