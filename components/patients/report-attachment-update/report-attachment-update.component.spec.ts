// src/app/tfd/components/patients/report-attachment-update/report-attachment-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { saveAs } from 'file-saver';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ReportAttachmentUpdateComponent,
  ReportAttachmentUpdateDialogData,
} from './report-attachment-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { ReportAttachment } from '../../../models/report-attachment.model';
import { PatientService } from '../../../services/patient.service';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('ReportAttachmentUpdateComponent', () => {
  let component: ReportAttachmentUpdateComponent;
  let fixture: ComponentFixture<ReportAttachmentUpdateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    updateReportAttachment: ReturnType<typeof vi.fn>;
  };
  let storageServiceMock: {
    download: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: ReportAttachmentUpdateDialogData = {
    patient_care: { id: 50 } as unknown as PatientCare,
    patient_report: { id: 21 } as unknown as PatientReport,
    report_attachment: { id: 7, name: 'Exame Inicial' } as unknown as ReportAttachment,
  };

  async function createComponent(
    dialogData: ReportAttachmentUpdateDialogData | null = {
      patient_care: { ...baseDialogData.patient_care } as unknown as PatientCare,
      patient_report: { ...baseDialogData.patient_report } as unknown as PatientReport,
      report_attachment: { ...baseDialogData.report_attachment } as unknown as ReportAttachment,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ReportAttachmentUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(ReportAttachmentUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReportAttachmentUpdateComponent);
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
      updateReportAttachment: vi.fn().mockReturnValue(of({ message: 'Anexo atualizado!' })),
    };

    storageServiceMock = {
      download: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e inicializar formulário e estados', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isDownloading']()).toBe(false);
    expect(component['selectedFile']()).toBeNull();
    expect(component['hasFile']()).toBe(false);
    expect(component['fileLabel']()).toBe('Nenhum arquivo selecionado');
    expect(component['attachmentForm'].controls.name.value).toBe('Exame Inicial');
    expect(component['isFormPristine']()).toBe(true);
    expect(component['isFormInvalidOrPending']).toBe(false);
  });

  it('deve inicializar nome vazio quando report_attachment ou data for nulo', async () => {
    await createComponent(null);
    expect(component['attachmentForm'].controls.name.value).toBe('');
    expect(component['isFormInvalidOrPending']).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Seleção de Arquivo (onFileSelected)', () => {
    function buildFileEvent(file: File | null, value = 'C:\\fake\\anexo.pdf'): {
      event: Event;
      input: { files: FileList | null; value: string };
    } {
      const input = {
        files: file ? ([file] as unknown as FileList) : null,
        value,
      };
      return {
        event: { target: input } as unknown as Event,
        input,
      };
    }

    it('deve ignorar quando nenhum arquivo for selecionado', () => {
      const { event, input } = buildFileEvent(null, 'algum.pdf');
      component['onFileSelected'](event);

      expect(component['selectedFile']()).toBeNull();
      expect(component['hasFile']()).toBe(false);
      expect(component['isFormPristine']()).toBe(true);
      expect(input.value).toBe('algum.pdf');
    });

    it('deve selecionar arquivo, marcar dirty e manter name existente', () => {
      const file = new File(['conteudo'], 'novo_exame.pdf', { type: 'application/pdf' });
      const { event, input } = buildFileEvent(file);

      component['onFileSelected'](event);

      expect(component['selectedFile']()).toBe(file);
      expect(component['hasFile']()).toBe(true);
      expect(component['fileLabel']()).toBe('novo_exame.pdf');
      expect(component['attachmentForm'].controls.name.value).toBe('Exame Inicial');
      expect(component['isFormPristine']()).toBe(false);
      expect(input.value).toBe('');
    });

    it('deve preencher nome sem extensão (ou completo sem ponto) quando name estiver vazio', async () => {
      await createComponent({
        patient_care: { id: 50 } as unknown as PatientCare,
        patient_report: { id: 21 } as unknown as PatientReport,
        report_attachment: { id: 7, name: '' } as unknown as ReportAttachment,
      });

      const dotFile = new File(['a'], 'laudo.final.pdf');
      component['onFileSelected'](buildFileEvent(dotFile).event);
      expect(component['attachmentForm'].controls.name.value).toBe('laudo.final');

      component['attachmentForm'].controls.name.setValue('   ');
      const noDotFile = new File(['b'], 'arquivo_simples');
      component['onFileSelected'](buildFileEvent(noDotFile).event);
      expect(component['attachmentForm'].controls.name.value).toBe('arquivo_simples');
    });
  });

  describe('Download de Anexo (download)', () => {
    it('deve ignorar quando archiveId for inválido ou já estiver baixando', () => {
      component['download'](null, 'doc.pdf');
      component['download'](undefined, 'doc.pdf');
      component['download'](0, 'doc.pdf');
      expect(storageServiceMock.download).not.toHaveBeenCalled();

      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValueOnce(pending$.asObservable());

      component['download'](12, 'exame.pdf');
      expect(component['isDownloading']()).toBe(true);

      component['download'](12, 'exame.pdf');
      expect(storageServiceMock.download).toHaveBeenCalledTimes(1);

      pending$.complete();
      expect(component['isDownloading']()).toBe(false);
    });

    it('deve gerenciar isDownloading e chamar saveAs com nome informado ou fallback', () => {
      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValueOnce(pending$.asObservable());

      component['download'](25, 'resultado.pdf');
      expect(component['isDownloading']()).toBe(true);
      expect(storageServiceMock.download).toHaveBeenCalledWith('tfd', 25);

      const blob = new Blob(['pdf']);
      pending$.next({ archive: blob });
      pending$.complete();

      expect(saveAs).toHaveBeenCalledWith(blob, 'resultado.pdf');
      expect(component['isDownloading']()).toBe(false);

      const fallbackBlob = new Blob(['txt']);
      storageServiceMock.download.mockReturnValueOnce(of({ archive: fallbackBlob }));
      component['download'](26);
      expect(saveAs).toHaveBeenCalledWith(fallbackBlob, 'anexo-26');

      storageServiceMock.download.mockReturnValueOnce(of({}));
      component['download'](27, 'sem-arquivo.pdf');
      expect(saveAs).toHaveBeenCalledTimes(2);
    });

    it('deve exibir mensagem de erro da API ou fallback em caso de falha no download', () => {
      storageServiceMock.download.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Arquivo não encontrado.' } }))
      );
      component['download'](30, 'arq.pdf');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo não encontrado.');
      expect(component['isDownloading']()).toBe(false);

      storageServiceMock.download.mockReturnValueOnce(
        throwError(() => new Error('Falha de rede'))
      );
      component['download'](31, 'arq2.pdf');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao realizar o download do arquivo.'
      );
      expect(component['isDownloading']()).toBe(false);
    });
  });

  describe('Atualização do Anexo (onSubmit)', () => {
    it('deve exibir mensagem quando faltar ID de atendimento, laudo ou anexo', async () => {
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
      expect(patientServiceMock.updateReportAttachment).not.toHaveBeenCalled();
    });

    it('deve marcar controles como touched quando formulário for inválido', () => {
      component['attachmentForm'].controls.name.setValue('');
      component['onSubmit']();

      expect(component['attachmentForm'].controls.name.touched).toBe(true);
      expect(patientServiceMock.updateReportAttachment).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, enviar payload sem file quando não houver arquivo e notificar/fechar no sucesso', () => {
      component['attachmentForm'].controls.name.setValue('  Nome Atualizado  ');

      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.updateReportAttachment.mockReturnValueOnce(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['attachmentForm'].disabled).toBe(true);
      expect(patientServiceMock.updateReportAttachment).toHaveBeenCalledWith(50, 21, 7, {
        name: 'Nome Atualizado',
      });

      pending$.next({ message: 'Anexo salvo com sucesso!' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['attachmentForm'].enabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo salvo com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve incluir file no payload quando um arquivo for selecionado', () => {
      const file = new File(['conteudo'], 'novo.pdf');
      component['selectedFile'].set(file);
      component['attachmentForm'].controls.name.setValue('  Com Arquivo  ');

      component['onSubmit']();

      expect(patientServiceMock.updateReportAttachment).toHaveBeenCalledWith(50, 21, 7, {
        name: 'Com Arquivo',
        file,
      });
    });

    it('deve usar mensagem padrão de sucesso e tratar erros da API ou fallback', () => {
      patientServiceMock.updateReportAttachment.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      patientServiceMock.updateReportAttachment.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Permissão negada.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Permissão negada.');

      patientServiceMock.updateReportAttachment.mockReturnValueOnce(
        throwError(() => new Error('Erro inesperado'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao processar a atualização do anexo.'
      );
    });
  });
});