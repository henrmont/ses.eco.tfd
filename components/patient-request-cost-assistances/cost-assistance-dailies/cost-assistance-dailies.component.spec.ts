import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { CostAssistanceDailiesComponent } from './cost-assistance-dailies-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { CostAssistanceDaily } from '../../../models/cost-assistance-daily';

import { CreateCostAssistanceDailyComponent } from '../create-cost-assistance-daily-component/create-cost-assistance-daily-component';
import { UpdateCostAssistanceDailyComponent } from '../update-cost-assistance-daily-component/update-cost-assistance-daily-component';
import { DeleteCostAssistanceDailyComponent } from '../delete-cost-assistance-daily-component/delete-cost-assistance-daily-component';

describe('CostAssistanceDailiesComponent', () => {
  let component: CostAssistanceDailiesComponent;
  let fixture: ComponentFixture<CostAssistanceDailiesComponent>;

  // Mocks das dependências
  let costAssistanceServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;

  // Dados de entrada simulados via MAT_DIALOG_DATA incluindo árvore de permissões
  const mockDialogData = {
    cost_assistance: {
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
    costAssistanceServiceMock = {
      getCostAssistanceDailies: vi.fn().mockReturnValue(of(mockDailiesResponse))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula fechamento confirmando ação (true)
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    await TestBed.configureTestingModule({
      imports: [CostAssistanceDailiesComponent]
    })
    .overrideComponent(CostAssistanceDailiesComponent, {
      set: {
        providers: [
          { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CostAssistanceDailiesComponent);
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

      // Verifica chamada correta do serviço usando o ID da ajuda de custo injetado
      expect(costAssistanceServiceMock.getCostAssistanceDailies).toHaveBeenCalledWith(150);

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

    it('deve desativar o spinner e interromper o fluxo caso o id do cost_assistance esteja ausente (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [CostAssistanceDailiesComponent] })
        .overrideComponent(CostAssistanceDailiesComponent, {
          set: {
            providers: [
              { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { cost_assistance: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(CostAssistanceDailiesComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(costAssistanceServiceMock.getCostAssistanceDailies).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading graciosamente mesmo se a API falhar', () => {
      costAssistanceServiceMock.getCostAssistanceDailies.mockReturnValue(throwError(() => new Error('Erro de API')));
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
      // Como o método retorna !roles.some, a presença da permissão resulta em falso (ou seja, sem restrição / liberado)
      const hasRestriction = component['checkPermissions']('EDITAR_DIARIA');
      expect(hasRestriction).toBe(false);
    });

    it('deve retornar verdadeiro se a permissão fornecida não for localizada', () => {
      const hasRestriction = component['checkPermissions']('PERMISSAO_INEXISTENTE');
      expect(hasRestriction).toBe(true);
    });
  });

  describe('Abertura de Modais de Ação', () => {
    const targetDaily = { id: 1, amount: 2, daily_cost: { value: 50 } } as CostAssistanceDaily;

    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve abrir a modal CreateCostAssistanceDailyComponent e atualizar a grid se confirmada', () => {
      costAssistanceServiceMock.getCostAssistanceDailies.mockClear();

      component['createCostAssistanceDaily']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreateCostAssistanceDailyComponent, {
        width: '500px',
        disableClose: true,
        autoFocus: false,
        data: { cost_assistance: mockDialogData.cost_assistance }
      });

      expect(costAssistanceServiceMock.getCostAssistanceDailies).toHaveBeenCalledWith(150);
    });

    it('deve abrir a modal UpdateCostAssistanceDailyComponent passando o registro alvo e atualizar a grid', () => {
      costAssistanceServiceMock.getCostAssistanceDailies.mockClear();

      component['updateCostAssistanceDaily'](targetDaily);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdateCostAssistanceDailyComponent, {
        width: '500px',
        disableClose: true,
        autoFocus: false,
        data: { cost_assistance_daily: targetDaily }
      });

      expect(costAssistanceServiceMock.getCostAssistanceDailies).toHaveBeenCalled();
    });

    it('deve abrir a modal DeleteCostAssistanceDailyComponent em tamanho reduzido (400px)', () => {
      costAssistanceServiceMock.getCostAssistanceDailies.mockClear();

      component['deleteCostAssistanceDaily'](targetDaily);

      expect(dialogMock.open).toHaveBeenCalledWith(DeleteCostAssistanceDailyComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { cost_assistance_daily: targetDaily }
      });

      expect(costAssistanceServiceMock.getCostAssistanceDailies).toHaveBeenCalled();
    });

    it('não deve recarregar os dados do serviço se as modais forem fechadas sem ação confirmada', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      costAssistanceServiceMock.getCostAssistanceDailies.mockClear();

      component['updateCostAssistanceDaily'](targetDaily);

      expect(costAssistanceServiceMock.getCostAssistanceDailies).not.toHaveBeenCalled();
    });
  });
});