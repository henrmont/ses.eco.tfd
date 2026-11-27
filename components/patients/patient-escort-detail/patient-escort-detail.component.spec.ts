// src/app/tfd/components/patients/patient-escort-detail/patient-escort-detail.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { saveAs } from 'file-saver';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientEscortDetailComponent } from './patient-escort-detail.component';
import { StorageService } from '../../../../core/services/storage.service';
import { PatientEscort } from '../../../models/patient-escort.model';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

interface PatientEscortDetailDialogData {
  patient_escort?: PatientEscort;
}

describe('PatientEscortDetailComponent', () => {
  let component: PatientEscortDetailComponent;
  let fixture: ComponentFixture<PatientEscortDetailComponent>;

  let storageServiceMock: {
    download: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientEscortDetailDialogData | null;

  const baseEscort: PatientEscort = {
    id: 42,
    name: 'Rafael Mendes',
    cns: '123456789012345',
    document: '12345678901',
    birth_date: '1992-04-08',
  } as unknown as PatientEscort;

  async function createComponent(
    dialogData: PatientEscortDetailDialogData | null = {
      patient_escort: { ...baseEscort },
    }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientEscortDetailComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientEscortDetailComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientEscortDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.mocked(saveAs).mockClear();

    storageServiceMock = {
      download: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente, expor escort e formatar data de nascimento para DD/MM/YYYY', () => {
    expect(component).toBeTruthy();
    expect(component['isDownloading']()).toBe(false);
    expect(component['escort']()).toEqual(baseEscort);
    expect(component['formattedBirthDate']()).toBe('08/04/1992');
  });

  describe('Signals escort e formattedBirthDate', () => {
    it('deve retornar escort como null e formattedBirthDate como "Não informado" quando ausente', async () => {
      await createComponent(null);

      expect(component['escort']()).toBeNull();
      expect(component['formattedBirthDate']()).toBe('Não informado');
    });

    it('deve formatar datas ISO com timestamp e retornar "Não informado" para formato inválido', async () => {
      await createComponent({
        patient_escort: {
          ...baseEscort,
          birth_date: '1988-11-05T03:00:00.000Z',
        } as unknown as PatientEscort,
      });
      expect(component['formattedBirthDate']()).toBe('05/11/1988');

      await createComponent({
        patient_escort: {
          ...baseEscort,
          birth_date: 'data-invalida',
        } as unknown as PatientEscort,
      });
      expect(component['formattedBirthDate']()).toBe('Não informado');
    });
  });

  describe('Download de Anexo (download)', () => {
    it('não deve chamar storageService.download quando archiveId for inválido ou já estiver baixando', () => {
      component['download'](null, 'cns.pdf');
      component['download'](undefined, 'cns.pdf');
      component['download'](0, 'cns.pdf');
      expect(storageServiceMock.download).not.toHaveBeenCalled();

      component['isDownloading'].set(true);
      component['download'](10, 'cns.pdf');
      expect(storageServiceMock.download).not.toHaveBeenCalled();
    });

    it('deve baixar o arquivo, chamar saveAs e reverter isDownloading ao concluir', () => {
      const blob = new Blob(['conteudo'], { type: 'application/pdf' });
      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValue(pending$.asObservable());

      component['download'](77, 'documento.pdf');
      expect(component['isDownloading']()).toBe(true);
      expect(storageServiceMock.download).toHaveBeenCalledWith('tfd', 77);

      pending$.next({ archive: blob });
      pending$.complete();
      fixture.detectChanges();

      expect(saveAs).toHaveBeenCalledWith(blob, 'documento.pdf');
      expect(component['isDownloading']()).toBe(false);
    });

    it('não deve chamar saveAs quando response não contiver archive', () => {
      storageServiceMock.download.mockReturnValue(of({}));

      component['download'](77, 'documento.pdf');
      fixture.detectChanges();

      expect(saveAs).not.toHaveBeenCalled();
      expect(component['isDownloading']()).toBe(false);
    });
  });
});