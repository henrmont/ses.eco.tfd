import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MovePatientRequestFromProcessesComponent } from './move-patient-request-from-processes-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { MessageService } from '../../../../core/services/message-service';

describe('MovePatientRequestFromProcessesComponent', () => {
  let component: MovePatientRequestFromProcessesComponent;
  let fixture: ComponentFixture<MovePatientRequestFromProcessesComponent>;
  
  let patientRequestServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock estruturado exatamente igual ao seu HTML, incluindo o nó .patient
  const mockDialogData = {
    patient_request: {
      id: 850,
      report: {
        patient_care: {
          patient: {
            name: 'Carlos Eduardo'
          }
        }
      }
    }
  };

  beforeEach(async () => {
    patientRequestServiceMock = {
      movePatientRequestFromProcesses: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [MovePatientRequestFromProcessesComponent]
    })
    .overrideComponent(MovePatientRequestFromProcessesComponent, {
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

    fixture = TestBed.createComponent(MovePatientRequestFromProcessesComponent);
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
      TestBed.configureTestingModule({ imports: [MovePatientRequestFromProcessesComponent] })
        .overrideComponent(MovePatientRequestFromProcessesComponent, {
          set: {
            providers: [
              { provide: PatientRequestService, useValue: patientRequestServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null, report: { patient_care: { patient: { name: 'Incompleto' } } } } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(MovePatientRequestFromProcessesComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
      expect(patientRequestServiceMock.movePatientRequestFromProcesses).not.toHaveBeenCalled();
    });

    it('deve movimentar a solicitação com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Solicitação transferida com sucesso!' };
      patientRequestServiceMock.movePatientRequestFromProcesses.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(patientRequestServiceMock.movePatientRequestFromProcesses).toHaveBeenCalledWith(850);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação transferida com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
      fixture.detectChanges();
      patientRequestServiceMock.movePatientRequestFromProcesses.mockReturnValue(of({}));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação movimentada com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Esta solicitação já foi movimentada por outro operador.' } };
      patientRequestServiceMock.movePatientRequestFromProcesses.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(patientRequestServiceMock.movePatientRequestFromProcesses).toHaveBeenCalledWith(850);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
      fixture.detectChanges();
      const rawError = { status: 500 };
      patientRequestServiceMock.movePatientRequestFromProcesses.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar movimentar a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});