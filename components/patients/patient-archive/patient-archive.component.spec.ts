// src/app/tfd/components/patient/patient-archive/patient-archive.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientArchiveComponent,
  PatientArchiveDialogData,
} from './patient-archive.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientArchiveComponent', () => {
  let component: PatientArchiveComponent;
  let fixture: ComponentFixture<PatientArchiveComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    archivePatient: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientArchiveDialogData | null;

  const basePatientCare: PatientCare = {
    id: 21,
    patient: {
      name: '  Mariana Souza  ',
    },
  } as unknown as PatientCare;

  async function createComponent(
    dialogData: PatientArchiveDialogData | null = { patient_care: { ...basePatientCare } }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientArchiveComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientArchiveComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientArchiveComponent);
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
      archivePatient: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e iniciar isSubmitting como false', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Getter patientName', () => {
    it('deve retornar o nome do paciente sem espaços extras', () => {
      expect(component['patientName']).toBe('Mariana Souza');
    });

    it('deve retornar "Paciente" quando o nome estiver ausente ou em branco', async () => {
      await createComponent({
        patient_care: { id: 21, patient: { name: '   ' } } as unknown as PatientCare,
      });
      expect(component['patientName']).toBe('Paciente');

      await createComponent({ patient_care: { id: 21 } as unknown as PatientCare });
      expect(component['patientName']).toBe('Paciente');

      await createComponent(null);
      expect(component['patientName']).toBe('Paciente');
    });
  });

  describe('Arquivamento do Atendimento (onSubmit)', () => {
    it('deve exibir mensagem de erro e não chamar archivePatient quando patientCareId estiver ausente', async () => {
      await createComponent({ patient_care: undefined });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do atendimento inválido.'
      );
      expect(patientServiceMock.archivePatient).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve arquivar o paciente com sucesso, notificar o BroadcastChannel, exibir mensagem e fechar o dialog', () => {
      patientServiceMock.archivePatient.mockReturnValue(
        of({ message: 'Atendimento arquivado!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(patientServiceMock.archivePatient).toHaveBeenCalledWith(21);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Atendimento arquivado!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      patientServiceMock.archivePatient.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Paciente arquivado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve manter isSubmitting true durante requisição pendente e reverter ao concluir', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.archivePatient.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);

      pending$.next({ message: 'OK' });
      pending$.complete();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de erro do backend e não notificar o BroadcastChannel em caso de falha', () => {
      patientServiceMock.archivePatient.mockReturnValue(
        throwError(() => ({ error: { message: 'Paciente possui solicitação aberta.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Paciente possui solicitação aberta.'
      );
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      patientServiceMock.archivePatient.mockReturnValue(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar arquivar o paciente.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});