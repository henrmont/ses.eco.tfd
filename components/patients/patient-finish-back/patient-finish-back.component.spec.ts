// src/app/tfd/components/patients/patient-finish-back/patient-finish-back.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientFinishBackComponent,
  PatientFinishBackDialogData,
} from './patient-finish-back.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientFinishBackComponent', () => {
  let component: PatientFinishBackComponent;
  let fixture: ComponentFixture<PatientFinishBackComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    finishBackPatient: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientFinishBackDialogData | null;

  const baseDialogData: PatientFinishBackDialogData = {
    patient_care: {
      id: 88,
      back_to_user: '  Dr. Carlos Eduardo  ',
    } as unknown as PatientCare,
    back_to_user: 'Usuário Fallback',
  };

  async function createComponent(
    dialogData: PatientFinishBackDialogData | null = {
      patient_care: { ...baseDialogData.patient_care } as unknown as PatientCare,
      back_to_user: baseDialogData.back_to_user,
    }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientFinishBackComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientFinishBackComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientFinishBackComponent);
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
      finishBackPatient: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e priorizar back_to_user de patient_care', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['backToUser']).toBe('Dr. Carlos Eduardo');
  });

  it('deve usar back_to_user do dialogData quando patient_care.back_to_user estiver ausente ou retornar mensagem padrão', async () => {
    await createComponent({
      patient_care: { id: 88 } as unknown as PatientCare,
      back_to_user: '  Enfermeira Helena  ',
    });
    expect(component['backToUser']).toBe('Enfermeira Helena');

    await createComponent({
      patient_care: { id: 88, back_to_user: '   ' } as unknown as PatientCare,
      back_to_user: '   ',
    });
    expect(component['backToUser']).toBe('Informação de retorno não disponível.');

    await createComponent(null);
    expect(component['backToUser']).toBe('Informação de retorno não disponível.');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Finalização do Retorno (onSubmit)', () => {
    it('deve exibir mensagem e não chamar finishBackPatient quando patient_care.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do atendimento inválido.'
      );
      expect(patientServiceMock.finishBackPatient).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, notificar canal, exibir mensagem e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.finishBackPatient.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.finishBackPatient).toHaveBeenCalledWith(88);

      pending$.next({ message: 'Retorno concluído!' });
      pending$.complete();
      fixture.detectChanges();

      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Retorno concluído!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientServiceMock.finishBackPatient.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Retorno do paciente finalizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientServiceMock.finishBackPatient.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Retorno já finalizado.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Retorno já finalizado.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientServiceMock.finishBackPatient.mockReturnValueOnce(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao tentar finalizar o retorno do paciente.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});