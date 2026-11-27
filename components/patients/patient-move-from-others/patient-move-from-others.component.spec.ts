// src/app/tfd/components/patients/patient-move-from-others/patient-move-from-others.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientMoveFromOthersComponent,
  PatientMoveFromOthersDialogData,
} from './patient-move-from-others.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientMoveFromOthersComponent', () => {
  let component: PatientMoveFromOthersComponent;
  let fixture: ComponentFixture<PatientMoveFromOthersComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    movePatientFromOthers: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientMoveFromOthersDialogData | null;

  const baseDialogData: PatientMoveFromOthersDialogData = {
    patient_care: {
      id: 112,
      patient: {
        name: '  João Pedro  ',
      },
    } as unknown as PatientCare,
  };

  async function createComponent(
    dialogData: PatientMoveFromOthersDialogData | null = {
      patient_care: {
        ...baseDialogData.patient_care,
        patient: { ...baseDialogData.patient_care?.patient },
      } as unknown as PatientCare,
    }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientMoveFromOthersComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientMoveFromOthersComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientMoveFromOthersComponent);
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
      movePatientFromOthers: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e formatar patientName', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['patientName']).toBe('João Pedro');
  });

  it('deve retornar "Paciente" quando patient.name estiver ausente ou em branco', async () => {
    await createComponent({
      patient_care: { id: 112, patient: { name: '   ' } } as unknown as PatientCare,
    });
    expect(component['patientName']).toBe('Paciente');

    await createComponent(null);
    expect(component['patientName']).toBe('Paciente');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Movimentação da Solicitação (onSubmit)', () => {
    it('deve exibir mensagem e não chamar movePatientFromOthers quando patient_care.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do atendimento inválido.'
      );
      expect(patientServiceMock.movePatientFromOthers).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, notificar canal, exibir mensagem e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.movePatientFromOthers.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.movePatientFromOthers).toHaveBeenCalledWith(112);

      pending$.next({ message: 'Solicitação movida!' });
      pending$.complete();
      fixture.detectChanges();

      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação movida!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientServiceMock.movePatientFromOthers.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Solicitação movimentada com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientServiceMock.movePatientFromOthers.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Solicitação já atribuída.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação já atribuída.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientServiceMock.movePatientFromOthers.mockReturnValueOnce(
        throwError(() => new Error('Falha de comunicação'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar movimentar a solicitação.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});