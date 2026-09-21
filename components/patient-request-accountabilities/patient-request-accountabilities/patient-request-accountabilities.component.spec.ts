import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { PatientRequestAccountabilitiesComponent } from './patient-request-accountabilities-component';
import { AccountabilityService } from '../../../services/accountability-service';
import { Accountability } from '../../../models/accountability';

import { CreateAccountabilityComponent } from '../create-accountability-component/create-accountability-component';
import { UpdateAccountabilityComponent } from '../update-accountability-component/update-accountability-component';
import { DeleteAccountabilityComponent } from '../delete-accountability-component/delete-accountability-component';
import { AccountabilityDailiesComponent } from '../accountability-dailies-component/accountability-dailies-component';
import { ShowAccountabilityComponent } from '../show-accountability-component/show-accountability-component';

describe('PatientRequestAccountabilitiesComponent', () => {
  let component: PatientRequestAccountabilitiesComponent;
  let fixture: ComponentFixture<PatientRequestAccountabilitiesComponent>;

  // Mocks das dependências
  let accountabilityServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;

  // Dados de entrada injetados com estrutura de permissões e chaves relacionais
  const mockDialogData = {
    patient_request: {
      id: 550,
      report: {
        patient_care: {
          id: 990
        }
      }
    },
    permissions: [
      {
        permissions: [
          { name: 'tfd/prestação de contas atualizar' },
          { name: 'tfd/prestação de contas criar' }
        ]
      }
    ]
  };

  const mockAccountabilitiesResponse: any[] = [
    { id: 1, name: 'Prestação de Contas - Março', total_dailies: 150.00, created_at: '2026-03-10' },
    { id: 2, name: 'Prestação de Contas - Abril', total_dailies: 220.00, created_at: '2026-04-12' }
  ];

  beforeEach(async () => {
    accountabilityServiceMock = {
      getAccountabilities: vi.fn().mockReturnValue(of(mockAccountabilitiesResponse)),
      getBalance: vi.fn().mockReturnValue(of(370.00))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula confirmação nas modais normais
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    await TestBed.configureTestingModule({
      imports: [PatientRequestAccountabilitiesComponent]
    })
    .overrideComponent(PatientRequestAccountabilitiesComponent, {
      set: {
        providers: [
          { provide: AccountabilityService, useValue: accountabilityServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestAccountabilitiesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização e Fluxo Reativo (Signals, Computed e Erros)', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve buscar as prestações de contas e o saldo do atendimento reativamente ao iniciar', () => {
      fixture.detectChanges();

      expect(accountabilityServiceMock.getAccountabilities).toHaveBeenCalledWith(550);
      expect(accountabilityServiceMock.getBalance).toHaveBeenCalledWith(990);

      // Valida se os signals guardaram o estado esperado da API
      expect(component['accountabilitiesList']()).toEqual(mockAccountabilitiesResponse);
      expect(component['totalValue']()).toBe(370.00);
      expect(component['isLoading']()).toBe(false);

      // Valida o computed encapsulado do MatTableDataSource
      const computedDataSource = component['dataSource']();
      expect(computedDataSource).toBeInstanceOf(MatTableDataSource);
      expect(computedDataSource.data).toEqual(mockAccountabilitiesResponse);
    });

    it('deve interromper a busca e desligar o loading se o id do patient_request for nulo (Guarda de Segurança)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [PatientRequestAccountabilitiesComponent] })
        .overrideComponent(PatientRequestAccountabilitiesComponent, {
          set: {
            providers: [
              { provide: AccountabilityService, useValue: accountabilityServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(PatientRequestAccountabilitiesComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(accountabilityServiceMock.getAccountabilities).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading graciosamente mesmo se a requisição estourar erro na API', () => {
      accountabilityServiceMock.getAccountabilities.mockReturnValue(throwError(() => new Error('Erro de Conexão')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['accountabilitiesList']()).toEqual([]);
    });
  });

  describe('Validador Otimizado de Permissões - checkPermissions()', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve retornar false se o usuário possuir a permissão (liberando a ação no HTML)', () => {
      const isDisabled = component['checkPermissions']('tfd/prestação de contas atualizar');
      expect(isDisabled).toBe(false);
    });

    it('deve retornar true se o usuário NÃO possuir a permissão (bloqueando a ação com o atributo disabled)', () => {
      const isDisabled = component['checkPermissions']('tfd/prestação de contas deletar');
      expect(isDisabled).toBe(true);
    });

    it('deve retornar true por padrão de segurança se a estrutura de permissões estiver vazia ou nula', () => {
      component['data'].permissions = null;
      const isDisabled = component['checkPermissions']('tfd/prestação de contas atualizar');
      expect(isDisabled).toBe(true);
    });
  });

  describe('Gerenciamento e Abertura das Modais de Ação', () => {
    const mockItem = { id: 1, name: 'Prestação de Contas Anual' } as Accountability;

    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve abrir a modal CreateAccountabilityComponent e atualizar a listagem se confirmada', () => {
      accountabilityServiceMock.getAccountabilities.mockClear();

      component['createAccountability']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreateAccountabilityComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { patient_request: mockDialogData.patient_request }
      });
      expect(accountabilityServiceMock.getAccountabilities).toHaveBeenCalledWith(550);
    });

    it('deve abrir a modal ShowAccountabilityComponent apenas para visualização', () => {
      component['showAccountability'](mockItem);

      expect(dialogMock.open).toHaveBeenCalledWith(ShowAccountabilityComponent, {
        width: '800px',
        disableClose: true,
        autoFocus: false,
        data: { accountability: mockItem }
      });
    });

    it('deve abrir a modal UpdateAccountabilityComponent e recarregar dados', () => {
      accountabilityServiceMock.getAccountabilities.mockClear();

      component['updateAccountability'](mockItem);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdateAccountabilityComponent, {
        width: '500px',
        disableClose: true,
        autoFocus: false,
        data: { accountability: mockItem }
      });
      expect(accountabilityServiceMock.getAccountabilities).toHaveBeenCalled();
    });

    it('deve abrir a modal DeleteAccountabilityComponent em tamanho reduzido (400px)', () => {
      accountabilityServiceMock.getAccountabilities.mockClear();

      component['deleteAccountability'](mockItem);

      expect(dialogMock.open).toHaveBeenCalledWith(DeleteAccountabilityComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { accountability: mockItem }
      });
      expect(accountabilityServiceMock.getAccountabilities).toHaveBeenCalled();
    });

    it('deve abrir a modal AccountabilityDailiesComponent passando as permissões e atualizando listagem + balanço', () => {
      accountabilityServiceMock.getAccountabilities.mockClear();
      accountabilityServiceMock.getBalance.mockClear();
      
      // Diárias atualizam dados forçadamente devido à propriedade updateBalance
      dialogRefMock.afterClosed.mockReturnValue(of(false)); 

      component['accountabilityDailies'](mockItem);

      expect(dialogMock.open).toHaveBeenCalledWith(AccountabilityDailiesComponent, {
        width: '1000px',
        disableClose: true,
        autoFocus: false,
        data: {
          accountability: mockItem,
          permissions: mockDialogData.permissions
        }
      });
      expect(accountabilityServiceMock.getAccountabilities).toHaveBeenCalled();
      expect(accountabilityServiceMock.getBalance).toHaveBeenCalled();
    });

    it('não deve recarregar os dados se as modais de alteração forem fechadas sem confirmação (retornando false)', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      accountabilityServiceMock.getAccountabilities.mockClear();

      component['updateAccountability'](mockItem);

      expect(accountabilityServiceMock.getAccountabilities).not.toHaveBeenCalled();
    });
  });
});