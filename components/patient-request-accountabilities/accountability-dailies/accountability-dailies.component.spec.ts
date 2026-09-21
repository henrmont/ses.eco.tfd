import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { AccountabilityDailiesComponent } from './accountability-dailies-component';
import { AccountabilityService } from '../../../services/accountability-service';
import { AccountabilityDaily } from '../../../models/accountability-daily';

import { CreateAccountabilityDailyComponent } from '../create-accountability-daily-component/create-accountability-daily-component';
import { UpdateAccountabilityDailyComponent } from '../update-accountability-daily-component/update-accountability-daily-component';
import { DeleteAccountabilityDailyComponent } from '../delete-accountability-daily-component/delete-accountability-daily-component';

describe('AccountabilityDailiesComponent', () => {
  let component: AccountabilityDailiesComponent;
  let fixture: ComponentFixture<AccountabilityDailiesComponent>;

  // Mocks das dependências
  let accountabilityServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;

  // Dados de entrada simulados via MAT_DIALOG_DATA incluindo árvore de permissões
  const mockDialogData = {
    accountability: {
      id: 150
    },
    permissions: [
      {
        permissions: [
          { name: 'EDITAR_DIARIA' },
          { name: 'DELETAR_DIARIA' }
        ]
      }
    ]
  };

  // Massa de dados de diárias simuladas
  const mockDailiesResponse: any[] = [
    {
      id: 1,
      amount: 2,
      daily_cost: { name: 'Diária Completa', value: 120.00 }
    },
    {
      id: 2,
      amount: 3,
      daily_cost: { name: 'Meia Diária', value: 60.00 }
    }
  ];

  beforeEach(async () => {
    accountabilityServiceMock = {
      getAccountabilityDailies: vi.fn().mockReturnValue(of(mockDailiesResponse))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula fechamento confirmando ação (true)
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    await TestBed.configureTestingModule({
      imports: [AccountabilityDailiesComponent]
    })
    .overrideComponent(AccountabilityDailiesComponent, {
      set: {
        providers: [
          { provide: AccountabilityService, useValue: accountabilityServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(AccountabilityDailiesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização e Fluxo Reativo (Signals e Computed)', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve carregar a lista de diárias e calcular subtotais e totais globais de forma reativa', () => {
      fixture.detectChanges();

      // Verifica chamada correta do serviço usando o ID da prestação de contas injetado
      expect(accountabilityServiceMock.getAccountabilityDailies).toHaveBeenCalledWith(150);

      // Valida o sinal bruto atualizado
      expect(component['dailiesList']()).toEqual(mockDailiesResponse);

      // Valida se o computed do total calculou o valor global de forma reativa ((2*120) + (3*60)) = 240 + 180
      expect(component['totalValue']()).toBe(420.00);

      // Valida se o computed do dataSource montou a estrutura com os parciais individuais recalculados
      const computedDataSource = component['dataSource']();
      expect(computedDataSource).toBeInstanceOf(MatTableDataSource);
      expect(computedDataSource.data[0].partial).toBe(240.00);
      expect(computedDataSource.data[1].partial).toBe(180.00);

      // O spinner deve ser desativado
      expect(component['isLoading']()).toBe(false);
    });

    it('deve desativar o spinner e interromper o fluxo caso o id do accountability esteja ausente (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [AccountabilityDailiesComponent] })
        .overrideComponent(AccountabilityDailiesComponent, {
          set: {
            providers: [
              { provide: AccountabilityService, useValue: accountabilityServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { accountability: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(AccountabilityDailiesComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(accountabilityServiceMock.getAccountabilityDailies).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading graciosamente mesmo se a API falhar', () => {
      accountabilityServiceMock.getAccountabilityDailies.mockReturnValue(throwError(() => new Error('Erro de API')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['dailiesList']()).toEqual([]);
    });
  });

  describe('Validação da Árvore de Permissões', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve retornar falso se a permissão avaliada existir dentro dos papéis (Bloqueia a restrição)', () => {
      const hasRestriction = component['checkPermissions']('EDITAR_DIARIA');
      expect(hasRestriction).toBe(false);
    });

    it('deve retornar verdadeiro se a permissão fornecida não for localizada', () => {
      const hasRestriction = component['checkPermissions']('PERMISSAO_INEXISTENTE');
      expect(hasRestriction).toBe(true);
    });
  });

  describe('Abertura de Modais de Ação', () => {
    const targetDaily = { id: 1, amount: 2, daily_cost: { value: 50 } } as AccountabilityDaily;

    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve abrir a modal CreateAccountabilityDailyComponent e atualizar a grid se confirmada', () => {
      accountabilityServiceMock.getAccountabilityDailies.mockClear();

      component['createAccountabilityDaily']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreateAccountabilityDailyComponent, {
        width: '500px',
        disableClose: true,
        autoFocus: false,
        data: { accountability: mockDialogData.accountability }
      });

      expect(accountabilityServiceMock.getAccountabilityDailies).toHaveBeenCalledWith(150);
    });

    it('deve abrir a modal UpdateAccountabilityDailyComponent passando o registro alvo e atualizar a grid', () => {
      accountabilityServiceMock.getAccountabilityDailies.mockClear();

      component['updateAccountabilityDaily'](targetDaily);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdateAccountabilityDailyComponent, {
        width: '500px',
        disableClose: true,
        autoFocus: false,
        data: { accountability_daily: targetDaily }
      });

      expect(accountabilityServiceMock.getAccountabilityDailies).toHaveBeenCalled();
    });

    it('deve abrir a modal DeleteAccountabilityDailyComponent em tamanho reduzido (400px)', () => {
      accountabilityServiceMock.getAccountabilityDailies.mockClear();

      component['deleteAccountabilityDaily'](targetDaily);

      expect(dialogMock.open).toHaveBeenCalledWith(DeleteAccountabilityDailyComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { accountability_daily: targetDaily }
      });

      expect(accountabilityServiceMock.getAccountabilityDailies).toHaveBeenCalled();
    });

    it('não deve recarregar os dados do serviço se as modais forem fechadas sem ação confirmada', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      accountabilityServiceMock.getAccountabilityDailies.mockClear();

      component['updateAccountabilityDaily'](targetDaily);

      expect(accountabilityServiceMock.getAccountabilityDailies).not.toHaveBeenCalled();
    });
  });
});