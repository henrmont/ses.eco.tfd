import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeletePatientRequestComponent } from './delete-patient-request-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeletePatientRequestComponent', () => {
  let component: DeletePatientRequestComponent;
  let fixture: ComponentFixture<DeletePatientRequestComponent>;
  
  let patientRequestServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 220,
      report: {
        patient_care: { name: 'João da Silva Santos' }
      }
    }
  };

  beforeEach(async () => {
    patientRequestServiceMock = {
      deletePatientRequest: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeletePatientRequestComponent]
    })
    // 🚀 Forçando os mocks diretamente no escopo do componente Standalone
    .overrideComponent(DeletePatientRequestComponent, {
      set: {
        providers: [
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletePatientRequestComponent);
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
      TestBed.configureTestingModule({ imports: [DeletePatientRequestComponent] })
        .overrideComponent(DeletePatientRequestComponent, {
          set: {
            providers: [
              { provide: PatientRequestService, useValue: patientRequestServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeletePatientRequestComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
      expect(patientRequestServiceMock.deletePatientRequest).not.toHaveBeenCalled();
    });

    it('deve remover a solicitação com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Solicitação excluída com sucesso!' };
      patientRequestServiceMock.deletePatientRequest.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(patientRequestServiceMock.deletePatientRequest).toHaveBeenCalledWith(220);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação excluída com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
      fixture.detectChanges();
      patientRequestServiceMock.deletePatientRequest.mockReturnValue(of({})); // Resposta sem .message

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação removida com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Não é possível remover uma solicitação em andamento.' } };
      patientRequestServiceMock.deletePatientRequest.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(patientRequestServiceMock.deletePatientRequest).toHaveBeenCalledWith(220);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
      fixture.detectChanges();
      const rawError = { status: 500 }; // Sem err.error.message
      patientRequestServiceMock.deletePatientRequest.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});