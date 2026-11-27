// src/app/tfd/components/patients/report-attachment-create/report-attachment-create.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ReportAttachmentCreateComponent,
  ReportAttachmentCreateDialogData,
} from './report-attachment-create.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('ReportAttachmentCreateComponent', () => {
  let component: ReportAttachmentCreateComponent;
  let fixture: ComponentFixture<ReportAttachmentCreateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    createReportAttachment: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const baseDialogData: ReportAttachmentCreateDialogData = {
    patient_care: { id: 50 } as unknown as PatientCare,
    patient_report: { id: 21 } as unknown as PatientReport,
  };

  async function createComponent(
    dialogData: ReportAttachmentCreateDialogData | null = {
      patient_care: { ...baseDialogData.patient_care } as unknown as PatientCare,
      patient_report: { ...baseDialogData.patient_report } as unknown as PatientReport,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ReportAttachmentCreateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(ReportAttachmentCreateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ReportAttachmentCreateComponent);
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
      createReportAttachment: vi.fn().mockReturnValue(of({ message: 'Anexo salvo!' })),
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

  it('deve criar o componente, abrir o BroadcastChannel e inicializar estado e formulário', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['selectedFile']()).toBeNull();
    expect(component['hasFile']()).toBe(false);
    expect(component['fileLabel']()).toBe('Nenhum arquivo selecionado');
    expect(component['isFormInvalidOrPending']).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Seleção de Arquivo (onFileSelected)', () => {
    function buildFileEvent(file: File | null, value = 'C:\\fake\\path.pdf'): {
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
      expect(input.value).toBe('algum.pdf');
    });

    it('deve definir arquivo, preencher nome sem extensão quando vazio e limpar input.value', () => {
      const pdfFile = new File(['conteudo'], 'exame.sangue.pdf', { type: 'application/pdf' });
      const { event, input } = buildFileEvent(pdfFile);

      component['onFileSelected'](event);

      expect(component['selectedFile']()).toBe(pdfFile);
      expect(component['hasFile']()).toBe(true);
      expect(component['fileLabel']()).toBe('exame.sangue.pdf');
      expect(component['attachmentForm'].controls.name.value).toBe('exame.sangue');
      expect(component['attachmentForm'].controls.name.dirty).toBe(true);
      expect(input.value).toBe('');
    });

    it('deve usar nome completo se não houver ponto e preservar name já informado', () => {
      const noExtFile = new File(['abc'], 'documento_sem_extensao');
      const first = buildFileEvent(noExtFile);
      component['onFileSelected'](first.event);
      expect(component['attachmentForm'].controls.name.value).toBe('documento_sem_extensao');

      component['attachmentForm'].controls.name.setValue('Nome Personalizado');
      const secondFile = new File(['xyz'], 'outro.pdf');
      const second = buildFileEvent(secondFile);
      component['onFileSelected'](second.event);

      expect(component['selectedFile']()).toBe(secondFile);
      expect(component['attachmentForm'].controls.name.value).toBe('Nome Personalizado');
    });
  });

  describe('Envio do Anexo (onSubmit)', () => {
    it('deve exibir mensagem quando patient_care.id ou patient_report.id estiverem ausentes', async () => {
      await createComponent({
        patient_care: { id: 50 } as unknown as PatientCare,
        patient_report: undefined,
      });
      component['onSubmit']();

      await createComponent({
        patient_care: undefined,
        patient_report: { id: 21 } as unknown as PatientReport,
      });
      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificadores do atendimento ou do laudo não encontrados.'
      );
      expect(patientServiceMock.createReportAttachment).not.toHaveBeenCalled();
    });

    it('deve marcar controles como touched e exibir mensagem quando faltar arquivo ou formulário inválido', () => {
      component['onSubmit']();
      expect(component['attachmentForm'].controls.name.touched).toBe(true);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'A seleção de um arquivo anexo é obrigatória.'
      );
      expect(patientServiceMock.createReportAttachment).not.toHaveBeenCalled();

      const file = new File(['data'], 'laudo.pdf');
      component['selectedFile'].set(file);
      component['attachmentForm'].controls.name.setValue('');
      component['onSubmit']();
      expect(patientServiceMock.createReportAttachment).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, enviar payload trimado, notificar canal e fechar dialog no sucesso', () => {
      const file = new File(['conteudo'], 'laudo.pdf', { type: 'application/pdf' });
      component['selectedFile'].set(file);
      component['attachmentForm'].controls.name.setValue('  Laudo Médico Final  ');

      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.createReportAttachment.mockReturnValueOnce(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['attachmentForm'].disabled).toBe(true);
      expect(patientServiceMock.createReportAttachment).toHaveBeenCalledWith(50, 21, {
        name: 'Laudo Médico Final',
        file,
      });

      pending$.next({ message: 'Anexo enviado!' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['attachmentForm'].enabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo enviado!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso e tratar erros da API ou fallback', () => {
      const file = new File(['conteudo'], 'exame.pdf');
      component['selectedFile'].set(file);
      component['attachmentForm'].controls.name.setValue('Exame');

      patientServiceMock.createReportAttachment.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo anexado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      patientServiceMock.createReportAttachment.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Formato de arquivo não suportado.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Formato de arquivo não suportado.'
      );

      patientServiceMock.createReportAttachment.mockReturnValueOnce(
        throwError(() => new Error('Falha de upload'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao processar o upload do anexo.'
      );
    });
  });
});