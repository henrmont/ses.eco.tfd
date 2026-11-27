// src/app/tfd/components/patient-requests/patient-request-halted/patient-request-halted.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestHaltedComponent,
  PatientRequestHaltedDialogData,
} from './patient-request-halted.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestHaltedComponent', () => {
  let component: PatientRequestHaltedComponent;
  let fixture: ComponentFixture<PatientRequestHaltedComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    haltedPatientRequest: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: PatientRequestHaltedDialogData = {
    patient_request: {
      id: 66,
      is_owner_bookmark: true,
      report: {
        patient_care: {
          patient: {
            name: 'Lucas Almeida',
          },
        },
      },
    } as unknown as PatientRequest,
  };

  async function createComponent(
    dialogData: PatientRequestHaltedDialogData | null = {
      patient_request: {
        id: 66,
        is_owner_bookmark: true,
        report: {
          patient_care: {
            patient: {
              name: 'Lucas Almeida',
            },
          },
        },
      } as unknown as PatientRequest,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestHaltedComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestHaltedComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestHaltedComponent);
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
      haltedPatientRequest: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e expor isMarkedHalted e patientName', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isMarkedHalted']()).toBe(true);
    expect(component['patientName']()).toBe('Lucas Almeida');
  });

  it('deve lidar com is_owner_bookmark falso/ausente e patientName ausente', async () => {
    await createComponent({
      patient_request: { id: 66, is_owner_bookmark: false } as unknown as PatientRequest,
    });
    expect(component['isMarkedHalted']()).toBe(false);
    expect(component['patientName']()).toBe('Não informado');

    await createComponent(null);
    expect(component['isMarkedHalted']()).toBe(false);
    expect(component['patientName']()).toBe('Não informado');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Paralisação da Solicitação (onSubmit)', () => {
    it('deve exibir mensagem e não chamar haltedPatientRequest quando patient_request.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da solicitação inválido.'
      );
      expect(patientRequestServiceMock.haltedPatientRequest).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, exibir mensagem, notificar canal e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.haltedPatientRequest.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientRequestServiceMock.haltedPatientRequest).toHaveBeenCalledWith(66);

      pending$.next({ message: 'Solicitação paralisada!' });
      pending$.complete();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação paralisada!');
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientRequestServiceMock.haltedPatientRequest.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Solicitação paralisada com sucesso!'
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientRequestServiceMock.haltedPatientRequest.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Solicitação já paralisada.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação já paralisada.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientRequestServiceMock.haltedPatientRequest.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar paralisar a solicitação.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});