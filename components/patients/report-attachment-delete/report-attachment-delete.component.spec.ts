// src/app/tfd/components/patients/report-attachment-delete/report-attachment-delete.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ReportAttachmentDeleteComponent,
  ReportAttachmentDeleteDialogData,
} from './report-attachment-delete.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { ReportAttachment } from '../../../models/report-attachment.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('ReportAttachmentDeleteComponent', () => {
  let component: ReportAttachmentDeleteComponent;
  let fixture: ComponentFixture<ReportAttachmentDeleteComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    deleteReportAttachment: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: ReportAttachmentDeleteDialogData = {
    patient_care: { id: 50 } as unknown as PatientCare,
    patient_report: { id: 21 } as unknown as PatientReport,
    report_attachment: { id: 7, name: 'Exame de Sangue' } as unknown as ReportAttachment,
  };

  async function createComponent(
    dialogData: ReportAttachmentDeleteDialogData | null = {
      patient_care: { ...baseDialogData.patient_care } as unknown as PatientCare,
      patient_report: { ...baseDialogData.patient_report } as unknown as PatientReport,
      report_attachment: { ...baseDialogData.report_attachment } as unknown as ReportAttachment,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ReportAttachmentDeleteComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(ReportAttachmentDeleteComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReportAttachmentDeleteComponent);
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
      deleteReportAttachment: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e expor attachmentName', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['attachmentName']()).toBe('Exame de Sangue');
  });

  it('deve usar "Sem nome" em attachmentName quando report_attachment ou name estiver ausente', async () => {
    await createComponent({
      patient_care: { id: 50 } as unknown as PatientCare,
      patient_report: { id: 21 } as unknown as PatientReport,
      report_attachment: { id: 7 } as unknown as ReportAttachment,
    });
    expect(component['attachmentName']()).toBe('Sem nome');

    await createComponent(null);
    expect(component['attachmentName']()).toBe('Sem nome');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Exclusão do Anexo (onSubmit)', () => {
    it('deve exibir mensagem e não chamar deleteReportAttachment quando faltar algum ID', async () => {
      await createComponent({
        patient_care: undefined,
        patient_report: { id: 21 } as unknown as PatientReport,
        report_attachment: { id: 7 } as unknown as ReportAttachment,
      });
      component['onSubmit']();

      await createComponent({
        patient_care: { id: 50 } as unknown as PatientCare,
        patient_report: undefined,
        report_attachment: { id: 7 } as unknown as ReportAttachment,
      });
      component['onSubmit']();

      await createComponent({
        patient_care: { id: 50 } as unknown as PatientCare,
        patient_report: { id: 21 } as unknown as PatientReport,
        report_attachment: undefined,
      });
      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificadores do atendimento, laudo ou anexo não encontrados.'
      );
      expect(patientServiceMock.deleteReportAttachment).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, notificar canal, exibir mensagem e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.deleteReportAttachment.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.deleteReportAttachment).toHaveBeenCalledWith(50, 21, 7);

      pending$.next({ message: 'Anexo excluído!' });
      pending$.complete();
      fixture.detectChanges();

      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo excluído!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando response não trouxer message', () => {
      patientServiceMock.deleteReportAttachment.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo removido com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API ou fallback e não fechar dialog em caso de falha', () => {
      patientServiceMock.deleteReportAttachment.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Anexo em uso.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo em uso.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);

      patientServiceMock.deleteReportAttachment.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Ocorreu um erro ao tentar remover o anexo.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});