// src/app/tfd/components/patients/patient-move-from-archive/patient-move-from-archive.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientMoveFromArchiveComponent,
  PatientMoveFromArchiveDialogData,
} from './patient-move-from-archive.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientMoveFromArchiveComponent', () => {
  let component: PatientMoveFromArchiveComponent;
  let fixture: ComponentFixture<PatientMoveFromArchiveComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    movePatientFromArchive: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientMoveFromArchiveDialogData | null;

  const baseDialogData: PatientMoveFromArchiveDialogData = {
    patient_care: {
      id: 105,
      patient: {
        name: '  Maria Fernanda  ',
      },
    } as unknown as PatientCare,
  };

  async function createComponent(
    dialogData: PatientMoveFromArchiveDialogData | null = {
      patient_care: {
        ...baseDialogData.patient_care,
        patient: { ...baseDialogData.patient_care?.patient },
      } as unknown as PatientCare,
    }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientMoveFromArchiveComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientMoveFromArchiveComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientMoveFromArchiveComponent);
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
      movePatientFromArchive: vi.fn(),
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
    expect(component['patientName']).toBe('Maria Fernanda');
  });

  it('deve retornar "Paciente" quando patient.name estiver ausente ou em branco', async () => {
    await createComponent({
      patient_care: { id: 105, patient: { name: '   ' } } as unknown as PatientCare,
    });
    expect(component['patientName']).toBe('Paciente');

    await createComponent(null);
    expect(component['patientName']).toBe('Paciente');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Desalocação do Arquivo (onSubmit)', () => {
    it('deve exibir mensagem e não chamar movePatientFromArchive quando patient_care.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do atendimento inválido.'
      );
      expect(patientServiceMock.movePatientFromArchive).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, notificar canal, exibir mensagem e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.movePatientFromArchive.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.movePatientFromArchive).toHaveBeenCalledWith(105);

      pending$.next({ message: 'Desalocado com sucesso!' });
      pending$.complete();
      fixture.detectChanges();

      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Desalocado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientServiceMock.movePatientFromArchive.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Paciente desalocado do arquivo com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientServiceMock.movePatientFromArchive.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Atendimento não está arquivado.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Atendimento não está arquivado.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientServiceMock.movePatientFromArchive.mockReturnValueOnce(
        throwError(() => new Error('Falha inesperada'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar desalocar o paciente do arquivo.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});