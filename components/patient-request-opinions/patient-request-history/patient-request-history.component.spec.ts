import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fileSaver from 'file-saver';

// 🚀 Isolamento do módulo ESM para permitir interceptação de métodos estáticos do file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

import { HistoryPatientRequestComponent } from './history-patient-request-component';
import { OpinionService } from '../../../services/opinion-service';
import { StorageService } from '../../../../core/services/storage-service';
import { ShowPatientRequestComponent } from '../../patient-request/show-patient-request-component/show-patient-request-component';
import { ShowOpinionComponent } from '../show-opinion-component/show-opinion-component';
import { PatientRequest } from '../../../models/patient-request';
import { Opinion } from '../../../models/opinion';

describe('HistoryPatientRequestComponent', () => {
  let component: HistoryPatientRequestComponent;
  let fixture: ComponentFixture<HistoryPatientRequestComponent>;

  // Mocks das dependências
  let opinionServiceMock: any;
  let storageServiceMock: any;
  let dialogMock: any;

  // Dados falsos de entrada casando com a árvore de propriedades exigida
  const mockDialogData = {
    patient_request: {
      id: 450,
      report: {
        id: 99
      }
    }
  };

  // Massa de dados fake simulando histórico de solicitações e pareceres
  const mockHistoryResponse: PatientRequest[] = [
    {
      id: 450,
      type: 'Consulta Especializada',
      consultation_date: '2026-06-15',
      opinions: [
        { id: 'op-1', name: 'Parecer Psicológico', is_approved: true, professional: { name: 'Dra. Maria' } } as any
      ]
    } as any
  ];

  beforeEach(async () => {
    opinionServiceMock = {
      getHistoryPatientRequests: vi.fn().mockReturnValue(of(mockHistoryResponse))
    };

    storageServiceMock = {
      download: vi.fn()
    };

    dialogMock = {
      open: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [HistoryPatientRequestComponent]
    })
    .overrideComponent(HistoryPatientRequestComponent, {
      set: {
        providers: [
          { provide: OpinionService, useValue: opinionServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(HistoryPatientRequestComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização e Fluxo de Carga Inicial', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve buscar o histórico reativamente mapeando os IDs e alimentar o signal patient_requests', () => {
      fixture.detectChanges();

      // Verifica se a API foi chamada com os parâmetros corretos extraídos do DIALOG_DATA
      expect(opinionServiceMock.getHistoryPatientRequests).toHaveBeenCalledWith(99, 450);
      
      // Valida o preenchimento reativo do sinal
      expect(component['patient_requests']()).toEqual(mockHistoryResponse);
      expect(component['isLoading']()).toBe(false);
    });

    it('deve interromper o fluxo e desligar o spinner se os IDs obrigatórios não existirem (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [HistoryPatientRequestComponent] })
        .overrideComponent(HistoryPatientRequestComponent, {
          set: {
            providers: [
              { provide: OpinionService, useValue: opinionServiceMock },
              { provide: StorageService, useValue: storageServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null, report: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(HistoryPatientRequestComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(opinionServiceMock.getHistoryPatientRequests).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading por meio do finalize mesmo se a requisição falhar', () => {
      opinionServiceMock.getHistoryPatientRequests.mockReturnValue(throwError(() => new Error('Falha de Integração')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['patient_requests']()).toEqual([]);
    });
  });

  describe('Fluxo de Download de Documentos de Mídia', () => {
    it('deve acionar o StorageService e invocar o salvamento em disco com o file-saver', () => {
      fixture.detectChanges();
      const fakeBlob = new Blob(['mock-pdf'], { type: 'application/pdf' });
      storageServiceMock.download.mockReturnValue(of({ archive: fakeBlob }));

      component['download'](1024, 'historico.pdf');

      expect(storageServiceMock.download).toHaveBeenCalledWith(1024);
      expect(fileSaver.saveAs).toHaveBeenCalledWith(fakeBlob, 'historico.pdf');
    });
  });

  describe('Manipulação de Eventos do DOM e Abertura de Modais', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve conter uma função clickEvent capaz de interromper a propagação de bolha do evento (stopPropagation)', () => {
      const mouseEventMock = {
        stopPropagation: vi.fn()
      } as unknown as MouseEvent;

      component['clickEvent'](mouseEventMock);
      expect(mouseEventMock.stopPropagation).toHaveBeenCalled();
    });

    it('deve delegar a abertura da modal ShowPatientRequestComponent com as dimensões recomendadas', () => {
      const dummyRequest = { id: 111 } as PatientRequest;
      component['showPatientRequest'](dummyRequest);

      expect(dialogMock.open).toHaveBeenCalledWith(ShowPatientRequestComponent, {
        width: '1000px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { patient_request: dummyRequest }
      });
    });

    it('deve delegar a abertura da modal ShowOpinionComponent utilizando a função centralizada openDialog', () => {
      const dummyOpinion = { id: 9 } as Opinion;
      component['showOpinion'](dummyOpinion);

      expect(dialogMock.open).toHaveBeenCalledWith(ShowOpinionComponent, {
        width: '1200px',
        height: '700px',
        disableClose: true,
        autoFocus: false,
        data: { opinion: dummyOpinion }
      });
    });
  });
});