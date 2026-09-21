import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { UpdateCostAssistanceDailyComponent } from './update-cost-assistance-daily-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdateCostAssistanceDailyComponent', () => {
  let component: UpdateCostAssistanceDailyComponent;
  let fixture: ComponentFixture<UpdateCostAssistanceDailyComponent>;

  let costAssistanceServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    cost_assistance_daily: {
      id: 990,
      daily_cost_id: 10,
      amount: 4
    }
  };

  const mockDailyCostsResponse = [
    { id: 10, name: 'Alimentação Integral', value: 80.00 },
    { id: 11, name: 'Pernoite', value: 150.00 }
  ];

  beforeEach(async () => {
    costAssistanceServiceMock = {
      getDailyCosts: vi.fn().mockReturnValue(of(mockDailyCostsResponse)),
      updateCostAssistanceDaily: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdateCostAssistanceDailyComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(UpdateCostAssistanceDailyComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateCostAssistanceDailyComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente com sucesso, inicializar o formulário preenchido e carregar as opções de diárias', () => {
    fixture.detectChanges(); // Executa o ngOnInit e consequentemente o fetchDailyCosts()

    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isLoadingOptions']()).toBe(false);
    expect(component['updateCostAssistanceDailyForm']).toBeTruthy();
    
    // 🔥 Diferencial do Update: Valida o preenchimento prévio vindo do MAT_DIALOG_DATA
    expect(component['updateCostAssistanceDailyForm'].get('daily_cost_id')?.value).toBe(10);
    expect(component['updateCostAssistanceDailyForm'].get('amount')?.value).toBe(4);

    expect(costAssistanceServiceMock.getDailyCosts).toHaveBeenCalled();
    expect(component['dailyCostsOptions']()).toEqual(mockDailyCostsResponse);
  });

  it('deve disparar mensagem de aviso se a API de carregar as opções falhar na inicialização', () => {
    costAssistanceServiceMock.getDailyCosts.mockReturnValue(throwError(() => new Error('Erro de Conexão')));
    fixture.detectChanges();

    expect(component['isLoadingOptions']()).toBe(false);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Falha ao carregar as opções de diária.');
  });

  describe('Fluxo de Submissão do Formulário de Edição de Diária (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Mantém o estado íntegro original antes de cada teste de submissão
      (component as any).data = {
        cost_assistance_daily: {
          id: 990,
          daily_cost_id: 10,
          amount: 4
        }
      };
    });

    it('deve barrar a submissão e marcar campos se o formulário estiver inválido por limpeza de campos obrigatórios', () => {
      component['updateCostAssistanceDailyForm'].patchValue({ daily_cost_id: null, amount: null });
      expect(component['updateCostAssistanceDailyForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(costAssistanceServiceMock.updateCostAssistanceDaily).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se a quantidade enviada for alterada para menos de 1', () => {
      component['updateCostAssistanceDailyForm'].patchValue({ amount: 0 });
      expect(component['updateCostAssistanceDailyForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(costAssistanceServiceMock.updateCostAssistanceDaily).not.toHaveBeenCalled();
    });

    it('deve barrar a submissão se o ID da diária não for localizado nos dados injetados na modal', () => {
      // 1. Resetamos o TestBed especificamente para este teste para injetar o dado quebrado na raiz
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [UpdateCostAssistanceDailyComponent],
        providers: [
          { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: { cost_assistance_daily: null } }
        ]
      });

      // 2. Criamos uma nova fixture isolada para o cenário
      const localFixture = TestBed.createComponent(UpdateCostAssistanceDailyComponent);
      const localComponent = localFixture.componentInstance;
      
      localFixture.detectChanges();

      // 3. Forçamos o formulário a ser VÁLIDO estruturalmente
      localComponent['updateCostAssistanceDailyForm'].patchValue({ daily_cost_id: 11, amount: 2 });

      // 4. Dispara a ação
      localComponent['onSubmit']();

      // 5. O comportamento esperado é o return silencioso guardado pelo IF de segurança
      expect(costAssistanceServiceMock.updateCostAssistanceDaily).not.toHaveBeenCalled();
      expect(messageServiceMock.showMessage).not.toHaveBeenCalled();
    });

    it('deve atualizar a diária com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      // Altera os valores simulando a interação do usuário
      component['updateCostAssistanceDailyForm'].patchValue({
        daily_cost_id: 11,
        amount: 6
      });

      costAssistanceServiceMock.updateCostAssistanceDaily.mockReturnValue(of({ message: 'Diária atualizada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(costAssistanceServiceMock.updateCostAssistanceDaily).toHaveBeenCalledWith(990, {
        daily_cost_id: 11,
        amount: 6
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Diária atualizada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API se o backend recusar a requisição', () => {
      const mockApiError = { error: { message: 'Não foi possível processar a alteração solicitada.' } };
      costAssistanceServiceMock.updateCostAssistanceDaily.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Não foi possível processar a alteração solicitada.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve acionar a string de fallback padrão quando o servidor retornar um erro genérico sem mensagem explícita', () => {
      const mockRawError = { status: 500, statusText: 'Internal Error' };
      costAssistanceServiceMock.updateCostAssistanceDaily.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao atualizar a diária.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});