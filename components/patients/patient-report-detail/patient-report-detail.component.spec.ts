import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fileSaver from 'file-saver';

// 🚀 Isolamento do módulo ESM para permitir interceptação de métodos estáticos
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

import { ShowPatientReportComponent } from './show-patient-report-component';
import { StorageService } from '../../../../core/services/storage-service';

describe('ShowPatientReportComponent', () => {
  let component: ShowPatientReportComponent;
  let fixture: ComponentFixture<ShowPatientReportComponent>;
  let storageServiceMock: any;

  // Massa de dados mockada casando perfeitamente com a estrutura do laudo (report)
  const mockDialogData = {
    report: {
      id: 50,
      protocol: '2026.06.001A',
      lawsuit: true,
      diagnosis: 'Paciente necessita de tratamento especializado fora do domicílio.',
      cid: {
        code: 'M54.5',
        name: 'Dor lombar baixa'
      },
      attachments: [
        { archive_id: 901, name: 'laudo_medico.pdf' },
        { archive_id: 902, name: 'exame_imagem.pdf' }
      ]
    }
  };

  beforeEach(async () => {
    storageServiceMock = {
      download: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ShowPatientReportComponent],
      providers: [
        { provide: StorageService, useValue: storageServiceMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShowPatientReportComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização e Renderização', () => {
    it('deve criar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve expor corretamente a árvore de dados do laudo injetada pelo diálogo', () => {
      fixture.detectChanges();
      expect(component.data).toBeDefined();
      expect(component.data.report.protocol).toBe('2026.06.001A');
      expect(component.data.report.cid.code).toBe('M54.5');
    });
  });

  describe('Fluxo de Download de Arquivos Anexos', () => {
    it('deve acionar o StorageService com o ID correto e realizar o download utilizando o file-saver', () => {
      fixture.detectChanges();

      // Cria um Blob fake simulando o retorno de arquivo binário da API
      const fakeBlob = new Blob(['conteudo-binario-falso'], { type: 'application/pdf' });
      const mockApiResponse = { archive: fakeBlob };
      
      storageServiceMock.download.mockReturnValue(of(mockApiResponse));

      // Executa a trigger de download configurada nos botões do HTML
      component.download(901, 'laudo_medico.pdf');

      // Verifica se o serviço de Storage buscou a ID da mídia correta
      expect(storageServiceMock.download).toHaveBeenCalledWith(901);
      
      // Valida se a biblioteca externa 'file-saver' recebeu a chamada de salvar em disco
      expect(fileSaver.saveAs).toHaveBeenCalledWith(fakeBlob, 'laudo_medico.pdf');
    });
  });
});