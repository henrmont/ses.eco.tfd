// src/app/tfd/components/patients/patient-report-detail/patient-report-detail.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { saveAs } from 'file-saver';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientReportDetailComponent } from './patient-report-detail.component';
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { Specialty } from '../../../enums/specialties';
import { PatientReport } from '../../../models/patient-report.model';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

describe('PatientReportDetailComponent', () => {
  let component: PatientReportDetailComponent;
  let fixture: ComponentFixture<PatientReportDetailComponent>;

  let storageServiceMock: {
    download: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };

  const sampleReport: PatientReport = {
    id: 15,
    protocol: 'PROT-777',
    specialty: Object.keys(Specialty)[0],
    diagnosis: 'Diagnóstico detalhado',
  } as unknown as PatientReport;

  async function createComponent(
    dialogData: { patient_report?: PatientReport } | null = {
      patient_report: { ...sampleReport },
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientReportDetailComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientReportDetailComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientReportDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.mocked(saveAs).mockClear();

    storageServiceMock = {
      download: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente, expor report e resolver specialtyLabel pelo enum', () => {
    const firstKey = Object.keys(Specialty)[0] as keyof typeof Specialty;

    expect(component).toBeTruthy();
    expect(component['downloadingArchiveId']()).toBeNull();
    expect(component['report']()?.id).toBe(15);
    expect(component['specialtyLabel']()).toBe(Specialty[firstKey]);
  });

  it('deve retornar string bruta ou "Não informado" em specialtyLabel e lidar com data nulo', async () => {
    await createComponent({
      patient_report: { specialty: 'ESPECIALIDADE_CUSTOM' } as unknown as PatientReport,
    });
    expect(component['specialtyLabel']()).toBe('ESPECIALIDADE_CUSTOM');

    await createComponent({
      patient_report: {} as unknown as PatientReport,
    });
    expect(component['specialtyLabel']()).toBe('Não informado');

    await createComponent(null);
    expect(component['report']()).toBeUndefined();
    expect(component['specialtyLabel']()).toBe('Não informado');
  });

  describe('Download de Anexo (download)', () => {
    it('deve ignorar quando archiveId for inválido ou já estiver em download', () => {
      component['download'](null, 'doc.pdf');
      component['download'](undefined, 'doc.pdf');
      component['download'](0, 'doc.pdf');
      expect(storageServiceMock.download).not.toHaveBeenCalled();

      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValueOnce(pending$.asObservable());

      component['download'](30, 'laudo.pdf');
      expect(component['downloadingArchiveId']()).toBe(30);

      component['download'](30, 'laudo.pdf');
      expect(storageServiceMock.download).toHaveBeenCalledTimes(1);

      pending$.complete();
      expect(component['downloadingArchiveId']()).toBeNull();
    });

    it('deve gerenciar downloadingArchiveId e chamar saveAs com nome informado ou padrão', () => {
      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValueOnce(pending$.asObservable());

      component['download'](41, 'relatorio.pdf');
      expect(component['downloadingArchiveId']()).toBe(41);
      expect(storageServiceMock.download).toHaveBeenCalledWith('tfd', 41);

      const blob = new Blob(['pdf']);
      pending$.next({ archive: blob });
      pending$.complete();

      expect(saveAs).toHaveBeenCalledWith(blob, 'relatorio.pdf');
      expect(component['downloadingArchiveId']()).toBeNull();

      const fallbackBlob = new Blob(['txt']);
      storageServiceMock.download.mockReturnValueOnce(of({ archive: fallbackBlob }));
      component['download'](42);
      expect(saveAs).toHaveBeenCalledWith(fallbackBlob, 'anexo-42');

      storageServiceMock.download.mockReturnValueOnce(of({}));
      component['download'](43, 'sem-arquivo.pdf');
      expect(saveAs).toHaveBeenCalledTimes(2);
    });

    it('deve exibir mensagem de erro da API ou fallback em caso de falha no download', () => {
      storageServiceMock.download.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Arquivo indisponível no storage.' } }))
      );
      component['download'](50, 'arq.pdf');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Arquivo indisponível no storage.'
      );
      expect(component['downloadingArchiveId']()).toBeNull();

      storageServiceMock.download.mockReturnValueOnce(
        throwError(() => new Error('Erro inesperado'))
      );
      component['download'](51, 'arq2.pdf');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao realizar o download do arquivo.'
      );
      expect(component['downloadingArchiveId']()).toBeNull();
    });
  });
});