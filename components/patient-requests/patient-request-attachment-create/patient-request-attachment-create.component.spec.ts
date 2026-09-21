import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CreatePatientRequestAttachmentComponent } from './create-patient-request-attachment-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreatePatientRequestAttachmentComponent', () => {
  let component: CreatePatientRequestAttachmentComponent;
  let fixture: ComponentFixture<CreatePatientRequestAttachmentComponent>;

  let patientRequestServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock de dados da modal baseado na assinatura de solicitações de pacientes (data.patient_request.id)
  const mockDialogData = {
    patient_request: {
      id: 888
    }
  };

  beforeEach(async () => {
    patientRequestServiceMock = {
      createPatientRequestAttachment: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        CreatePatientRequestAttachmentComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: PatientRequestService, useValue: patientRequestServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(CreatePatientRequestAttachmentComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatePatientRequestAttachmentComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário padrão', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['hasFile']()).toBe(false);
    expect(component['fileLabel']()).toBe('Nenhum arquivo selecionado');
    expect(component['createAttachmentForm']).toBeTruthy();
  });

  describe('Upload e Seleção de Arquivo Local (onFileSelected)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve atualizar o estado do componente e sugerir o nome do anexo sem a extensão ao selecionar um arquivo', () => {
      // Simula a estrutura de um evento de input de arquivo real
      const mockFile = new File(['conteudo_vazio'], 'comprovante_endereco.pdf', { type: 'application/pdf' });
      const mockEvent = {
        target: {
          files: [mockFile]
        }
      } as unknown as Event;

      component['onFileSelected'](mockEvent);

      expect(component['selectedFile']).toBe(mockFile);
      expect(component['fileLabel']()).toBe('comprovante_endereco.pdf');
      expect(component['hasFile']()).toBe(true);
      // UX Inteligente: Verifica se limpou o ".pdf" do input de texto
      expect(component['createAttachmentForm'].get('name')?.value).toBe('comprovante_endereco');
    });

    it('não deve substituir o nome do anexo se o usuário já tiver digitado algo manualmente', () => {
      component['createAttachmentForm'].get('name')?.setValue('Documentação Antiga');

      const mockFile = new File(['conteudo_vazio'], 'foto_documento.png', { type: 'image/png' });
      const mockEvent = {
        target: {
          files: [mockFile]
        }
      } as unknown as Event;

      component['onFileSelected'](mockEvent);

      expect(component['createAttachmentForm'].get('name')?.value).toBe('Documentação Antiga');
    });
  });

  describe('Fluxo de Submissão do Anexo (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();

      // Estratégia de reset de validadores idêntica à referência
      const attachmentForm = component['createAttachmentForm'];
      Object.keys(attachmentForm.controls).forEach(key => {
        const control = attachmentForm.get(key);
        control?.clearValidators();
        control?.clearAsyncValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      Object.defineProperty(attachmentForm, 'invalid', { get: () => !attachmentForm.valid, configurable: true });
      Object.defineProperty(attachmentForm, 'valid', { get: () => !attachmentForm.errors, configurable: true });
    });

    it('deve barrar a submissão e exibir mensagem caso nenhum arquivo binário tenha sido selecionado', () => {
      component['selectedFile'] = null; // Sem arquivo anexado
      component['createAttachmentForm'].patchValue({ name: 'Foto do RG' });

      component['onSubmit']();

      expect(patientRequestServiceMock.createPatientRequestAttachment).not.toHaveBeenCalled();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('A seleção de um arquivo anexo é obrigatória.');
    });

    it('deve barrar a submissão se o formulário de texto estiver inválido', () => {
      component['selectedFile'] = new File([''], 'teste.txt');
      component['createAttachmentForm'].setErrors({ required: true });

      component['onSubmit']();

      expect(patientRequestServiceMock.createPatientRequestAttachment).not.toHaveBeenCalled();
    });

    it('deve fazer o upload do anexo com sucesso, exibir toast e fechar a modal retornando verdadeiro', () => {
      const mockFile = new File(['binario'], 'historico_medico.pdf', { type: 'application/pdf' });
      component['selectedFile'] = mockFile;
      component['createAttachmentForm'].patchValue({ name: 'Histórico Médico Atualizado' });

      patientRequestServiceMock.createPatientRequestAttachment.mockReturnValue(of({ message: 'Arquivo anexado com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(patientRequestServiceMock.createPatientRequestAttachment).toHaveBeenCalledWith(888, {
        name: 'Histórico Médico Atualizado',
        file: mockFile
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo anexado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar falhas de API amigavelmente liberando o botão de envio', () => {
      component['selectedFile'] = new File([''], 'anexo.png');
      component['createAttachmentForm'].patchValue({ name: 'Anexo de Solicitação' });

      const mockApiError = { error: { message: 'O arquivo enviado é inválido ou está corrompido.' } };
      patientRequestServiceMock.createPatientRequestAttachment.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('O arquivo enviado é inválido ou está corrompido.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});