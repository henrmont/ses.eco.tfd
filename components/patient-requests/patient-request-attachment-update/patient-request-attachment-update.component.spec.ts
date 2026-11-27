// src/app/tfd/components/patient-requests/patient-request-attachment-update/patient-request-attachment-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { saveAs } from 'file-saver';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestAttachmentUpdateComponent,
  PatientRequestAttachmentUpdateDialogData,
} from './patient-request-attachment-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestService } from '../../../services/patient-request.service';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestAttachmentUpdateComponent', () => {
  let component: PatientRequestAttachmentUpdateComponent;
  let fixture: ComponentFixture<PatientRequestAttachmentUpdateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    updatePatientRequestAttachment: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let storageServiceMock: {
    download: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const defaultDialogData: PatientRequestAttachmentUpdateDialogData = {
    patient_request_attachment: {
      id: 710,
      name: 'Relatório Médico',
      archive_id: 90,
    } as unknown as PatientRequestAttachment,
  };

  async function createComponent(
    dialogData: PatientRequestAttachmentUpdateDialogData | null = defaultDialogData
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestAttachmentUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestAttachmentUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestAttachmentUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.mocked(saveAs).mockReset();

    broadcastChannelMock = new MockBroadcastChannel();
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return broadcastChannelMock;
      })
    );

    patientRequestServiceMock = {
      updatePatientRequestAttachment: vi.fn().mockReturnValue(of({ message: 'Atualizado!' })),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    storageServiceMock = {
      download: vi.fn(),
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

  it('deve criar o componente, abrir BroadcastChannel, inicializar formulário e fechar ao destruir', async () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
    expect(component['attachmentForm'].controls.name.value).toBe('Relatório Médico');
    expect(component['isFormPristine']()).toBe(true);
    expect(component['hasFile']()).toBe(false);
    expect(component['fileLabel']()).toBe('Nenhum arquivo selecionado');

    await createComponent(null);
    expect(component['attachmentForm'].controls.name.value).toBe('');

    broadcastChannelMock.close.mockClear();
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Seleção de Arquivo (onFileSelected)', () => {
    it('deve ignorar evento sem arquivo e atualizar selectedFile/nome quando aplicável', () => {
      const emptyInput = { files: null, value: 'x.pdf' } as unknown as HTMLInputElement;
      component['onFileSelected']({ target: emptyInput } as unknown as Event);
      expect(component['hasFile']()).toBe(false);
      expect(emptyInput.value).toBe('x.pdf');

      const fileWithName = new File(['abc'], 'exame.novo.pdf', { type: 'application/pdf' });
      const input1 = { files: [fileWithName], value: 'exame.novo.pdf' } as unknown as HTMLInputElement;
      component['onFileSelected']({ target: input1 } as unknown as Event);

      expect(component['hasFile']()).toBe(true);
      expect(component['fileLabel']()).toBe('exame.novo.pdf');
      expect(component['isFormPristine']()).toBe(false);
      expect(component['attachmentForm'].controls.name.value).toBe('Relatório Médico');
      expect(input1.value).toBe('');

      component['attachmentForm'].controls.name.setValue('');
      const fileWithoutExt = new File(['abc'], 'semextensao', { type: 'text/plain' });
      const input2 = { files: [fileWithoutExt], value: 'semextensao' } as unknown as HTMLInputElement;
      component['onFileSelected']({ target: input2 } as unknown as Event);
      expect(component['attachmentForm'].controls.name.value).toBe('semextensao');

      component['attachmentForm'].controls.name.setValue('');
      const fileWithExt = new File(['abc'], 'laudo.final.pdf', { type: 'application/pdf' });
      const input3 = { files: [fileWithExt], value: 'laudo.final.pdf' } as unknown as HTMLInputElement;
      component['onFileSelected']({ target: input3 } as unknown as Event);
      expect(component['attachmentForm'].controls.name.value).toBe('laudo.final');
    });
  });

  describe('Download de Anexo (download)', () => {
    it('deve ignorar quando archiveId for inválido ou já estiver baixando', () => {
      component['download'](null, 'Doc');
      component['download'](undefined, 'Doc');
      expect(storageServiceMock.download).not.toHaveBeenCalled();

      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValueOnce(pending$.asObservable());

      component['download'](90, '  Meu Anexo  ');
      expect(component['isDownloading']()).toBe(true);
      expect(storageServiceMock.download).toHaveBeenCalledWith('tfd', 90);

      component['download'](90, 'Outro');
      expect(storageServiceMock.download).toHaveBeenCalledTimes(1);

      const blob = new Blob(['conteudo']);
      pending$.next({ archive: blob });
      pending$.complete();

      expect(component['isDownloading']()).toBe(false);
      expect(saveAs).toHaveBeenCalledWith(blob, 'Meu Anexo');
    });

    it('deve usar nome fallback quando name não for informado, ignorar sem archive e tratar erro', () => {
      const blob = new Blob(['conteudo']);
      storageServiceMock.download.mockReturnValueOnce(of({ archive: blob }));
      component['download'](95);
      expect(saveAs).toHaveBeenCalledWith(blob, 'anexo-95');

      storageServiceMock.download.mockReturnValueOnce(of({}));
      component['download'](96, 'Sem Arquivo');
      expect(saveAs).toHaveBeenCalledTimes(1);

      storageServiceMock.download.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Arquivo indisponível.' } }))
      );
      component['download'](97, 'Erro API');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo indisponível.');
      expect(component['isDownloading']()).toBe(false);

      storageServiceMock.download.mockReturnValueOnce(throwError(() => new Error('Falha')));
      component['download'](98, 'Erro Genérico');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao realizar o download do arquivo.'
      );
    });
  });

  describe('Atualização do Anexo (onSubmit)', () => {
    it('deve exibir mensagem quando attachmentId não for encontrado', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do anexo não encontrado.'
      );
      expect(patientRequestServiceMock.updatePatientRequestAttachment).not.toHaveBeenCalled();
    });

    it('deve marcar formulário como touched e não enviar quando inválido', () => {
      component['attachmentForm'].controls.name.setValue('');

      component['onSubmit']();

      expect(component['attachmentForm'].controls.name.touched).toBe(true);
      expect(patientRequestServiceMock.updatePatientRequestAttachment).not.toHaveBeenCalled();
    });

    it('deve enviar payload sem file, gerenciar isSubmitting, notificar canal e fechar dialog', () => {
      component['attachmentForm'].controls.name.setValue('  Nome Atualizado  ');

      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.updatePatientRequestAttachment.mockReturnValueOnce(
        pending$.asObservable()
      );

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['attachmentForm'].disabled).toBe(true);
      expect(patientRequestServiceMock.updatePatientRequestAttachment).toHaveBeenCalledWith(710, {
        name: 'Nome Atualizado',
      });

      pending$.next({ message: 'Salvo com sucesso!' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['attachmentForm'].enabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Salvo com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve incluir file no payload quando selecionado, usar mensagem padrão e tratar erros', () => {
      const file = new File(['dados'], 'novo.pdf', { type: 'application/pdf' });
      component['selectedFile'].set(file);
      component['attachmentForm'].controls.name.setValue('Com Arquivo');

      patientRequestServiceMock.updatePatientRequestAttachment.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(patientRequestServiceMock.updatePatientRequestAttachment).toHaveBeenCalledWith(710, {
        name: 'Com Arquivo',
        file,
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      patientRequestServiceMock.updatePatientRequestAttachment.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Nome duplicado.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Nome duplicado.');

      patientRequestServiceMock.updatePatientRequestAttachment.mockReturnValueOnce(
        throwError(() => new Error('Erro'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao processar a atualização do anexo.'
      );
    });
  });
});