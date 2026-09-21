import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ValidatePatientComponent } from './validate-patient-component';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';

describe('ValidatePatientComponent', () => {
  let component: ValidatePatientComponent;
  let fixture: ComponentFixture<ValidatePatientComponent>;
  
  let patientServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_care: {
      id: 320,
      patient_name: 'João da Silva',
      is_valid: false
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      validatePatient: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ValidatePatientComponent]
    })
    .overrideComponent(ValidatePatientComponent, {
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

    fixture = TestBed.createComponent(ValidatePatientComponent);
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
      TestBed.configureTestingModule({ imports: [ValidatePatientComponent] })
        .overrideComponent(ValidatePatientComponent, {
          set: {
            providers: [
              { provide: PatientService, useValue: patientServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_care: { id: null, patient_name: 'Incompleto', is_valid: false } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(ValidatePatientComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador do atendimento não encontrado.');
      expect(patientServiceMock.validatePatient).not.toHaveBeenCalled();
    });

    // ==========================================
    // 🎯 FLUXO A: VALIDAR ATENDIMENTO (is_valid: false)
    // ==========================================
    describe('Quando a ação for VALIDAR (is_valid: false)', () => {
      it('deve validar o atendimento com sucesso, exibir mensagem da API e fechar a modal retornando true', () => {
        fixture.detectChanges();
        const mockApiResponse = { message: 'Atendimento homologado com sucesso!' };
        patientServiceMock.validatePatient.mockReturnValue(of(mockApiResponse));

        component['onSubmit']();

        expect(component['isSubmitting']()).toBe(false);
        expect(patientServiceMock.validatePatient).toHaveBeenCalledWith(320);
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Atendimento homologado com sucesso!');
        expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      });

      it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
        fixture.detectChanges();
        patientServiceMock.validatePatient.mockReturnValue(of({}));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Atendimento validado com sucesso!');
      });

      it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento', () => {
        fixture.detectChanges();
        const mockApiError = { error: { message: 'Este atendimento possui pendências críticas.' } };
        patientServiceMock.validatePatient.mockReturnValue(throwError(() => mockApiError));

        component['onSubmit']();

        expect(patientServiceMock.validatePatient).toHaveBeenCalledWith(320);
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
        expect(component['isSubmitting']()).toBe(false);
        expect(dialogRefMock.close).not.toHaveBeenCalled();
      });

      it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
        fixture.detectChanges();
        const rawError = { status: 500 };
        patientServiceMock.validatePatient.mockReturnValue(throwError(() => rawError));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar validar o atendimento.');
        expect(component['isSubmitting']()).toBe(false);
      });
    });

    // ==========================================
    // 🎯 FLUXO B: INVALIDAR ATENDIMENTO (is_valid: true)
    // ==========================================
    describe('Quando a ação for INVALIDAR (is_valid: true)', () => {
      beforeEach(() => {
        // ✨ CORREÇÃO AQUI: Em vez de reatribuir o objeto inteiro da propriedade readonly, 
        // usamos o Object.assign para mesclar propriedades na mesma referência de memória.
        Object.assign(component['data'].patient_care, { is_valid: true });
      });

      it('deve usar mensagem padrão de sucesso ao invalidar se a API retornar um objeto vazio', () => {
        fixture.detectChanges();
        patientServiceMock.validatePatient.mockReturnValue(of({}));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Atendimento invalidado com sucesso!');
      });

      it('deve usar mensagem de erro genérica ao invalidar se o servidor falhar sem retornar corpo de erro', () => {
        fixture.detectChanges();
        const rawError = { status: 400 };
        patientServiceMock.validatePatient.mockReturnValue(throwError(() => rawError));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar invalidar o atendimento.');
        expect(component['isSubmitting']()).toBe(false);
      });
    });
  });
});