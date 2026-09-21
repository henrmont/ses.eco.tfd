import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fileSaver from 'file-saver';

import { ReportAttachmentsComponent } from './report-attachments-component';
import { PatientService } from '../../../services/patient-service';
import { StorageService } from '../../../../core/services/storage-service';
import { ReportAttachment } from '../../../models/report-attachment';
import { CreateReportAttachmentComponent } from '../create-report-attachment-component/create-report-attachment-component';
import { UpdateReportAttachmentComponent } from '../update-report-attachment-component/update-report-attachment-component';
import { DeleteReportAttachmentComponent } from '../delete-report-attachment-component/delete-report-attachment-component';

// Mock explícito da biblioteca file-saver para monitorar os gatilhos de download local
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

describe('ReportAttachmentsComponent', () => {
  let component: ReportAttachmentsComponent;
  let fixture: ComponentFixture<ReportAttachmentsComponent>;

  // Mocks das dependências
  let patientServiceMock: any;
  let storageServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;

  // Dados falsos de entrada via MAT_DIALOG_DATA (Contém o laudo pai)
  const mockDialogData = {
    report: {
      id: 88
    }
  };

  // Massa de dados de anexos estritamente tipada conforme o Model do sistema
  const mockAttachmentsResponse: ReportAttachment[] = [
    { id: 10, name: 'raio-x-torax.pdf', archive_id: 101, report_id: 88 },
    { id: 11, name: 'laudo-laboratorial.png', archive_id: 102, report_id: 88 }
  ];

  beforeEach(async () => {
    patientServiceMock = {
      getReportAttachments: vi.fn().mockReturnValue(of(mockAttachmentsResponse))
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

    await TestBed.configureTestingModule({
      imports: [ReportAttachmentsComponent]
    })
    .overrideComponent(ReportAttachmentsComponent, {
      set: {
        providers: [
          { provide: PatientService, useValue: patientServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportAttachmentsComponent);
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

      // Garante que buscou os arquivos vinculados ao ID do laudo correto
      expect(patientServiceMock.getReportAttachments).toHaveBeenCalledWith(88);
      
      // Valida se o sinal reativo bruto foi populado
      expect(component['attachmentsList']()).toEqual(mockAttachmentsResponse);
      
      // Valida se o computed do dataSource derivou a instância e os dados perfeitamente
      expect(component['dataSource']()).toBeInstanceOf(MatTableDataSource);
      expect(component['dataSource']().data).toEqual(mockAttachmentsResponse);
      
      // O loading deve ter sido desativado ao concluir com sucesso
      expect(component['isLoading']()).toBe(false);
    });

    it('deve desativar o spinner e não disparar requisições caso o id do laudo esteja ausente (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ReportAttachmentsComponent] })
        .overrideComponent(ReportAttachmentsComponent, {
          set: {
            providers: [
              { provide: PatientService, useValue: patientServiceMock },
              { provide: StorageService, useValue: storageServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { report: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(ReportAttachmentsComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(patientServiceMock.getReportAttachments).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading mesmo se a API do servidor falhar no ciclo de inicialização', () => {
      patientServiceMock.getReportAttachments.mockReturnValue(throwError(() => new Error('Falha catastrófica')));
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
      component['download'](101, 'raio-x-torax.pdf');

      expect(storageServiceMock.download).toHaveBeenCalledWith(101);
      expect(fileSaver.saveAs).toHaveBeenCalledWith(expect.any(Blob), 'raio-x-torax.pdf');
    });

    it('deve lidar amigavelmente e não disparar quebras se a resposta do storage vier corrompida ou vazia', () => {
      storageServiceMock.download.mockReturnValue(of(null));
      component['download'](101, 'invalido.pdf');

      expect(storageServiceMock.download).toHaveBeenCalledWith(101);
      expect(fileSaver.saveAs).not.toHaveBeenCalled();
    });

    it('deve engolir o erro de forma segura caso a API do storage falhar', () => {
      storageServiceMock.download.mockReturnValue(throwError(() => new Error('Error 404')));
      
      expect(() => component['download'](101, 'erro.pdf')).not.toThrow();
      expect(fileSaver.saveAs).not.toHaveBeenCalled();
    });
  });

  describe('Abertura de Modais Internas e Mutação de Dados', () => {
    // Alvo mockado com a propriedade exigida 'report_id' resolvida!
    const targetAttachment: ReportAttachment = { 
      id: 10, 
      name: 'foto.jpg', 
      archive_id: 101,
      report_id: 88 
    };

    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve abrir a modal CreateReportAttachmentComponent e atualizar a grid fluidamente (background) se salva com sucesso', () => {
      patientServiceMock.getReportAttachments.mockClear();

      component['createReportAttachment']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreateReportAttachmentComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { report: mockDialogData.report }
      });

      // Como o mock do afterClosed emite true, verifica o refresh em background
      expect(patientServiceMock.getReportAttachments).toHaveBeenCalledWith(88);
      expect(component['isLoading']()).toBe(false);
    });

    it('deve abrir a modal UpdateReportAttachmentComponent e atualizar a grid sem ativar loading ruidoso', () => {
      patientServiceMock.getReportAttachments.mockClear();

      component['updateReportAttachment'](targetAttachment);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdateReportAttachmentComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { report_attachment: targetAttachment }
      });

      expect(patientServiceMock.getReportAttachments).toHaveBeenCalled();
      expect(component['isLoading']()).toBe(false);
    });

    it('deve abrir a modal DeleteReportAttachmentComponent acionando o estado de carregamento total antes de renderizar a nova lista', () => {
      patientServiceMock.getReportAttachments.mockClear();

      component['deleteReportAttachment'](targetAttachment);

      expect(dialogMock.open).toHaveBeenCalledWith(DeleteReportAttachmentComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { report_attachment: targetAttachment }
      });

      expect(patientServiceMock.getReportAttachments).toHaveBeenCalled();
    });

    it('não deve recarregar os dados se as modais internas forem fechadas sem ação concludente (retorno falso/nulo)', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      patientServiceMock.getReportAttachments.mockClear();

      component['createReportAttachment']();

      expect(patientServiceMock.getReportAttachments).not.toHaveBeenCalled();
    });
  });
});