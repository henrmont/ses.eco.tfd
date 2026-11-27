// src/app/tfd/components/patient-requests/patient-request-archive/patient-request-archive.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestArchiveComponent,
  PatientRequestArchiveDialogData,
} from './patient-request-archive.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestArchiveComponent', () => {
  let component: PatientRequestArchiveComponent;
  let fixture: ComponentFixture<PatientRequestArchiveComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    archivePatientRequest: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: PatientRequestArchiveDialogData = {
    patient_request: {
      id: 33,
      report: {
        patient_care: {
          patient: {
            name: 'Maria Oliveira',
          },
        },
      },
    } as unknown as PatientRequest,
  };

  async function createComponent(
    dialogData: PatientRequestArchiveDialogData | null = {
      patient_request: {
        id: 33,
        report: {
          patient_care: {
            patient: {
              name: 'Maria Oliveira',
            },
          },
        },
      } as unknown as PatientRequest,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestArchiveComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestArchiveComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestArchiveComponent);
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

    patientRequestServiceMock = {
      archivePatientRequest: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e expor patientName', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['patientName']()).toBe('Maria Oliveira');
  });

  it('deve retornar "Não informado" em patientName quando dados do paciente estiverem ausentes', async () => {
    await createComponent({
      patient_request: { id: 33 } as unknown as PatientRequest,
    });
    expect(component['patientName']()).toBe('Não informado');

    await createComponent(null);
    expect(component['patientName']()).toBe('Não informado');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Arquivamento da Solicitação (onSubmit)', () => {
    it('deve exibir mensagem e não chamar archivePatientRequest quando patient_request.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da solicitação inválido.'
      );
      expect(patientRequestServiceMock.archivePatientRequest).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, exibir mensagem, notificar canal e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.archivePatientRequest.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientRequestServiceMock.archivePatientRequest).toHaveBeenCalledWith(33);

      pending$.next({ message: 'Solicitação arquivada!' });
      pending$.complete();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação arquivada!');
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientRequestServiceMock.archivePatientRequest.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Solicitação arquivada com sucesso!'
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientRequestServiceMock.archivePatientRequest.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Solicitação já arquivada.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação já arquivada.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientRequestServiceMock.archivePatientRequest.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar arquivar a solicitação.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});