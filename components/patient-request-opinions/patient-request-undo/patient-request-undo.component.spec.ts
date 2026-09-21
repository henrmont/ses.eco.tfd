import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { UndoPatientRequestComponent } from './undo-patient-request-component';
import { OpinionService } from '../../../services/opinion-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UndoPatientRequestComponent', () => {
  let component: UndoPatientRequestComponent;
  let fixture: ComponentFixture<UndoPatientRequestComponent>;

  let opinionServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    type: 'social',
    patient_request: {
      id: 550,
      owner_professional: { name: 'Dr. Roberto Cruz' },
      medical_professional: { name: 'Dr. Adalberto Silva' }
    }
  };

  beforeEach(async () => {
    opinionServiceMock = {
      undoPatientRequest: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    // Resposta padrão da Stream de devolução
    opinionServiceMock.undoPatientRequest.mockReturnValue(of({ message: 'Solicitação devolvida com sucesso!' }));

    await TestBed.configureTestingModule({
      imports: [
        UndoPatientRequestComponent
      ],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: OpinionService, useValue: opinionServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ChangeDetectorRef
      ]
    })
    .overrideComponent(UndoPatientRequestComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UndoPatientRequestComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário reativo com campos vazios', () => {
    fixture.detectChanges();
    
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['tramitPatientRequestForm']).toBeTruthy();

    const formValues = component['tramitPatientRequestForm'].value;
    expect(formValues.reason).toBeNull();
    expect(formValues.to).toBeNull();
  });

  describe('Fluxo de Submissão e Retorno do Pedido (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();

      // Limpa validações para isolamento perfeito de testes de submissão
      const tramitForm = component['tramitPatientRequestForm'];
      Object.keys(tramitForm.controls).forEach(key => {
        const control = tramitForm.get(key);
        control?.clearValidators();
        control?.clearAsyncValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      Object.defineProperty(tramitForm, 'invalid', { get: () => !tramitForm.valid, configurable: true });
      Object.defineProperty(tramitForm, 'valid', { get: () => !tramitForm.errors, configurable: true });
    });

    it('deve barrar a submissão marcando controles como touched se o formulário estiver inválido', () => {
      component['tramitPatientRequestForm'].setErrors({ required: true });

      component['onSubmit']();
      
      expect(component['tramitPatientRequestForm'].touched).toBe(true);
      expect(opinionServiceMock.undoPatientRequest).not.toHaveBeenCalled();
    });

    it('deve barrar a submissão e exibir alerta se o ID da solicitação do paciente não existir nos dados da modal', () => {
      component['data'].patient_request.id = null;

      component['onSubmit']();
      
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
      expect(opinionServiceMock.undoPatientRequest).not.toHaveBeenCalled();
    });

    it('deve retornar/desfazer a solicitação com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['data'].patient_request.id = 550;
      
      component['tramitPatientRequestForm'].patchValue({
        to: 'owner',
        reason: 'Necessita de correções no relatório inicial.'
      });

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false); 
      expect(opinionServiceMock.undoPatientRequest).toHaveBeenCalledWith(
        550,
        component['tramitPatientRequestForm'].getRawValue()
      );
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação devolvida com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve lidar amigavelmente com falhas estruturadas do backend ao tentar retornar', () => {
      component['data'].patient_request.id = 550;
      component['tramitPatientRequestForm'].patchValue({ to: 'owner', reason: 'Erro de teste.' });
      
      const mockApiError = { error: { message: 'Não é possível retornar uma solicitação já finalizada.' } };
      opinionServiceMock.undoPatientRequest.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Não é possível retornar uma solicitação já finalizada.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Cobertura de Branches de Exceção e Casos de Borda', () => {
    it('deve exibir mensagem genérica de erro caso o servidor falhe no onSubmit sem retornar uma mensagem estruturada', () => {
      fixture.detectChanges();
      
      const tramitForm = component['tramitPatientRequestForm'];
      Object.defineProperty(tramitForm, 'invalid', { get: () => false, configurable: true });

      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      opinionServiceMock.undoPatientRequest.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao tentar desfazer/devolver a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });
});