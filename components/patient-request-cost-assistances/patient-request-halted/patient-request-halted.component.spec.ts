import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HaltedPatientRequestComponent } from './halted-patient-request-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { MessageService } from '../../../../core/services/message-service';

describe('HaltedPatientRequestComponent', () => {
  let component: HaltedPatientRequestComponent;
  let fixture: ComponentFixture<HaltedPatientRequestComponent>;
  
  let costAssistanceServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 450,
      is_cost_assistance_bookmark: false,
      report: {
        patient_care: {
          patient: {
            name: 'Carlos Alberto'
          }
        }
      }
    }
  };

  beforeEach(async () => {
    costAssistanceServiceMock = {
      haltedPatientRequest: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [HaltedPatientRequestComponent]
    })
    .overrideComponent(HaltedPatientRequestComponent, {
      set: {
        providers: [
          { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(HaltedPatientRequestComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve inicializar com o estado de submissão desativado', () => {
      fixture.detectChanges();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Fluxo de Submissão (onSubmit)', () => {
    it('deve barrar a execução e exibir mensagem de erro se o id da solicitação não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [HaltedPatientRequestComponent] })
        .overrideComponent(HaltedPatientRequestComponent, {
          set: {
            providers: [
              { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(HaltedPatientRequestComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
      expect(costAssistanceServiceMock.haltedPatientRequest).not.toHaveBeenCalled();
    });

    // ==========================================
    // 🎯 FLUXO A: MARCAR SOBRESTADO (is_cost_assistance_bookmark: false)
    // ==========================================
    describe('Quando a ação for MARCAR SOBRESTADO (is_cost_assistance_bookmark: false)', () => {
      it('deve paralisar a solicitação com sucesso, exibir mensagem da API e fechar a modal retornando true', () => {
        fixture.detectChanges();
        const mockApiResponse = { message: 'Solicitação suspensa pela auditoria!' };
        costAssistanceServiceMock.haltedPatientRequest.mockReturnValue(of(mockApiResponse));

        component['onSubmit']();

        expect(component['isSubmitting']()).toBe(false);
        expect(costAssistanceServiceMock.haltedPatientRequest).toHaveBeenCalledWith(450);
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação suspensa pela auditoria!');
        expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      });

      it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
        fixture.detectChanges();
        costAssistanceServiceMock.haltedPatientRequest.mockReturnValue(of({}));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Status da solicitação atualizado com sucesso!');
      });

      it('deve tratar falhas do servidor, exibir mensagem de erro da API e liberar o estado de submissão', () => {
        fixture.detectChanges();
        const mockApiError = { error: { message: 'Não é possível paralisar uma solicitação com pagamentos emitidos.' } };
        costAssistanceServiceMock.haltedPatientRequest.mockReturnValue(throwError(() => mockApiError));

        component['onSubmit']();

        expect(costAssistanceServiceMock.haltedPatientRequest).toHaveBeenCalledWith(450);
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
        expect(component['isSubmitting']()).toBe(false);
        expect(dialogRefMock.close).not.toHaveBeenCalled();
      });

      it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
        fixture.detectChanges();
        const rawError = { status: 500 };
        costAssistanceServiceMock.haltedPatientRequest.mockReturnValue(throwError(() => rawError));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro operacional ao tentar alterar o status da solicitação.');
        expect(component['isSubmitting']()).toBe(false);
      });
    });

    // ==========================================
    // 🎯 FLUXO B: DESMARCAR SOBRESTADO (is_cost_assistance_bookmark: true)
    // ==========================================
    describe('Quando a ação for DESMARCAR SOBRESTADO (is_cost_assistance_bookmark: true)', () => {
      beforeEach(() => {
        // Altera o valor em tempo de execução contornando a restrição estrutural do objeto
        Object.assign(component['data'].patient_request, { is_cost_assistance_bookmark: true });
      });

      it('deve executar a chamada de API normalmente repassando o ID da solicitação', () => {
        fixture.detectChanges();
        costAssistanceServiceMock.haltedPatientRequest.mockReturnValue(of({ message: 'Retornado ao fluxo normal.' }));

        component['onSubmit']();

        expect(costAssistanceServiceMock.haltedPatientRequest).toHaveBeenCalledWith(450);
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Retornado ao fluxo normal.');
        expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      });

      it('deve reter o comportamento e resetar o sinal isSubmitting caso ocorra erro no fluxo de desmarcação', () => {
        fixture.detectChanges();
        costAssistanceServiceMock.haltedPatientRequest.mockReturnValue(throwError(() => ({ status: 400 })));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro operacional ao tentar alterar o status da solicitação.');
        expect(component['isSubmitting']()).toBe(false);
      });
    });
  });
});