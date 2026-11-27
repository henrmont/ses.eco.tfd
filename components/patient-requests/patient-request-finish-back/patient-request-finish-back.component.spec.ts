// src/app/tfd/components/patient-requests/patient-request-finish-back/patient-request-finish-back.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestFinishBackComponent,
  PatientRequestFinishBackDialogData,
} from './patient-request-finish-back.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestFinishBackComponent', () => {
  let component: PatientRequestFinishBackComponent;
  let fixture: ComponentFixture<PatientRequestFinishBackComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    finishBackPatientRequest: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: PatientRequestFinishBackDialogData = {
    patient_request: {
      id: 55,
      back_to_owner: 'Retorno do request',
    } as unknown as PatientRequest,
    back_to_owner: 'Retorno do dialog',
  };

  async function createComponent(
    dialogData: PatientRequestFinishBackDialogData | null = {
      patient_request: {
        id: 55,
        back_to_owner: 'Retorno do request',
      } as unknown as PatientRequest,
      back_to_owner: 'Retorno do dialog',
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestFinishBackComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestFinishBackComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestFinishBackComponent);
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
      finishBackPatientRequest: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e priorizar back_to_owner de patient_request', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['backToOwner']()).toBe('Retorno do request');
  });

  it('deve usar data.back_to_owner ou fallback quando patient_request.back_to_owner estiver ausente', async () => {
    await createComponent({
      patient_request: { id: 55 } as unknown as PatientRequest,
      back_to_owner: 'Retorno do dialog',
    });
    expect(component['backToOwner']()).toBe('Retorno do dialog');

    await createComponent({
      patient_request: { id: 55 } as unknown as PatientRequest,
    });
    expect(component['backToOwner']()).toBe('Informação de retorno não disponível.');

    await createComponent(null);
    expect(component['backToOwner']()).toBe('Informação de retorno não disponível.');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Finalização do Retorno (onSubmit)', () => {
    it('deve exibir mensagem e não chamar finishBackPatientRequest quando patient_request.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da solicitação inválido.'
      );
      expect(patientRequestServiceMock.finishBackPatientRequest).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, exibir mensagem, notificar canal e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.finishBackPatientRequest.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientRequestServiceMock.finishBackPatientRequest).toHaveBeenCalledWith(55);

      pending$.next({ message: 'Retorno concluído!' });
      pending$.complete();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Retorno concluído!');
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientRequestServiceMock.finishBackPatientRequest.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Retorno da solicitação finalizado com sucesso!'
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientRequestServiceMock.finishBackPatientRequest.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Retorno já finalizado.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Retorno já finalizado.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientRequestServiceMock.finishBackPatientRequest.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar finalizar o retorno da solicitação.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});