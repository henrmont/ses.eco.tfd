// src/app/tfd/components/patients/report-attachments/report-attachments.component.spec.ts
import { Overlay } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { saveAs } from 'file-saver';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ReportAttachmentDialogData,
  ReportAttachmentsComponent,
} from './report-attachments.component';
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { ReportAttachment } from '../../../models/report-attachment.model';
import { PatientService } from '../../../services/patient.service';
import { ReportAttachmentCreateComponent } from '../report-attachment-create/report-attachment-create.component';
import { ReportAttachmentDeleteComponent } from '../report-attachment-delete/report-attachment-delete.component';
import { ReportAttachmentUpdateComponent } from '../report-attachment-update/report-attachment-update.component';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
}

describe('ReportAttachmentsComponent', () => {
  let component: ReportAttachmentsComponent;
  let fixture: ComponentFixture<ReportAttachmentsComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    getReportAttachments: ReturnType<typeof vi.fn>;
  };
  let storageServiceMock: {
    download: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogMock: {
    open: ReturnType<typeof vi.fn>;
  };
  let noopScrollStrategyMock: Record<string, never>;
  let overlayMock: {
    scrollStrategies: { noop: ReturnType<typeof vi.fn> };
  };

  const sampleAttachment: ReportAttachment = {
    id: 14,
    name: 'Exame de Imagem',
    archive_id: 91,
  } as unknown as ReportAttachment;

  const baseDialogData: ReportAttachmentDialogData = {
    patient_care: { id: 50 } as unknown as PatientCare,
    patient_report: { id: 21 } as unknown as PatientReport,
  };

  async function createComponent(
    dialogData: ReportAttachmentDialogData | null = {
      patient_care: { ...baseDialogData.patient_care } as unknown as PatientCare,
      patient_report: { ...baseDialogData.patient_report } as unknown as PatientReport,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ReportAttachmentsComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: Overlay, useValue: overlayMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(ReportAttachmentsComponent, {
        set: {
          template: '',
          providers: [{ provide: MatDialog, useValue: dialogMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReportAttachmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.mocked(saveAs).mockClear();

    broadcastChannelMock = new MockBroadcastChannel();
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return broadcastChannelMock;
      })
    );

    patientServiceMock = {
      getReportAttachments: vi.fn().mockReturnValue(of([sampleAttachment])),
    };

    storageServiceMock = {
      download: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    noopScrollStrategyMock = {};
    overlayMock = {
      scrollStrategies: {
        noop: vi.fn(() => noopScrollStrategyMock),
      },
    };

    dialogMock = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(false),
      }),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e carregar os anexos do laudo', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(patientServiceMock.getReportAttachments).toHaveBeenCalledWith(50, 21);
    expect(component['isLoading']()).toBe(false);
    expect(component['downloadingArchiveId']()).toBeNull();
    expect(component['dataSource'].data).toEqual([sampleAttachment]);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve lidar com ausência de IDs e com erro no getReportAttachments', async () => {
    patientServiceMock.getReportAttachments.mockClear();
    await createComponent(null);
    expect(patientServiceMock.getReportAttachments).not.toHaveBeenCalled();
    expect(component['isLoading']()).toBe(false);

    patientServiceMock.getReportAttachments.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Falha ao listar anexos.' } }))
    );
    await createComponent({
      patient_care: { id: 50 } as unknown as PatientCare,
      patient_report: { id: 22 } as unknown as PatientReport,
    });
    expect(component['dataSource'].data).toEqual([]);
    expect(component['isLoading']()).toBe(false);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Falha ao listar anexos.');

    patientServiceMock.getReportAttachments.mockReturnValueOnce(
      throwError(() => new Error('Erro de rede'))
    );
    await createComponent({
      patient_care: { id: 50 } as unknown as PatientCare,
      patient_report: { id: 23 } as unknown as PatientReport,
    });
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Não foi possível carregar os anexos do laudo.'
    );
  });

  it('deve atualizar a lista quando receber mensagem "update" no BroadcastChannel', () => {
    patientServiceMock.getReportAttachments.mockClear();
    const updatedList = [
      sampleAttachment,
      { id: 15, name: 'Novo Laudo', archive_id: 92 } as unknown as ReportAttachment,
    ];
    patientServiceMock.getReportAttachments.mockReturnValueOnce(of(updatedList));

    broadcastChannelMock.onmessage?.({ data: 'outro' } as MessageEvent<string>);
    expect(patientServiceMock.getReportAttachments).not.toHaveBeenCalled();

    broadcastChannelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(patientServiceMock.getReportAttachments).toHaveBeenCalledWith(50, 21);
    expect(component['dataSource'].data).toEqual(updatedList);
  });

  describe('Download de Anexo (download)', () => {
    it('deve ignorar quando archiveId for inválido ou já estiver em download', () => {
      component['download'](null, 'arq.pdf');
      component['download'](undefined, 'arq.pdf');
      component['download'](0, 'arq.pdf');
      expect(storageServiceMock.download).not.toHaveBeenCalled();

      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValueOnce(pending$.asObservable());

      component['download'](91, 'Exame');
      expect(component['downloadingArchiveId']()).toBe(91);

      component['download'](91, 'Exame');
      expect(storageServiceMock.download).toHaveBeenCalledTimes(1);

      pending$.complete();
      expect(component['downloadingArchiveId']()).toBeNull();
    });

    it('deve gerenciar downloadingArchiveId e chamar saveAs com nome trimado ou fallback', () => {
      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValueOnce(pending$.asObservable());

      component['download'](91, '  Exame de Sangue  ');
      expect(component['downloadingArchiveId']()).toBe(91);
      expect(storageServiceMock.download).toHaveBeenCalledWith('tfd', 91);

      const blob = new Blob(['pdf']);
      pending$.next({ archive: blob });
      pending$.complete();

      expect(saveAs).toHaveBeenCalledWith(blob, 'Exame de Sangue');
      expect(component['downloadingArchiveId']()).toBeNull();

      const fallbackBlob = new Blob(['txt']);
      storageServiceMock.download.mockReturnValueOnce(of({ archive: fallbackBlob }));
      component['download'](92, '   ');
      expect(saveAs).toHaveBeenCalledWith(fallbackBlob, 'anexo-92');

      storageServiceMock.download.mockReturnValueOnce(of({}));
      component['download'](93, 'Sem Arquivo');
      expect(saveAs).toHaveBeenCalledTimes(2);
    });

    it('deve exibir mensagem de erro da API ou fallback em caso de falha no download', () => {
      storageServiceMock.download.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Arquivo indisponível.' } }))
      );
      component['download'](95, 'arq.pdf');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo indisponível.');
      expect(component['downloadingArchiveId']()).toBeNull();

      storageServiceMock.download.mockReturnValueOnce(
        throwError(() => new Error('Erro inesperado'))
      );
      component['download'](96, 'arq2.pdf');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao realizar o download do arquivo.'
      );
      expect(component['downloadingArchiveId']()).toBeNull();
    });
  });

  describe('Ações de Diálogos', () => {
    it('deve abrir diálogos de criação, edição e exclusão e atualizar lista/canal apenas quando confirmado', () => {
      const pendingRefresh$ = new Subject<ReportAttachment[]>();
      patientServiceMock.getReportAttachments.mockReturnValueOnce(pendingRefresh$.asObservable());
      dialogMock.open.mockReturnValueOnce({ afterClosed: () => of(true) });

      component['reportAttachmentCreate']();
      expect(dialogMock.open).toHaveBeenCalledWith(
        ReportAttachmentCreateComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: noopScrollStrategyMock,
          data: {
            patient_care: baseDialogData.patient_care,
            patient_report: baseDialogData.patient_report,
          },
        })
      );
      expect(component['isLoading']()).toBe(false);

      pendingRefresh$.next([sampleAttachment]);
      pendingRefresh$.complete();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');

      dialogMock.open.mockReturnValueOnce({ afterClosed: () => of(false) });
      component['reportAttachmentUpdate'](sampleAttachment);
      expect(dialogMock.open).toHaveBeenCalledWith(
        ReportAttachmentUpdateComponent,
        expect.objectContaining({
          width: '400px',
          data: {
            patient_care: baseDialogData.patient_care,
            patient_report: baseDialogData.patient_report,
            report_attachment: sampleAttachment,
          },
        })
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledTimes(1);

      dialogMock.open.mockReturnValueOnce({ afterClosed: () => of(true) });
      component['reportAttachmentDelete'](sampleAttachment);
      expect(dialogMock.open).toHaveBeenCalledWith(
        ReportAttachmentDeleteComponent,
        expect.objectContaining({
          width: '400px',
          data: {
            patient_care: baseDialogData.patient_care,
            patient_report: baseDialogData.patient_report,
            report_attachment: sampleAttachment,
          },
        })
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledTimes(2);
    });
  });
});