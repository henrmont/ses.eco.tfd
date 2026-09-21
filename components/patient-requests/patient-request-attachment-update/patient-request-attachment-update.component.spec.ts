import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveAs } from 'file-saver';

import { UpdatePatientRequestAttachmentComponent } from './update-patient-request-attachment-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';

// Mock estável da biblioteca file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

describe('UpdatePatientRequestAttachmentComponent', () => {
  let component: UpdatePatientRequestAttachmentComponent;
  let fixture: ComponentFixture<UpdatePatientRequestAttachmentComponent>;

  let patientRequestServiceMock: any;
  let messageServiceMock: any;
  let storageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request_attachment: {
      id: 777,
      name: 'comprovante_antigo',
      archive_id: 999
    }
  };

  beforeEach(async () => {
    patientRequestServiceMock = {
      updatePatientRequestAttachment: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    storageServiceMock = {
      download: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UpdatePatientRequestAttachmentComponent],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: PatientRequestService, useValue: patientRequestServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: StorageService, useValue: storageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdatePatientRequestAttachmentComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso preenchendo o formulário com o estado inicial vindo da modal', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isDownloading']()).toBe(false);
    expect(component['fileLabel']()).toBe('Nenhum arquivo selecionado');
    expect(component['attachmentForm'].get('name')?.value).toBe('comprovante_antigo');
  });

  describe('Upload e Seleção Substituta de Arquivo Local (onFileSelected)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve atualizar o estado do componente ao selecionar um novo arquivo sem mexer no nome preenchido', () => {
      const mockFile = new File(['binario_novo'], 'novo_comprovante.pdf', { type: 'application/pdf' });
      const mockEvent = {
        target: { files: [mockFile] }
      } as unknown as Event;

      component['onFileSelected'](mockEvent);
      fixture.detectChanges();

      expect(component['selectedFile']).toBe(mockFile);
      expect(component['fileLabel']()).toBe('novo_comprovante.pdf');
      expect(component['attachmentForm'].get('name')?.value).toBe('comprovante_antigo');
    });

    it('deve sugerir o nome limpo do arquivo apenas se o campo nome estiver vazio', () => {
      component['attachmentForm'].get('name')?.setValue('');

      const mockFile = new File([''], 'rg_frente_verso.png', { type: 'image/png' });
      const mockEvent = {
        target: { files: [mockFile] }
      } as unknown as Event;

      component['onFileSelected'](mockEvent);
      fixture.detectChanges();

      expect(component['attachmentForm'].get('name')?.value).toBe('rg_frente_verso');
    });
  });

  describe('Fluxo do Botão de Download (download)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve abortar preventivamente caso o archiveId recebido seja nulo', () => {
      component['download'](0, 'arquivo.pdf');
      expect(storageServiceMock.download).not.toHaveBeenCalled();
    });

    it('deve baixar o binário com sucesso e delegar o salvamento local para a biblioteca file-saver', async () => {
      const mockBlob = new Blob(['dados_binarios'], { type: 'application/pdf' });
      storageServiceMock.download.mockReturnValue(of({ archive: mockBlob }));

      component['download'](999, 'comprovante.pdf');
      
      // Espera as microtasks do RxJS resolverem e renderizarem as atualizações de Signals
      await fixture.whenStable();
      fixture.detectChanges();

      expect(storageServiceMock.download).toHaveBeenCalledWith(999);
      expect(saveAs).toHaveBeenCalledWith(mockBlob, 'comprovante.pdf');
      expect(component['isDownloading']()).toBe(false);
    });

    it('deve exibir mensagem de erro amigável caso a API de storage falhe no download', async () => {
      storageServiceMock.download.mockReturnValue(throwError(() => new Error('Falha de Rede')));

      component['download'](999, 'comprovante.pdf');
      
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['isDownloading']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Falha ao tentar baixar o arquivo.');
    });
  });

  describe('Fluxo de Submissão da Atualização (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve barrar a submissão se o formulário de nome estiver inválido', () => {
      component['attachmentForm'].get('name')?.setValue('');
      component['attachmentForm'].updateValueAndValidity();

      component['onSubmit']();

      expect(patientRequestServiceMock.updatePatientRequestAttachment).not.toHaveBeenCalled();
    });

    it('deve atualizar com sucesso enviando o arquivo nulo caso mude apenas o nome', async () => {
      component['attachmentForm'].patchValue({ name: 'Nome Corrigido Sem Substituir Arquivo' });
      component['selectedFile'] = null;

      patientRequestServiceMock.updatePatientRequestAttachment.mockReturnValue(of({ message: 'Anexo atualizado com sucesso!' }));

      component['onSubmit']();
      
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(false);
      expect(patientRequestServiceMock.updatePatientRequestAttachment).toHaveBeenCalledWith(777, {
        name: 'Nome Corrigido Sem Substituir Arquivo',
        file: null
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar falhas do backend ao tentar atualizar o anexo mantendo a modal aberta', async () => {
      component['attachmentForm'].patchValue({ name: 'Nova Tentativa com Erro' });
      
      const mockApiError = { error: { message: 'Erro interno ao processar a requisição de atualização.' } };
      patientRequestServiceMock.updatePatientRequestAttachment.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();
      
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro interno ao processar a requisição de atualização.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });
});