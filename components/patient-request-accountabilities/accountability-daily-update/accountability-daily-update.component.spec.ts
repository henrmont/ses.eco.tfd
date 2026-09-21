import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { UpdateAccountabilityDailyComponent } from './update-accountability-daily-component';
import { AccountabilityService } from '../../../services/accountability-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdateAccountabilityDailyComponent', () => {
  let component: UpdateAccountabilityDailyComponent;
  let fixture: ComponentFixture<UpdateAccountabilityDailyComponent>;

  let accountabilityServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    accountability_daily: {
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
    accountabilityServiceMock = {
      getDailyCosts: vi.fn().mockReturnValue(of(mockDailyCostsResponse)),
      updateAccountabilityDaily: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdateAccountabilityDailyComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: AccountabilityService, useValue: accountabilityServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(UpdateAccountabilityDailyComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateAccountabilityDailyComponent);
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
    expect(component['updateAccountabilityDailyForm']).toBeTruthy();
    
    // 🔥 Diferencial do Update: Valida o preenchimento prévio vindo do MAT_DIALOG_DATA
    expect(component['updateAccountabilityDailyForm'].get('daily_cost_id')?.value).toBe(10);
    expect(component['updateAccountabilityDailyForm'].get('amount')?.value).toBe(4);

    expect(accountabilityServiceMock.getDailyCosts).toHaveBeenCalled();
    expect(component['dailyCostsOptions']()).toEqual(mockDailyCostsResponse);
  });

  it('deve disparar mensagem de aviso se a API de carregar as opções falhar na inicialização', () => {
    accountabilityServiceMock.getDailyCosts.mockReturnValue(throwError(() => new Error('Erro de Conexão')));
    fixture.detectChanges();

    expect(component['isLoadingOptions']()).toBe(false);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Falha ao carregar as opções de diária.');
  });

  describe('Fluxo de Submissão do Formulário de Edição de Diária (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Mantém o estado íntegro original antes de cada teste de submissão
      (component as any).data = {
        accountability_daily: {
          id: 990,
          daily_cost_id: 10,
          amount: 4
        }
      };
    });

    it('deve barrar a submissão e marcar campos se o formulário estiver inválido por limpeza de campos obrigatórios', () => {
      component['updateAccountabilityDailyForm'].patchValue({ daily_cost_id: null, amount: null });
      expect(component['updateAccountabilityDailyForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(accountabilityServiceMock.updateAccountabilityDaily).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se a quantidade enviada for alterada para menos de 1', () => {
      component['updateAccountabilityDailyForm'].patchValue({ amount: 0 });
      expect(component['updateAccountabilityDailyForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(accountabilityServiceMock.updateAccountabilityDaily).not.toHaveBeenCalled();
    });

    it('deve barrar a submissão se o ID da diária não for localizado nos dados injetados na modal', () => {
      // 1. Resetamos o TestBed especificamente para este teste para injetar o dado quebrado na raiz
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [UpdateAccountabilityDailyComponent],
        providers: [
          { provide: AccountabilityService, useValue: accountabilityServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: { accountability_daily: null } }
        ]
      });

      // 2. Criamos uma nova fixture isolada para o cenário
      const localFixture = TestBed.createComponent(UpdateAccountabilityDailyComponent);
      const localComponent = localFixture.componentInstance;
      
      localFixture.detectChanges();

      // 3. Forçamos o formulário a ser VÁLIDO estruturalmente
      localComponent['updateAccountabilityDailyForm'].patchValue({ daily_cost_id: 11, amount: 2 });

      // 4. Dispara a ação
      localComponent['onSubmit']();

      // 5. O comportamento esperado é o return silencioso guardado pelo IF de segurança
      expect(accountabilityServiceMock.updateAccountabilityDaily).not.toHaveBeenCalled();
      expect(messageServiceMock.showMessage).not.toHaveBeenCalled();
    });

    it('deve atualizar a diária com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      // Altera os valores simulando a interação do usuário
      component['updateAccountabilityDailyForm'].patchValue({
        daily_cost_id: 11,
        amount: 6
      });

      accountabilityServiceMock.updateAccountabilityDaily.mockReturnValue(of({ message: 'Diária atualizada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(accountabilityServiceMock.updateAccountabilityDaily).toHaveBeenCalledWith(990, {
        daily_cost_id: 11,
        amount: 6
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Diária atualizada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API se o backend recusar a requisição', () => {
      const mockApiError = { error: { message: 'Não foi possível processar a alteração solicitada.' } };
      accountabilityServiceMock.updateAccountabilityDaily.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Não foi possível processar a alteração solicitada.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve acionar a string de fallback padrão quando o servidor retornar um erro genérico sem mensagem explícita', () => {
      const mockRawError = { status: 500, statusText: 'Internal Error' };
      accountabilityServiceMock.updateAccountabilityDaily.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao atualizar a diária.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});