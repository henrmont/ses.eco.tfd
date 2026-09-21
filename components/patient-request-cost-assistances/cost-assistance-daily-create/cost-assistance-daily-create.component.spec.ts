import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { CreateCostAssistanceDailyComponent } from './create-cost-assistance-daily-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreateCostAssistanceDailyComponent', () => {
  let component: CreateCostAssistanceDailyComponent;
  let fixture: ComponentFixture<CreateCostAssistanceDailyComponent>;

  let costAssistanceServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    cost_assistance: {
      id: 770
    }
  };

  const mockDailyCostsResponse = [
    { id: 10, name: 'Alimentação Integral', value: 80.00 },
    { id: 11, name: 'Pernoite', value: 150.00 }
  ];

  beforeEach(async () => {
    costAssistanceServiceMock = {
      getDailyCosts: vi.fn().mockReturnValue(of(mockDailyCostsResponse)),
      createCostAssistanceDaily: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        CreateCostAssistanceDailyComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(CreateCostAssistanceDailyComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateCostAssistanceDailyComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente com sucesso, inicializar o formulário e carregar as opções de diárias', () => {
    fixture.detectChanges(); // Aciona o ngOnInit e consequentemente o fetchDailyCosts()

    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isLoadingOptions']()).toBe(false);
    expect(component['createCostAssistanceDailyForm']).toBeTruthy();
    
    // Valida inicialização limpa dos campos
    expect(component['createCostAssistanceDailyForm'].get('daily_cost_id')?.value).toBeNull();
    expect(component['createCostAssistanceDailyForm'].get('amount')?.value).toBeNull();

    // Valida o preenchimento do signal de opções
    expect(costAssistanceServiceMock.getDailyCosts).toHaveBeenCalled();
    expect(component['dailyCostsOptions']()).toEqual(mockDailyCostsResponse);
  });

  it('deve disparar mensagem de aviso se a API de carregar as opções falhar na inicialização', () => {
    costAssistanceServiceMock.getDailyCosts.mockReturnValue(throwError(() => new Error('Erro de Conexão')));
    fixture.detectChanges();

    expect(component['isLoadingOptions']()).toBe(false);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Falha ao carregar as opções de diária.');
  });

  describe('Fluxo de Submissão do Formulário de Vínculo de Diária (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Garante que o objeto data seja resetado para o estado íntegro original antes de cada teste
      (component as any).data = {
        cost_assistance: {
          id: 770
        }
      };
    });

    it('deve barrar a submissão e marcar campos se o formulário estiver inválido por falta de preenchimento', () => {
      expect(component['createCostAssistanceDailyForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(costAssistanceServiceMock.createCostAssistanceDaily).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se a quantidade enviada for menor que 1 (validação customizada do min)', () => {
      component['createCostAssistanceDailyForm'].patchValue({ daily_cost_id: 10, amount: 0 });
      expect(component['createCostAssistanceDailyForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(costAssistanceServiceMock.createCostAssistanceDaily).not.toHaveBeenCalled();
    });

    it('deve barrar a submissão se o ID da ajuda de custo não for localizado nos dados injetados na modal', () => {
      // 1. Resetamos o TestBed especificamente para este teste para injetar o dado nulo na raiz
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [CreateCostAssistanceDailyComponent],
        providers: [
          { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: { cost_assistance: null } }
        ]
      });

      // 2. Criamos uma nova fixture isolada para este cenário
      const localFixture = TestBed.createComponent(CreateCostAssistanceDailyComponent);
      const localComponent = localFixture.componentInstance;
      
      localFixture.detectChanges();

      // 3. Forçamos o formulário a ser VÁLIDO para garantir que ele passaria se o ID existisse
      localComponent['createCostAssistanceDailyForm'].patchValue({ daily_cost_id: 10, amount: 2 });

      // 4. Dispara a submissão
      localComponent['onSubmit']();

      // 5. Valida se a trava de segurança barrou a chamada da API (o comportamento esperado é o return silencioso)
      expect(costAssistanceServiceMock.createCostAssistanceDaily).not.toHaveBeenCalled();
      expect(messageServiceMock.showMessage).not.toHaveBeenCalled(); // 👈 Corrigido: Não deve chamar mensagem nenhuma!
    });

    it('deve criar a diária com sucesso utilizando getRawValue, exibir mensagem de sucesso e fechar a modal', () => {
      component['createCostAssistanceDailyForm'].patchValue({
        daily_cost_id: 11,
        amount: 3
      });

      costAssistanceServiceMock.createCostAssistanceDaily.mockReturnValue(of({ message: 'Diária adicionada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(costAssistanceServiceMock.createCostAssistanceDaily).toHaveBeenCalledWith(770, {
        daily_cost_id: 11,
        amount: 3
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Diária adicionada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API se o backend recusar a requisição', () => {
      component['createCostAssistanceDailyForm'].patchValue({
        daily_cost_id: 10,
        amount: 1
      });

      const mockApiError = { error: { message: 'Não é permitido adicionar diárias duplicadas para esta mesma ajuda.' } };
      costAssistanceServiceMock.createCostAssistanceDaily.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Não é permitido adicionar diárias duplicadas para esta mesma ajuda.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve acionar a string de fallback padrão quando o servidor retornar um erro genérico sem mensagem explícita', () => {
      component['createCostAssistanceDailyForm'].patchValue({
        daily_cost_id: 11,
        amount: 5
      });

      const mockRawError = { status: 400, statusText: 'Bad Request' };
      costAssistanceServiceMock.createCostAssistanceDaily.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao vincular a diária.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});