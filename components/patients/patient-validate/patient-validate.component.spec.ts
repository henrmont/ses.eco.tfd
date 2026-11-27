// src/app/tfd/components/patients/patient-validate/patient-validate.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientValidateComponent,
  PatientValidateDialogData,
} from './patient-validate.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientValidateComponent', () => {
  let component: PatientValidateComponent;
  let fixture: ComponentFixture<PatientValidateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    validatePatient: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientValidateDialogData | null;

  const baseDialogData: PatientValidateDialogData = {
    patient_care: {
      id: 120,
      is_valid: true,
      patient: {
        name: '  Beatriz Souza  ',
      },
    } as unknown as PatientCare,
  };

  async function createComponent(
    dialogData: PatientValidateDialogData | null = {
      patient_care: {
        ...baseDialogData.patient_care,
        patient: { ...baseDialogData.patient_care?.patient },
      } as unknown as PatientCare,
    }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientValidateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientValidateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientValidateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    broadcastChannelMock = new MockBroadcastChannel();
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return broadcastChannelMock;
      })
    );

    patientServiceMock = {
      validatePatient: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e expor isValid e patientName', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isValid']).toBe(true);
    expect(component['patientName']).toBe('Beatriz Souza');
  });

  it('deve refletir isValid falso e fallback de patientName quando ausentes ou em branco', async () => {
    await createComponent({
      patient_care: {
        id: 120,
        is_valid: false,
        patient: { name: '   ' },
      } as unknown as PatientCare,
    });
    expect(component['isValid']).toBe(false);
    expect(component['patientName']).toBe('Paciente');

    await createComponent(null);
    expect(component['isValid']).toBe(false);
    expect(component['patientName']).toBe('Paciente');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Validação do Atendimento (onSubmit)', () => {
    it('deve exibir mensagem e não chamar validatePatient quando patient_care.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do atendimento inválido.'
      );
      expect(patientServiceMock.validatePatient).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, notificar canal, exibir mensagem e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.validatePatient.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.validatePatient).toHaveBeenCalledWith(120);

      pending$.next({ message: 'Validação alterada!' });
      pending$.complete();
      fixture.detectChanges();

      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Validação alterada!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientServiceMock.validatePatient.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Status do atendimento atualizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientServiceMock.validatePatient.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Pendência nos requisitos do paciente.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Pendência nos requisitos do paciente.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientServiceMock.validatePatient.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar alterar a validação do atendimento.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});