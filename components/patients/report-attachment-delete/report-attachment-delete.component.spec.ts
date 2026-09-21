import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeleteReportAttachmentComponent } from './delete-report-attachment-component';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeleteReportAttachmentComponent', () => {
  let component: DeleteReportAttachmentComponent;
  let fixture: ComponentFixture<DeleteReportAttachmentComponent>;
  
  let patientServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    report_attachment: {
      id: 999,
      name: 'laudo_exame_laboratorial.pdf'
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      deleteReportAttachment: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeleteReportAttachmentComponent]
    })
    // 🚀 Usando o recurso de override para forçar os providers direto no escopo do componente
    .overrideComponent(DeleteReportAttachmentComponent, {
      set: {
        providers: [
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeleteReportAttachmentComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve inicializar com o estado de submissão desativado', () => {
      fixture.detectChanges();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Fluxo de Submissão (onSubmit)', () => {
    it('deve barrar a execução e exibir mensagem de erro se o attachment id não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeleteReportAttachmentComponent] })
        .overrideComponent(DeleteReportAttachmentComponent, {
          set: {
            providers: [
              { provide: PatientService, useValue: patientServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { report_attachment: { name: 'Incompleto' } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeleteReportAttachmentComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador do anexo não encontrado.');
      expect(patientServiceMock.deleteReportAttachment).not.toHaveBeenCalled();
    });

    it('deve remover o anexo com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Anexo excluído com sucesso!' };
      patientServiceMock.deleteReportAttachment.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.deleteReportAttachment).toHaveBeenCalledWith(999);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo excluído com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    // 🎯 Cobertura do branch do fallback de sucesso sem mensagem explícita da API
    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
      fixture.detectChanges();
      patientServiceMock.deleteReportAttachment.mockReturnValue(of({}));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo removido com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Arquivo não encontrado ou já removido do storage.' } };
      patientServiceMock.deleteReportAttachment.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(patientServiceMock.deleteReportAttachment).toHaveBeenCalledWith(999);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    // 🎯 Cobertura do branch do fallback de erro genérico se a API falhar sem retornar payload estruturado
    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
      fixture.detectChanges();
      const rawError = { status: 500 };
      patientServiceMock.deleteReportAttachment.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover o anexo.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});