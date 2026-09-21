import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { PatientRequestCostAssistancesComponent } from './patient-request-cost-assistances-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { CostAssistance } from '../../../models/cost-assistance';

import { CreateCostAssistanceComponent } from '../create-cost-assistance-component/create-cost-assistance-component';
import { UpdateCostAssistanceComponent } from '../update-cost-assistance-component/update-cost-assistance-component';
import { DeleteCostAssistanceComponent } from '../delete-cost-assistance-component/delete-cost-assistance-component';
import { CostAssistanceDailiesComponent } from '../cost-assistance-dailies-component/cost-assistance-dailies-component';
import { ShowCostAssistanceComponent } from '../show-cost-assistance-component/show-cost-assistance-component';

describe('PatientRequestCostAssistancesComponent', () => {
  let component: PatientRequestCostAssistancesComponent;
  let fixture: ComponentFixture<PatientRequestCostAssistancesComponent>;

  // Mocks das dependências
  let costAssistanceServiceMock: any;
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
          { name: 'update-cost-assistance' },
          { name: 'cost-assistance-dailies' }
        ]
      }
    ]
  };

  const mockCostAssistancesResponse: any[] = [
    { id: 1, name: 'Auxílio Transporte urbano', type: 'Transporte', total_dailies: 50.00 },
    { id: 2, name: 'Auxílio Alimentação interna', type: 'Alimentação', total_dailies: 120.00 }
  ];

  beforeEach(async () => {
    costAssistanceServiceMock = {
      getCostAssistances: vi.fn().mockReturnValue(of(mockCostAssistancesResponse)),
      getBalance: vi.fn().mockReturnValue(of(170.00))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula confirmação nas modais normais
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    await TestBed.configureTestingModule({
      imports: [PatientRequestCostAssistancesComponent]
    })
    .overrideComponent(PatientRequestCostAssistancesComponent, {
      set: {
        providers: [
          { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestCostAssistancesComponent);
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

    it('deve buscar as ajudas de custo e o saldo do atendimento reativamente ao iniciar', () => {
      fixture.detectChanges();

      expect(costAssistanceServiceMock.getCostAssistances).toHaveBeenCalledWith(550);
      expect(costAssistanceServiceMock.getBalance).toHaveBeenCalledWith(990);

      // Valida se os signals guardaram o estado esperado da API
      expect(component['costAssistancesList']()).toEqual(mockCostAssistancesResponse);
      expect(component['totalValue']()).toBe(170.00);
      expect(component['isLoading']()).toBe(false);

      // Valida o computed encapsulado do MatTableDataSource
      const computedDataSource = component['dataSource']();
      expect(computedDataSource).toBeInstanceOf(MatTableDataSource);
      expect(computedDataSource.data).toEqual(mockCostAssistancesResponse);
    });

    it('deve interromper a busca e desligar o loading se o id do patient_request for nulo (Guarda de Segurança)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [PatientRequestCostAssistancesComponent] })
        .overrideComponent(PatientRequestCostAssistancesComponent, {
          set: {
            providers: [
              { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(PatientRequestCostAssistancesComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(costAssistanceServiceMock.getCostAssistances).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading graciosamente mesmo se a requisição estourar erro na API', () => {
      costAssistanceServiceMock.getCostAssistances.mockReturnValue(throwError(() => new Error('Erro de Conexão')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['costAssistancesList']()).toEqual([]);
    });
  });

  describe('Validador Otimizado de Permissões - checkPermissions()', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve retornar false se o usuário possuir a permissão (liberando a ação no HTML)', () => {
      const isDisabled = component['checkPermissions']('update-cost-assistance');
      expect(isDisabled).toBe(false);
    });

    it('deve retornar true se o usuário NÃO possuir a permissão (bloqueando a ação com o atributo disabled)', () => {
      const isDisabled = component['checkPermissions']('delete-cost-assistance');
      expect(isDisabled).toBe(true);
    });

    it('deve retornar true por padrão de segurança se a estrutura de permissões estiver vazia ou nula', () => {
      component['data'].permissions = null;
      const isDisabled = component['checkPermissions']('update-cost-assistance');
      expect(isDisabled).toBe(true);
    });
  });

  describe('Gerenciamento e Abertura das Modais de Ação', () => {
    const mockItem = { id: 1, name: 'Auxílio Alimentação' } as CostAssistance;

    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve abrir a modal CreateCostAssistanceComponent e atualizar a listagem se confirmada', () => {
      costAssistanceServiceMock.getCostAssistances.mockClear();

      component['createCostAssistance']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreateCostAssistanceComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { patient_request: mockDialogData.patient_request }
      });
      expect(costAssistanceServiceMock.getCostAssistances).toHaveBeenCalledWith(550);
    });

    it('deve abrir a modal ShowCostAssistanceComponent apenas para visualização', () => {
      component['showCostAssistance'](mockItem);

      expect(dialogMock.open).toHaveBeenCalledWith(ShowCostAssistanceComponent, {
        width: '800px',
        disableClose: true,
        autoFocus: false,
        data: { cost_assistance: mockItem }
      });
    });

    it('deve abrir a modal UpdateCostAssistanceComponent e recarregar dados', () => {
      costAssistanceServiceMock.getCostAssistances.mockClear();

      component['updateCostAssistance'](mockItem);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdateCostAssistanceComponent, {
        width: '500px',
        disableClose: true,
        autoFocus: false,
        data: { cost_assistance: mockItem }
      });
      expect(costAssistanceServiceMock.getCostAssistances).toHaveBeenCalled();
    });

    it('deve abrir a modal DeleteCostAssistanceComponent em tamanho reduzido (400px)', () => {
      costAssistanceServiceMock.getCostAssistances.mockClear();

      component['deleteCostAssistance'](mockItem);

      expect(dialogMock.open).toHaveBeenCalledWith(DeleteCostAssistanceComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { cost_assistance: mockItem }
      });
      expect(costAssistanceServiceMock.getCostAssistances).toHaveBeenCalled();
    });

    it('deve abrir a modal CostAssistanceDailiesComponent passando as permissões e atualizando listagem + balanço', () => {
      costAssistanceServiceMock.getCostAssistances.mockClear();
      costAssistanceServiceMock.getBalance.mockClear();
      
      // Diárias atualizam dados forçadamente devido à propriedade updateBalance
      dialogRefMock.afterClosed.mockReturnValue(of(false)); 

      component['costAssistanceDailies'](mockItem);

      expect(dialogMock.open).toHaveBeenCalledWith(CostAssistanceDailiesComponent, {
        width: '1000px',
        disableClose: true,
        autoFocus: false,
        data: {
          cost_assistance: mockItem,
          permissions: mockDialogData.permissions
        }
      });
      expect(costAssistanceServiceMock.getCostAssistances).toHaveBeenCalled();
      expect(costAssistanceServiceMock.getBalance).toHaveBeenCalled();
    });

    it('não deve recarregar os dados se as modais de alteração forem fechadas sem confirmação (retornando false)', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      costAssistanceServiceMock.getCostAssistances.mockClear();

      component['updateCostAssistance'](mockItem);

      expect(costAssistanceServiceMock.getCostAssistances).not.toHaveBeenCalled();
    });
  });
});