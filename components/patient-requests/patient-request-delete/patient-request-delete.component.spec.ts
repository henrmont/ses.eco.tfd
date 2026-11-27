// src/app/tfd/components/patient-requests/patient-request-delete/patient-request-delete.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestDeleteComponent,
  PatientRequestDeleteDialogData,
} from './patient-request-delete.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestDeleteComponent', () => {
  let component: PatientRequestDeleteComponent;
  let fixture: ComponentFixture<PatientRequestDeleteComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    deletePatientRequest: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: PatientRequestDeleteDialogData = {
    patient_request: {
      id: 44,
      report: {
        patient_care: {
          patient: {
            name: 'Carlos Pereira',
          },
        },
      },
    } as unknown as PatientRequest,
  };

  async function createComponent(
    dialogData: PatientRequestDeleteDialogData | null = {
      patient_request: {
        id: 44,
        report: {
          patient_care: {
            patient: {
              name: 'Carlos Pereira',
            },
          },
        },
      } as unknown as PatientRequest,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestDeleteComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestDeleteComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestDeleteComponent);
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
      deletePatientRequest: vi.fn(),
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
    expect(component['patientName']()).toBe('Carlos Pereira');
  });

  it('deve retornar "Não informado" em patientName quando dados do paciente estiverem ausentes', async () => {
    await createComponent({
      patient_request: { id: 44 } as unknown as PatientRequest,
    });
    expect(component['patientName']()).toBe('Não informado');

    await createComponent(null);
    expect(component['patientName']()).toBe('Não informado');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Remoção da Solicitação (onSubmit)', () => {
    it('deve exibir mensagem e não chamar deletePatientRequest quando patient_request.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da solicitação não encontrado.'
      );
      expect(patientRequestServiceMock.deletePatientRequest).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, exibir mensagem, notificar canal e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.deletePatientRequest.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientRequestServiceMock.deletePatientRequest).toHaveBeenCalledWith(44);

      pending$.next({ message: 'Solicitação excluída!' });
      pending$.complete();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação excluída!');
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientRequestServiceMock.deletePatientRequest.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Solicitação removida com sucesso!'
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientRequestServiceMock.deletePatientRequest.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Solicitação em andamento.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação em andamento.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientRequestServiceMock.deletePatientRequest.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Ocorreu um erro ao tentar remover a solicitação.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});