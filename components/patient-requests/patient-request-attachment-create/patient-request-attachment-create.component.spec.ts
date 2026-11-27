// src/app/tfd/components/patient-requests/patient-request-attachment-create/patient-request-attachment-create.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestAttachmentCreateComponent,
  PatientRequestAttachmentCreateDialogData,
} from './patient-request-attachment-create.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestAttachmentCreateComponent', () => {
  let component: PatientRequestAttachmentCreateComponent;
  let fixture: ComponentFixture<PatientRequestAttachmentCreateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    createPatientRequestAttachment: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const defaultDialogData: PatientRequestAttachmentCreateDialogData = {
    patient_request: {
      id: 305,
    } as unknown as PatientRequest,
  };

  async function createComponent(
    dialogData: PatientRequestAttachmentCreateDialogData | null = defaultDialogData
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestAttachmentCreateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestAttachmentCreateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestAttachmentCreateComponent);
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
      createPatientRequestAttachment: vi.fn().mockReturnValue(of({ message: 'Anexo salvo!' })),
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

  it('deve criar o componente, abrir o BroadcastChannel e expor estado inicial', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['hasFile']()).toBe(false);
    expect(component['fileLabel']()).toBe('Nenhum arquivo selecionado');
    expect(component['isFormInvalidOrPending']).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Seleção de Arquivo (onFileSelected)', () => {
    it('deve ignorar evento quando nenhum arquivo for selecionado', () => {
      const input = { files: null, value: 'algo.pdf' } as unknown as HTMLInputElement;
      component['onFileSelected']({ target: input } as unknown as Event);

      expect(component['hasFile']()).toBe(false);
      expect(input.value).toBe('algo.pdf');
    });

    it('deve atualizar selectedFile, preencher nome sem extensão quando vazio e limpar input.value', () => {
      const file = new File(['conteudo'], 'laudo.medico.pdf', { type: 'application/pdf' });
      const input = { files: [file], value: 'C:\\fakepath\\laudo.medico.pdf' } as unknown as HTMLInputElement;

      component['onFileSelected']({ target: input } as unknown as Event);

      expect(component['hasFile']()).toBe(true);
      expect(component['selectedFile']()).toBe(file);
      expect(component['fileLabel']()).toBe('laudo.medico.pdf');
      expect(component['attachmentForm'].controls.name.value).toBe('laudo.medico');
      expect(component['attachmentForm'].controls.name.dirty).toBe(true);
      expect(input.value).toBe('');
    });

    it('deve preservar nome já digitado e tratar arquivo sem extensão', () => {
      component['attachmentForm'].controls.name.setValue('Nome Customizado');
      const fileWithName = new File(['abc'], 'documento.pdf', { type: 'application/pdf' });
      const input1 = { files: [fileWithName], value: 'documento.pdf' } as unknown as HTMLInputElement;

      component['onFileSelected']({ target: input1 } as unknown as Event);
      expect(component['attachmentForm'].controls.name.value).toBe('Nome Customizado');

      component['attachmentForm'].controls.name.setValue('');
      const fileWithoutExt = new File(['abc'], 'comprovante', { type: 'text/plain' });
      const input2 = { files: [fileWithoutExt], value: 'comprovante' } as unknown as HTMLInputElement;

      component['onFileSelected']({ target: input2 } as unknown as Event);
      expect(component['attachmentForm'].controls.name.value).toBe('comprovante');
    });
  });

  describe('Envio do Anexo (onSubmit)', () => {
    it('deve exibir mensagem quando patient_request.id não for válido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da solicitação não encontrado.'
      );
      expect(patientRequestServiceMock.createPatientRequestAttachment).not.toHaveBeenCalled();
    });

    it('deve marcar formulário como touched e exigir arquivo quando ausente', () => {
      component['onSubmit']();

      expect(component['attachmentForm'].controls.name.touched).toBe(true);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'A seleção de um arquivo anexo é obrigatória.'
      );
      expect(patientRequestServiceMock.createPatientRequestAttachment).not.toHaveBeenCalled();
    });

    it('deve bloquear envio quando houver arquivo mas o nome estiver inválido', () => {
      const file = new File(['conteudo'], 'exame.png', { type: 'image/png' });
      component['selectedFile'].set(file);
      component['attachmentForm'].controls.name.setValue('');

      component['onSubmit']();

      expect(component['attachmentForm'].controls.name.touched).toBe(true);
      expect(messageServiceMock.showMessage).not.toHaveBeenCalled();
      expect(patientRequestServiceMock.createPatientRequestAttachment).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, enviar payload trimado, notificar canal e fechar dialog no sucesso', () => {
      const file = new File(['conteudo'], 'guia.pdf', { type: 'application/pdf' });
      component['selectedFile'].set(file);
      component['attachmentForm'].controls.name.setValue('  Guia de Encaminhamento  ');

      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.createPatientRequestAttachment.mockReturnValueOnce(
        pending$.asObservable()
      );

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['attachmentForm'].disabled).toBe(true);
      expect(patientRequestServiceMock.createPatientRequestAttachment).toHaveBeenCalledWith(305, {
        name: 'Guia de Encaminhamento',
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
      const file = new File(['conteudo'], 'doc.pdf', { type: 'application/pdf' });
      component['selectedFile'].set(file);
      component['attachmentForm'].controls.name.setValue('Documento');

      patientRequestServiceMock.createPatientRequestAttachment.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo anexado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      patientRequestServiceMock.createPatientRequestAttachment.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Formato não suportado.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Formato não suportado.');

      patientRequestServiceMock.createPatientRequestAttachment.mockReturnValueOnce(
        throwError(() => new Error('Falha de rede'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao processar o upload do anexo.'
      );
    });
  });
});