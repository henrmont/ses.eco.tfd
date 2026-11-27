// src/app/tfd/components/patient-requests/patient-request-move-from-others/patient-request-move-from-others.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestMoveFromOthersComponent,
  PatientRequestMoveFromOthersDialogData,
} from './patient-request-move-from-others.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestMoveFromOthersComponent', () => {
  let component: PatientRequestMoveFromOthersComponent;
  let fixture: ComponentFixture<PatientRequestMoveFromOthersComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    movePatientRequestFromOthers: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: PatientRequestMoveFromOthersDialogData = {
    patient_request: {
      id: 88,
      report: {
        patient_care: {
          patient: {
            name: 'Rafael Costa',
          },
        },
      },
    } as unknown as PatientRequest,
  };

  async function createComponent(
    dialogData: PatientRequestMoveFromOthersDialogData | null = {
      patient_request: {
        id: 88,
        report: {
          patient_care: {
            patient: {
              name: 'Rafael Costa',
            },
          },
        },
      } as unknown as PatientRequest,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestMoveFromOthersComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestMoveFromOthersComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestMoveFromOthersComponent);
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
      movePatientRequestFromOthers: vi.fn(),
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
    expect(component['patientName']()).toBe('Rafael Costa');
  });

  it('deve retornar "Não informado" em patientName quando dados do paciente estiverem ausentes', async () => {
    await createComponent({
      patient_request: { id: 88 } as unknown as PatientRequest,
    });
    expect(component['patientName']()).toBe('Não informado');

    await createComponent(null);
    expect(component['patientName']()).toBe('Não informado');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Movimentação da Solicitação (onSubmit)', () => {
    it('deve exibir mensagem e não chamar movePatientRequestFromOthers quando patient_request.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da solicitação inválido.'
      );
      expect(patientRequestServiceMock.movePatientRequestFromOthers).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, exibir mensagem, notificar canal e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.movePatientRequestFromOthers.mockReturnValue(
        pending$.asObservable()
      );

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientRequestServiceMock.movePatientRequestFromOthers).toHaveBeenCalledWith(88);

      pending$.next({ message: 'Solicitação assumida!' });
      pending$.complete();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação assumida!');
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientRequestServiceMock.movePatientRequestFromOthers.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Solicitação movimentada com sucesso!'
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientRequestServiceMock.movePatientRequestFromOthers.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Solicitação indisponível.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação indisponível.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientRequestServiceMock.movePatientRequestFromOthers.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
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