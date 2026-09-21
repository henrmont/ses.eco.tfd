import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveAs } from 'file-saver';

import { UpdateReportAttachmentComponent } from './update-report-attachment-component';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';

// Mock estável da biblioteca file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

describe('UpdateReportAttachmentComponent', () => {
  let component: UpdateReportAttachmentComponent;
  let fixture: ComponentFixture<UpdateReportAttachmentComponent>;

  let patientServiceMock: any;
  let messageServiceMock: any;
  let storageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    report_attachment: {
      id: 123,
      name: 'historico_medico_antigo',
      archive_id: 456
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      updateReportAttachment: vi.fn()
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
      imports: [UpdateReportAttachmentComponent],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: PatientService, useValue: patientServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: StorageService, useValue: storageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateReportAttachmentComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso preenchendo o formulário com o estado inicial vindo da modal', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isDownloading']()).toBe(false);
    expect(component['fileLabel']()).toBe('Nenhum arquivo selecionado');
    expect(component['updateAttachmentForm'].get('name')?.value).toBe('historico_medico_antigo');
  });

  describe('Upload e Seleção Substituta de Arquivo Local (onFileSelected)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve atualizar o estado do componente ao selecionar um novo arquivo sem mexer no nome preenchido', () => {
      const mockFile = new File(['binario_novo'], 'novo_exame.png', { type: 'image/png' });
      const mockEvent = {
        target: { files: [mockFile] }
      } as unknown as Event;

      component['onFileSelected'](mockEvent);
      fixture.detectChanges();

      expect(component['selectedFile']).toBe(mockFile);
      expect(component['fileLabel']()).toBe('novo_exame.png');
      expect(component['updateAttachmentForm'].get('name')?.value).toBe('historico_medico_antigo');
    });

    it('deve sugerir o nome limpo do arquivo apenas se o campo nome estiver vazio', () => {
      component['updateAttachmentForm'].get('name')?.setValue('');

      const mockFile = new File([''], 'laudo_final_assinado.pdf', { type: 'application/pdf' });
      const mockEvent = {
        target: { files: [mockFile] }
      } as unknown as Event;

      component['onFileSelected'](mockEvent);
      fixture.detectChanges();

      expect(component['updateAttachmentForm'].get('name')?.value).toBe('laudo_final_assinado');
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

      component['download'](456, 'documento.pdf');
      
      // Espera as microtasks do RxJS resolverem e renderizarem as atualizações de Signals
      await fixture.whenStable();
      fixture.detectChanges();

      expect(storageServiceMock.download).toHaveBeenCalledWith(456);
      expect(saveAs).toHaveBeenCalledWith(mockBlob, 'documento.pdf');
      expect(component['isDownloading']()).toBe(false);
    });

    it('deve exibir mensagem de erro amigável caso a API de storage falhe no download', async () => {
      storageServiceMock.download.mockReturnValue(throwError(() => new Error('Falha de Rede')));

      component['download'](456, 'documento.pdf');
      
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
      component['updateAttachmentForm'].get('name')?.setValue('');
      component['updateAttachmentForm'].updateValueAndValidity();

      component['onSubmit']();

      expect(patientServiceMock.updateReportAttachment).not.toHaveBeenCalled();
    });

    it('deve atualizar com sucesso enviando o arquivo nulo caso mude apenas o nome', async () => {
      component['updateAttachmentForm'].patchValue({ name: 'Nome Novo Sem Novo Arquivo' });
      component['selectedFile'] = null;

      patientServiceMock.updateReportAttachment.mockReturnValue(of({ message: 'Anexo atualizado com sucesso!' }));

      component['onSubmit']();
      
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(false);
      expect(patientServiceMock.updateReportAttachment).toHaveBeenCalledWith(123, {
        name: 'Nome Novo Sem Novo Arquivo',
        file: null
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar falhas do backend ao tentar atualizar o anexo mantendo a modal aberta', async () => {
      component['updateAttachmentForm'].patchValue({ name: 'Tentativa Invalida' });
      
      const mockApiError = { error: { message: 'Erro interno ao processar arquivo.' } };
      patientServiceMock.updateReportAttachment.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();
      
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro interno ao processar arquivo.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });
});