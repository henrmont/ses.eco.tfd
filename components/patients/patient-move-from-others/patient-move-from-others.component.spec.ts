import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MovePatientFromOthersComponent } from './move-patient-from-others-component';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';

describe('MovePatientFromOthersComponent', () => {
  let component: MovePatientFromOthersComponent;
  let fixture: ComponentFixture<MovePatientFromOthersComponent>;
  
  let patientServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // ✨ AJUSTE AQUI: Mock estruturado exatamente igual ao seu HTML
  const mockDialogData = {
    patient_care: {
      id: 550,
      patient: {
        name: 'Maria Oliveira'
      }
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      movePatientFromOthers: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [MovePatientFromOthersComponent]
    })
    .overrideComponent(MovePatientFromOthersComponent, {
      set: {
        providers: [
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovePatientFromOthersComponent);
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
    it('deve barrar a execução e exibir mensagem de erro se o patient care id não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [MovePatientFromOthersComponent] })
        .overrideComponent(MovePatientFromOthersComponent, {
          set: {
            providers: [
              { provide: PatientService, useValue: patientServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              // Mantendo a estrutura segura mesmo testando o cenário sem ID
              { provide: MAT_DIALOG_DATA, useValue: { patient_care: { id: null, patient: { name: 'Incompleto' } } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(MovePatientFromOthersComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador do atendimento não encontrado.');
      expect(patientServiceMock.movePatientFromOthers).not.toHaveBeenCalled();
    });

    it('deve movimentar o paciente com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Paciente transferido com sucesso!' };
      patientServiceMock.movePatientFromOthers.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(patientServiceMock.movePatientFromOthers).toHaveBeenCalledWith(550);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Paciente transferido com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
      fixture.detectChanges();
      patientServiceMock.movePatientFromOthers.mockReturnValue(of({}));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Paciente movimentado com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'A fila de destino atingiu o limite máximo de pacientes.' } };
      patientServiceMock.movePatientFromOthers.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(patientServiceMock.movePatientFromOthers).toHaveBeenCalledWith(550);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
      fixture.detectChanges();
      const rawError = { status: 500 };
      patientServiceMock.movePatientFromOthers.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar movimentar o paciente.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});