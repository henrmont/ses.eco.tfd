// src/app/tfd/pages/archive-patients-page/archive-patients.page.spec.ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ArchivePatientsPage } from './archive-patients.page';
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientDetailComponent } from '../../components/patients/patient-detail/patient-detail.component';
import { PatientMoveFromArchiveComponent } from '../../components/patients/patient-move-from-archive/patient-move-from-archive.component';
import { PatientRequirementComponent } from '../../components/patients/patient-requirement/patient-requirement.component';
import { PatientCare } from '../../models/patient-care.model';
import { TfdUser } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { PatientService } from '../../services/patient.service';

class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
  }
}

describe('ArchivePatientsPage', () => {
  let fixture: ComponentFixture<ArchivePatientsPage>;
  let component: ArchivePatientsPage;

  let channelMock: MockBroadcastChannel;
  let currentUserSignal: ReturnType<typeof signal<TfdUser | null>>;
  let getArchivePatientsMock: ReturnType<typeof vi.fn>;
  let dialogOpenMock: ReturnType<typeof vi.fn>;
  let loadingCloseMock: ReturnType<typeof vi.fn>;
  let afterClosed$: Subject<unknown>;

  const longPatientName = 'Maria Fernanda de Albuquerque Vasconcelos Cavalcanti';
  const truncatedLongName = `${longPatientName.slice(0, 32)}...${longPatientName.slice(-5)}`;

  const sampleArchivedPatients = [
    {
      id: 1,
      patient: {
        name: longPatientName,
        cns: '123456789012345',
        document: '12345678901',
        document_type: 'CPF',
      },
      user: {
        professional: {
          name: 'Dr. Carlos Eduardo Mendes',
        },
      },
    },
    {
      id: 2,
      patient: {
        name: 'João Silva',
        cns: '987654321098765',
        document: '98765432109',
        document_type: 'CPF',
      },
      user: {
        professional: {
          name: 'Coordenação',
        },
      },
    },
    {
      id: 3,
      patient: {},
      user: {},
    },
  ] as unknown as PatientCare[];

  async function initPage(
    patientsStream$: Observable<PatientCare[] | null> = of(sampleArchivedPatients),
    userValue: TfdUser | null = {
      id: 1,
      roles: [
        {
          permissions: [
            { name: 'tfd/paciente arquivado listar' },
            { name: 'paciente desarquivar' },
            { name: '' },
          ],
        },
        {},
      ],
    } as unknown as TfdUser
  ): Promise<void> {
    loadingCloseMock = vi.fn();
    afterClosed$ = new Subject<unknown>();

    channelMock = new MockBroadcastChannel('tfd-patients-channel');
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return channelMock;
      })
    );

    currentUserSignal = signal<TfdUser | null>(userValue);
    getArchivePatientsMock = vi.fn(() => patientsStream$);
    dialogOpenMock = vi.fn((comp: unknown) => {
      if (comp === LoadingComponent) {
        return { close: loadingCloseMock };
      }
      return {
        afterClosed: () => afterClosed$.asObservable(),
      };
    });

    await TestBed.configureTestingModule({
      imports: [ArchivePatientsPage],
      providers: [
        provideRouter([]),
        { provide: PatientService, useValue: { getArchivePatients: getArchivePatientsMock } },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
      ],
    })
      .overrideComponent(ArchivePatientsPage, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ArchivePatientsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    fixture?.destroy();
    afterClosed$?.complete();
    vi.unstubAllGlobals();
  });

  it('deve inicializar canal, carregar e mapear pacientes arquivados com loading e fechar canal ao destruir', async () => {
    await initPage();

    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(dialogOpenMock).toHaveBeenCalledWith(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
    expect(loadingCloseMock).toHaveBeenCalledTimes(1);

    expect(component['archivedDataSource'].data).toEqual([
      expect.objectContaining({
        id: 1,
        name: truncatedLongName,
        cns: '123456789012345',
        document: '12345678901',
        document_type: 'CPF',
        responsible: 'Dr. Mendes',
      }),
      expect.objectContaining({
        id: 2,
        name: 'João Silva',
        cns: '987654321098765',
        document: '98765432109',
        document_type: 'CPF',
        responsible: 'Coordenação',
      }),
      expect.objectContaining({
        id: 3,
        name: '-',
        cns: '-',
        document: '-',
        document_type: '-',
        responsible: '-',
      }),
    ]);

    fixture.destroy();
    expect(channelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve recarregar pacientes arquivados sem loading ao receber "update" no BroadcastChannel', async () => {
    await initPage();
    getArchivePatientsMock.mockClear();
    dialogOpenMock.mockClear();
    getArchivePatientsMock.mockImplementation(() => of([sampleArchivedPatients[1]]));

    channelMock.onmessage?.({ data: 'ignorar' } as MessageEvent<string>);
    expect(getArchivePatientsMock).not.toHaveBeenCalled();

    channelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(getArchivePatientsMock).toHaveBeenCalledTimes(1);
    expect(dialogOpenMock).not.toHaveBeenCalled();
    expect(component['archivedDataSource'].data).toHaveLength(1);
  });

  it('deve manter archivedDataSource vazio quando getArchivePatients retornar null', async () => {
    await initPage(of(null));
    expect(component['archivedDataSource'].data).toEqual([]);
  });

  it('deve manter archivedDataSource vazio quando getArchivePatients falhar', async () => {
    await initPage(throwError(() => new Error('Falha na API')));
    expect(component['archivedDataSource'].data).toEqual([]);
  });

  it('deve filtrar archivedDataSource, chamar firstPage no paginator e avaliar permissões', async () => {
    await initPage();

    const paginatorMock = {
      firstPage: vi.fn(),
      page: of(),
      _change: of(),
      initialized: of(),
    } as unknown as MatPaginator;
    component['archivedDataSource'].paginator = paginatorMock;

    component['applyFilter']({
      target: { value: '  MARIA FERNANDA  ' },
    } as unknown as Event);

    expect(component['archivedDataSource'].filter).toBe('maria fernanda');
    expect(paginatorMock.firstPage).toHaveBeenCalledTimes(1);

    expect(component['checkPermissions']('paciente arquivado listar')).toBe(false);
    expect(component['checkPermissions']('paciente desarquivar')).toBe(false);
    expect(component['checkPermissions']('paciente excluir')).toBe(true);

    currentUserSignal.set({ id: 1, roles: [] } as unknown as TfdUser);
    expect(component['checkPermissions']('paciente arquivado listar')).toBe(true);
  });

  describe('Ações da tabela', () => {
    const targetPatientCare = sampleArchivedPatients[0];

    beforeEach(async () => {
      await initPage();
      getArchivePatientsMock.mockClear();
      channelMock.postMessage.mockClear();
    });

    it('deve abrir modal de detalhe (1200px x 700px) sem atualizar ao fechar', () => {
      component['patientDetail'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientDetailComponent,
        expect.objectContaining({
          width: '1200px',
          height: '700px',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { patient_care: targetPatientCare },
        })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getArchivePatientsMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir modais com refresh (moveFromArchive em 400px e requirement em 500px) e atualizar ao confirmar', () => {
      component['patientMoveFromArchive'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientMoveFromArchiveComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { patient_care: targetPatientCare },
        })
      );

      component['patientRequirement'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequirementComponent,
        expect.objectContaining({
          width: '500px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { patient_care: targetPatientCare },
        })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getArchivePatientsMock).toHaveBeenCalledTimes(2);
      expect(channelMock.postMessage).toHaveBeenCalledTimes(2);
      expect(channelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('não deve atualizar quando modal com refresh for cancelado', () => {
      component['patientMoveFromArchive'](targetPatientCare);
      afterClosed$.next(false);
      afterClosed$.complete();

      expect(getArchivePatientsMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});