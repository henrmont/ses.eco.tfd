// src/app/tfd/components/patients/patient-escort-delete/patient-escort-delete.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientEscortDeleteComponent,
  PatientEscortDeleteDialogData,
} from './patient-escort-delete.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientEscortDeleteComponent', () => {
  let component: PatientEscortDeleteComponent;
  let fixture: ComponentFixture<PatientEscortDeleteComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    deletePatientEscort: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientEscortDeleteDialogData | null;

  const baseDialogData: PatientEscortDeleteDialogData = {
    patient_care: { id: 15 } as unknown as PatientCare,
    patient_escort: {
      id: 42,
      name: '  Rafael Mendes  ',
      pivot: { id: 88 },
    } as unknown as PatientEscort,
  };

  async function createComponent(
    dialogData: PatientEscortDeleteDialogData | null = {
      ...baseDialogData,
      patient_escort: {
        ...baseDialogData.patient_escort,
        pivot: { id: 88 },
      } as unknown as PatientEscort,
    }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientEscortDeleteComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientEscortDeleteComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientEscortDeleteComponent);
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
      deletePatientEscort: vi.fn(),
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

  describe('Getter escortName', () => {
    it('deve retornar o nome do acompanhante sem espaços extras', () => {
      expect(component['escortName']).toBe('Rafael Mendes');
    });

    it('deve retornar "Acompanhante" quando o nome estiver ausente ou em branco', async () => {
      await createComponent({
        patient_care: { id: 15 } as unknown as PatientCare,
        patient_escort: { id: 42, name: '   ' } as unknown as PatientEscort,
      });
      expect(component['escortName']).toBe('Acompanhante');

      await createComponent({
        patient_care: { id: 15 } as unknown as PatientCare,
        patient_escort: { id: 42 } as unknown as PatientEscort,
      });
      expect(component['escortName']).toBe('Acompanhante');

      await createComponent(null);
      expect(component['escortName']).toBe('Acompanhante');
    });
  });

  describe('Remoção do Acompanhante (onSubmit)', () => {
    it('deve exibir mensagem de erro e não chamar deletePatientEscort quando identificadores estiverem ausentes', async () => {
      await createComponent({
        patient_care: undefined,
        patient_escort: { id: 42 } as unknown as PatientEscort,
      });
      component['onSubmit']();

      await createComponent({
        patient_care: { id: 15 } as unknown as PatientCare,
        patient_escort: {} as unknown as PatientEscort,
      });
      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledTimes(2);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificadores do atendimento ou do acompanhante inválidos.'
      );
      expect(patientServiceMock.deletePatientEscort).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve priorizar pivot.id quando disponível e usar id como fallback', async () => {
      patientServiceMock.deletePatientEscort.mockReturnValue(of({}));

      component['onSubmit']();
      expect(patientServiceMock.deletePatientEscort).toHaveBeenCalledWith(15, 88);

      await createComponent({
        patient_care: { id: 15 } as unknown as PatientCare,
        patient_escort: { id: 42, name: 'Rafael Mendes' } as unknown as PatientEscort,
      });
      patientServiceMock.deletePatientEscort.mockReturnValue(of({}));

      component['onSubmit']();
      expect(patientServiceMock.deletePatientEscort).toHaveBeenCalledWith(15, 42);
    });

    it('deve remover o acompanhante com sucesso, notificar o BroadcastChannel, exibir mensagem e fechar o dialog', () => {
      patientServiceMock.deletePatientEscort.mockReturnValue(
        of({ message: 'Acompanhante desvinculado!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(patientServiceMock.deletePatientEscort).toHaveBeenCalledWith(15, 88);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Acompanhante desvinculado!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      patientServiceMock.deletePatientEscort.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Acompanhante removido com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve manter isSubmitting true durante requisição pendente e reverter ao concluir', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.deletePatientEscort.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);

      pending$.next({ message: 'OK' });
      pending$.complete();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de erro da API e não notificar o BroadcastChannel em caso de falha', () => {
      patientServiceMock.deletePatientEscort.mockReturnValue(
        throwError(() => ({ error: { message: 'Acompanhante em viagem ativa.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Acompanhante em viagem ativa.'
      );
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      patientServiceMock.deletePatientEscort.mockReturnValue(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Ocorreu um erro ao tentar remover o acompanhante.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});