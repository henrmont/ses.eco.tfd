// src/app/tfd/components/setting/budget-allocation/budget-allocation.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BudgetAllocationComponent } from './budget-allocation.component';
import { BudgetAllocationUpdateComponent } from '../budget-allocation-update/budget-allocation-update.component';
import { AuthService } from '../../../../core/services/auth.service';
import { BudgetAllocation } from '../../../models/budget-allocation.model';
import { TfdUser as User } from '../../../models/user.model';
import { SettingService } from '../../../services/setting.service';

class MockBroadcastChannel {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
}

describe('BudgetAllocationComponent', () => {
  let component: BudgetAllocationComponent;
  let fixture: ComponentFixture<BudgetAllocationComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let settingServiceMock: {
    getBudgetAllocation: ReturnType<typeof vi.fn>;
  };
  let currentUserSignal: ReturnType<typeof signal<User | null>>;
  let authServiceMock: {
    currentUser: ReturnType<typeof signal<User | null>>;
  };
  let dialogAfterClosed$: Subject<unknown>;
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;

  const mockBudgetAllocation: BudgetAllocation = {
    id: 1,
    total_amount: 150000,
    available_amount: 95000,
  } as unknown as BudgetAllocation;

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
    budgetResponse = of(mockBudgetAllocation),
    initialUser: User | null = mockUserWithPermissions
  ): Promise<void> {
    currentUserSignal.set(initialUser);
    settingServiceMock.getBudgetAllocation.mockReturnValue(budgetResponse);
    dialogAfterClosed$ = new Subject<unknown>();

    dialogOpenSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
      afterClosed: () => dialogAfterClosed$.asObservable(),
    } as never);

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [BudgetAllocationComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: SettingService, useValue: settingServiceMock },
          { provide: AuthService, useValue: authServiceMock },
        ],
      })
      .overrideComponent(BudgetAllocationComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(BudgetAllocationComponent);
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
      getBudgetAllocation: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e carregar a alocação orçamentária', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-settings-channel');
    expect(settingServiceMock.getBudgetAllocation).toHaveBeenCalledTimes(1);
    expect(component['budgetAllocation']()).toEqual(mockBudgetAllocation);
    expect(component['isLoading']()).toBe(false);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Carregamento da Alocação Orçamentária', () => {
    it('deve definir budgetAllocation como null quando getBudgetAllocation falhar', async () => {
      await createComponent(throwError(() => new Error('Erro de rede')));

      expect(component['budgetAllocation']()).toBeNull();
      expect(component['isLoading']()).toBe(false);
    });

    it('deve atualizar os dados sem alterar isLoading quando acionado via BroadcastChannel com update_budget', () => {
      const updatedAllocation = {
        ...mockBudgetAllocation,
        available_amount: 120000,
      } as unknown as BudgetAllocation;
      const pending$ = new Subject<BudgetAllocation>();
      settingServiceMock.getBudgetAllocation.mockReturnValue(pending$.asObservable());

      broadcastChannelMock.onmessage?.({ data: 'outro_evento' } as MessageEvent<string>);
      expect(settingServiceMock.getBudgetAllocation).toHaveBeenCalledTimes(1);

      broadcastChannelMock.onmessage?.({ data: 'update_budget' } as MessageEvent<string>);
      expect(settingServiceMock.getBudgetAllocation).toHaveBeenCalledTimes(2);
      expect(component['isLoading']()).toBe(false);

      pending$.next(updatedAllocation);
      pending$.complete();
      fixture.detectChanges();

      expect(component['budgetAllocation']()).toEqual(updatedAllocation);
      expect(component['isLoading']()).toBe(false);
    });
  });

  describe('Verificação de Permissões (checkPermissions)', () => {
    it('deve retornar true quando o usuário não possuir permissões', async () => {
      await createComponent(of(mockBudgetAllocation), null);
      expect(component['checkPermissions']('configuração editar')).toBe(true);

      await createComponent(of(mockBudgetAllocation), { id: 10, roles: [] } as unknown as User);
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

  describe('Atualização via Dialog (budgetAllocationUpdate)', () => {
    it('deve abrir o dialog de atualização com os parâmetros corretos', () => {
      component['budgetAllocationUpdate'](mockBudgetAllocation);

      expect(dialogOpenSpy).toHaveBeenCalledWith(
        BudgetAllocationUpdateComponent,
        expect.objectContaining({
          width: '600px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.any(Object),
          data: { budget_allocation: mockBudgetAllocation },
        })
      );
    });

    it('deve recarregar os dados e notificar o BroadcastChannel quando o dialog fechar com resultado verdadeiro', () => {
      const refreshedAllocation = {
        ...mockBudgetAllocation,
        total_amount: 200000,
      } as unknown as BudgetAllocation;
      settingServiceMock.getBudgetAllocation.mockReturnValue(of(refreshedAllocation));

      component['budgetAllocationUpdate'](mockBudgetAllocation);
      dialogAfterClosed$.next(true);
      dialogAfterClosed$.complete();
      fixture.detectChanges();

      expect(settingServiceMock.getBudgetAllocation).toHaveBeenCalledTimes(2);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update_budget');
      expect(component['budgetAllocation']()).toEqual(refreshedAllocation);
    });

    it('não deve recarregar os dados nem notificar o BroadcastChannel quando o dialog fechar sem resultado verdadeiro', () => {
      component['budgetAllocationUpdate'](mockBudgetAllocation);
      dialogAfterClosed$.next(false);
      dialogAfterClosed$.complete();
      fixture.detectChanges();

      expect(settingServiceMock.getBudgetAllocation).toHaveBeenCalledTimes(1);
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});