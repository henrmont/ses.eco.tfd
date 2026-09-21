import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MovePatientRequestFromOthersComponent } from './move-patient-request-from-others-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { MessageService } from '../../../../core/services/message-service';

describe('MovePatientRequestFromOthersComponent', () => {
  let component: MovePatientRequestFromOthersComponent;
  let fixture: ComponentFixture<MovePatientRequestFromOthersComponent>;

  let costAssistanceServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 880,
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
      movePatientRequestFromOthers: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    costAssistanceServiceMock.movePatientRequestFromOthers.mockReturnValue(
      of({ message: 'Solicitação movimentada com sucesso!' })
    );

    await TestBed.configureTestingModule({
      imports: [MovePatientRequestFromOthersComponent],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MovePatientRequestFromOthersComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com o estado inicial de submissão desativado', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
  });

  describe('Fluxo de Execução - onSubmit()', () => {
    
    it('deve exibir mensagem de erro se o id do request não for informado', () => {
      component['data'].patient_request.id = null;

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro: Identificador da solicitação não encontrado.'
      );
      expect(costAssistanceServiceMock.movePatientRequestFromOthers).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve movimentar a solicitação passando apenas o id correto e fechar a modal', () => {
      component['data'].patient_request.id = 880;

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(costAssistanceServiceMock.movePatientRequestFromOthers).toHaveBeenCalledWith(880);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação movimentada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem de fallback no sucesso se a API não retornar uma mensagem explícita', () => {
      costAssistanceServiceMock.movePatientRequestFromOthers.mockReturnValue(of({}));
      component['data'].patient_request.id = 880;

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação movimentada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar erro estruturado enviado pela API e restaurar estado de submissão', () => {
      component['data'].patient_request.id = 880;
      costAssistanceServiceMock.movePatientRequestFromOthers.mockReturnValue(
        throwError(() => ({ error: { message: 'Erro ao processar movimentação.' } }))
      );

      component['onSubmit']();

      expect(costAssistanceServiceMock.movePatientRequestFromOthers).toHaveBeenCalledWith(880);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar movimentação.');
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica de fallback se a API falhar sem retornar uma mensagem', () => {
      component['data'].patient_request.id = 880;
      costAssistanceServiceMock.movePatientRequestFromOthers.mockReturnValue(
        throwError(() => ({ error: null }))
      );

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar movimentar a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});