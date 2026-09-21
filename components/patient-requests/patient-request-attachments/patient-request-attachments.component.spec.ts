import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fileSaver from 'file-saver';

import { PatientRequestAttachmentsComponent } from './patient-request-attachments-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { StorageService } from '../../../../core/services/storage-service';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment';
import { CreatePatientRequestAttachmentComponent } from '../create-patient-request-attachment-component/create-patient-request-attachment-component';
import { UpdatePatientRequestAttachmentComponent } from '../update-patient-request-attachment-component/update-patient-request-attachment-component';
import { DeletePatientRequestAttachmentComponent } from '../delete-patient-request-attachment-component/delete-patient-request-attachment-component';

// Mock explícito da biblioteca file-saver para monitorar os gatilhos de download local
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

describe('PatientRequestAttachmentsComponent', () => {
  let component: PatientRequestAttachmentsComponent;
  let fixture: ComponentFixture<PatientRequestAttachmentsComponent>;

  // Mocks das dependências
  let patientRequestServiceMock: any;
  let storageServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;
  let broadcastSpy: any;

  // Dados falsos de entrada via MAT_DIALOG_DATA
  const mockDialogData = {
    patient_request: {
      id: 99
    }
  };

  // Massa de dados de anexos tipada conforme o Model do contexto de solicitações
  const mockAttachmentsResponse: PatientRequestAttachment[] = [
    { id: 20, name: 'comprovante-residencia.pdf', archive_id: 201, patient_request_id: 99 },
    { id: 21, name: 'rg-frente.png', archive_id: 202, patient_request_id: 99 }
  ];

  beforeEach(async () => {
    patientRequestServiceMock = {
      getPatientRequestAttachments: vi.fn().mockReturnValue(of(mockAttachmentsResponse))
    };

    storageServiceMock = {
      download: vi.fn().mockReturnValue(of({ archive: new Blob(['conteudo-falso'], { type: 'application/pdf' }) }))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula confirmação do usuário nas submodais
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    // Intercepta as transmissões do canal para não poluir o ecossistema do navegador
    broadcastSpy = vi.spyOn(BroadcastChannel.prototype, 'postMessage').mockImplementation(() => {});

    await TestBed.configureTestingModule({
      imports: [PatientRequestAttachmentsComponent]
    })
    .overrideComponent(PatientRequestAttachmentsComponent, {
      set: {
        providers: [
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestAttachmentsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('Inicialização e Fluxo de Carga Inicial', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges(); // Dispara o ngOnInit
      expect(component).toBeTruthy();
    });

    it('deve carregar a lista de anexos reativamente e alimentar o dataSource baseado em computed', () => {
      fixture.detectChanges();

      // Garante que buscou os arquivos vinculados ao ID da solicitação correto
      expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalledWith(99);
      
      // Valida se o sinal reativo bruto foi populado
      expect(component['attachmentsList']()).toEqual(mockAttachmentsResponse);
      
      // Valida se o computed do dataSource derivou a instância e os dados perfeitamente
      expect(component['dataSource']()).toBeInstanceOf(MatTableDataSource);
      expect(component['dataSource']().data).toEqual(mockAttachmentsResponse);
      
      // O loading deve ter sido desativado ao concluir com sucesso
      expect(component['isLoading']()).toBe(false);
    });

    it('deve desativar o spinner e não disparar requisições caso o id da solicitação esteja ausente (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [PatientRequestAttachmentsComponent] })
        .overrideComponent(PatientRequestAttachmentsComponent, {
          set: {
            providers: [
              { provide: PatientRequestService, useValue: patientRequestServiceMock },
              { provide: StorageService, useValue: storageServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(PatientRequestAttachmentsComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(patientRequestServiceMock.getPatientRequestAttachments).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading mesmo se a API do servidor falhar no ciclo de inicialização', () => {
      patientRequestServiceMock.getPatientRequestAttachments.mockReturnValue(throwError(() => new Error('Falha de conexão')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['attachmentsList']()).toEqual([]);
    });
  });

  describe('Fluxo de Download de Arquivos', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve buscar o arquivo no storage service e invocar a biblioteca file-saver para salvar localmente', () => {
      component['download'](201, 'comprovante-residencia.pdf');

      expect(storageServiceMock.download).toHaveBeenCalledWith(201);
      expect(fileSaver.saveAs).toHaveBeenCalledWith(expect.any(Blob), 'comprovante-residencia.pdf');
    });

    it('deve lidar amigavelmente e não disparar quebras se a resposta do storage vier corrompida ou vazia', () => {
      storageServiceMock.download.mockReturnValue(of(null));
      component['download'](201, 'invalido.pdf');

      expect(storageServiceMock.download).toHaveBeenCalledWith(201);
      expect(fileSaver.saveAs).not.toHaveBeenCalled();
    });

    it('deve engolir o erro de forma segura caso a API do storage falhar', () => {
      storageServiceMock.download.mockReturnValue(throwError(() => new Error('Error 404')));
      
      expect(() => component['download'](201, 'erro.pdf')).not.toThrow();
      expect(fileSaver.saveAs).not.toHaveBeenCalled();
    });
  });

  describe('Abertura de Modais Internas e Mutação de Dados', () => {
    const targetAttachment: PatientRequestAttachment = { 
      id: 20, 
      name: 'documento.pdf', 
      archive_id: 201,
      patient_request_id: 99 
    };

    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve abrir a modal CreatePatientRequestAttachmentComponent, atualizar a grid em background e notificar o canal de transmissão', () => {
      patientRequestServiceMock.getPatientRequestAttachments.mockClear();

      component['createPatientRequestAttachment']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreatePatientRequestAttachmentComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { patient_request: mockDialogData.patient_request }
      });

      expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalledWith(99);
      expect(broadcastSpy).toHaveBeenCalledWith('update');
      expect(component['isLoading']()).toBe(false);
    });

    it('deve abrir a modal UpdatePatientRequestAttachmentComponent, atualizar a grid sem travar a UI e notificar o canal', () => {
      patientRequestServiceMock.getPatientRequestAttachments.mockClear();

      component['updatePatientRequestAttachment'](targetAttachment);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdatePatientRequestAttachmentComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { patient_request_attachment: targetAttachment }
      });

      expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalled();
      expect(broadcastSpy).toHaveBeenCalledWith('update');
      expect(component['isLoading']()).toBe(false);
    });

    it('deve abrir a modal DeletePatientRequestAttachmentComponent acionando o estado de carregamento total e notificar o canal', () => {
      patientRequestServiceMock.getPatientRequestAttachments.mockClear();

      component['deletePatientRequestAttachment'](targetAttachment);

      expect(dialogMock.open).toHaveBeenCalledWith(DeletePatientRequestAttachmentComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { patient_request_attachment: targetAttachment }
      });

      expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalled();
      expect(broadcastSpy).toHaveBeenCalledWith('update');
    });

    it('não deve recarregar os dados nem transmitir mensagens se as modais forem fechadas sem ação concludente', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      patientRequestServiceMock.getPatientRequestAttachments.mockClear();
      broadcastSpy.mockClear();

      component['createPatientRequestAttachment']();

      expect(patientRequestServiceMock.getPatientRequestAttachments).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });
});