import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError, Subject } from 'rxjs'; // 👈 Adicionado o Subject explicitamente aqui
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeletePatientRequestAttachmentComponent } from './delete-patient-request-attachment-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeletePatientRequestAttachmentComponent', () => {
  let component: DeletePatientRequestAttachmentComponent;
  let fixture: ComponentFixture<DeletePatientRequestAttachmentComponent>;
  
  let patientRequestServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request_attachment: {
      id: 888,
      name: 'comprovante_residencia.pdf'
    }
  };

  beforeEach(async () => {
    patientRequestServiceMock = {
      deletePatientRequestAttachment: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeletePatientRequestAttachmentComponent]
    })
    .overrideComponent(DeletePatientRequestAttachmentComponent, {
      set: {
        providers: [
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletePatientRequestAttachmentComponent);
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
      TestBed.configureTestingModule({ imports: [DeletePatientRequestAttachmentComponent] })
        .overrideComponent(DeletePatientRequestAttachmentComponent, {
          set: {
            providers: [
              { provide: PatientRequestService, useValue: patientRequestServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request_attachment: { name: 'Incompleto' } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeletePatientRequestAttachmentComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador do anexo não encontrado.');
      expect(patientRequestServiceMock.deletePatientRequestAttachment).not.toHaveBeenCalled();
    });

    it('deve remover o anexo com sucesso, exibir toast e fechar a modal retornando true', async () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Anexo removido do pedido com sucesso!' };
      
      // Criamos um Subject para controlar o momento exato em que a API responde de forma assíncrona
      const responseSubject = new Subject<any>();
      patientRequestServiceMock.deletePatientRequestAttachment.mockReturnValue(responseSubject);

      // Dispara a submissão
      component['onSubmit']();

      // 1. Enquanto a API não responde, o estado de submissão precisa estar ativo (true)
      expect(component['isSubmitting']()).toBe(true);
      expect(patientRequestServiceMock.deletePatientRequestAttachment).toHaveBeenCalledWith(888);

      // 2. Simulamos a resposta de sucesso da API e sua finalização
      responseSubject.next(mockApiResponse);
      responseSubject.complete();
      
      await fixture.whenStable();
      
      // 3. Após o término, o estado de submissão volta a ser desativado (false)
      expect(component['isSubmitting']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo removido do pedido com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', async () => {
      fixture.detectChanges();
      patientRequestServiceMock.deletePatientRequestAttachment.mockReturnValue(of({}));

      component['onSubmit']();
      await fixture.whenStable();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Anexo removido com sucesso!');
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', async () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Este arquivo não pode ser excluído pois pertence a uma solicitação já homologada.' } };
      patientRequestServiceMock.deletePatientRequestAttachment.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();
      await fixture.whenStable();

      expect(patientRequestServiceMock.deletePatientRequestAttachment).toHaveBeenCalledWith(888);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', async () => {
      fixture.detectChanges();
      const rawError = { status: 403 };
      patientRequestServiceMock.deletePatientRequestAttachment.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();
      await fixture.whenStable();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover o anexo.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});