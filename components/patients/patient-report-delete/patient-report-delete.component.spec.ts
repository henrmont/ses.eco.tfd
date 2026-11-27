// src/app/tfd/components/patients/patient-report-delete/patient-report-delete.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientReportDeleteComponent,
  PatientReportDeleteDialogData,
} from './patient-report-delete.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientReportDeleteComponent', () => {
  let component: PatientReportDeleteComponent;
  let fixture: ComponentFixture<PatientReportDeleteComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    deletePatientReport: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: PatientReportDeleteDialogData = {
    patient_care: {
      id: 42,
    } as unknown as PatientCare,
    patient_report: {
      id: 9,
      protocol: '  PROT-900  ',
    } as unknown as PatientReport,
  };

  async function createComponent(
    dialogData: PatientReportDeleteDialogData | null = {
      patient_care: { ...baseDialogData.patient_care } as unknown as PatientCare,
      patient_report: { ...baseDialogData.patient_report } as unknown as PatientReport,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientReportDeleteComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientReportDeleteComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientReportDeleteComponent);
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
      deletePatientReport: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e formatar reportProtocol', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['reportProtocol']).toBe('PROT-900');
  });

  it('deve usar "Sem protocolo" quando protocol estiver ausente ou em branco', async () => {
    await createComponent({
      patient_care: { id: 42 } as unknown as PatientCare,
      patient_report: { id: 9, protocol: '   ' } as unknown as PatientReport,
    });
    expect(component['reportProtocol']).toBe('Sem protocolo');

    await createComponent(null);
    expect(component['reportProtocol']).toBe('Sem protocolo');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Exclusão do Laudo (onSubmit)', () => {
    it('deve exibir mensagem e não chamar deletePatientReport quando faltarem IDs válidos', async () => {
      await createComponent({
        patient_care: { id: 42 } as unknown as PatientCare,
        patient_report: undefined,
      });
      component['onSubmit']();

      await createComponent({
        patient_care: undefined,
        patient_report: { id: 9 } as unknown as PatientReport,
      });
      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificadores do atendimento ou do laudo inválidos.'
      );
      expect(patientServiceMock.deletePatientReport).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, notificar canal, exibir mensagem e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.deletePatientReport.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.deletePatientReport).toHaveBeenCalledWith(42, 9);

      pending$.next({ message: 'Laudo excluído!' });
      pending$.complete();
      fixture.detectChanges();

      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo excluído!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientServiceMock.deletePatientReport.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo removido com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientServiceMock.deletePatientReport.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Laudo vinculado a viagem.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo vinculado a viagem.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientServiceMock.deletePatientReport.mockReturnValueOnce(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Ocorreu um erro ao tentar remover o laudo.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});