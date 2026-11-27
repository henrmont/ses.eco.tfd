// src/app/tfd/pages/patients-page/patients.page.spec.ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientsPage } from './patients.page';
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientArchiveComponent } from '../../components/patients/patient-archive/patient-archive.component';
import { PatientDetailComponent } from '../../components/patients/patient-detail/patient-detail.component';
import { PatientEscortsComponent } from '../../components/patients/patient-escorts/patient-escorts.component';
import { PatientFinishBackComponent } from '../../components/patients/patient-finish-back/patient-finish-back.component';
import { PatientMoveFromOthersComponent } from '../../components/patients/patient-move-from-others/patient-move-from-others.component';
import { PatientReportsComponent } from '../../components/patients/patient-reports/patient-reports.component';
import { PatientRequirementComponent } from '../../components/patients/patient-requirement/patient-requirement.component';
import { PatientUpdateComponent } from '../../components/patients/patient-update/patient-update.component';
import { PatientValidateComponent } from '../../components/patients/patient-validate/patient-validate.component';
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

describe('PatientsPage', () => {
  let fixture: ComponentFixture<PatientsPage>;
  let component: PatientsPage;

  let channelMock: MockBroadcastChannel;
  let currentUserSignal: ReturnType<typeof signal<TfdUser | null>>;
  let getPatientsMock: ReturnType<typeof vi.fn>;
  let dialogOpenMock: ReturnType<typeof vi.fn>;
  let loadingCloseMock: ReturnType<typeof vi.fn>;
  let afterClosed$: Subject<unknown>;

  const longPatientName = 'Maria Fernanda de Albuquerque Vasconcelos Cavalcanti';
  const truncatedLongName = `${longPatientName.slice(0, 32)} ...${longPatientName.slice(-5)}`;

  const samplePatients = [
    {
      id: 1,
      owner: true,
      patient: {
        name: longPatientName,
        cns: '123456789012345',
        document: '12345678901',
        document_type: 'CPF',
      },
    },
    {
      id: 2,
      owner: false,
      patient: {
        name: 'João Silva',
        cns: '987654321098765',
        document: '98765432109',
        document_type: 'CPF',
      },
      user: {
        professional: {
          name: 'Dr. Carlos Eduardo Mendes',
        },
      },
    },
    {
      id: 3,
      owner: false,
      patient: {},
      user: {
        professional: {
          name: 'Coordenação',
        },
      },
    },
    {
      id: 4,
      owner: true,
      patient: {
        name: 'Ana',
      },
      user: {},
    },
  ] as unknown as PatientCare[];

  async function initPage(
    patientsStream$: Observable<PatientCare[] | null> = of(samplePatients),
    userValue: TfdUser | null = {
      id: 1,
      roles: [
        {
          permissions: [
            { name: 'tfd/paciente listar' },
            { name: 'paciente editar' },
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
    getPatientsMock = vi.fn(() => patientsStream$);
    dialogOpenMock = vi.fn((comp: unknown) => {
      if (comp === LoadingComponent) {
        return { close: loadingCloseMock };
      }
      return {
        afterClosed: () => afterClosed$.asObservable(),
      };
    });

    await TestBed.configureTestingModule({
      imports: [PatientsPage],
      providers: [
        provideRouter([]),
        { provide: PatientService, useValue: { getPatients: getPatientsMock } },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
      ],
    })
      .overrideComponent(PatientsPage, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientsPage);
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

  it('deve inicializar canal, carregar e mapear pacientes (owner e others) com loading e fechar canal ao destruir', async () => {
    await initPage();

    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(dialogOpenMock).toHaveBeenCalledWith(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
    expect(loadingCloseMock).toHaveBeenCalledTimes(1);

    expect(component['ownerDataSource'].data).toEqual([
      expect.objectContaining({
        id: 1,
        name: truncatedLongName,
        cns: '123456789012345',
        document: '12345678901',
        document_type: 'CPF',
      }),
      expect.objectContaining({
        id: 4,
        name: 'Ana',
        cns: '-',
        document: '-',
        document_type: '-',
      }),
    ]);

    expect(component['othersDataSource'].data).toEqual([
      expect.objectContaining({
        id: 2,
        name: 'João Silva',
        cns: '987654321098765',
        document: '98765432109',
        document_type: 'CPF',
        professional: 'Dr. Mendes',
      }),
      expect.objectContaining({
        id: 3,
        name: '-',
        cns: '-',
        document: '-',
        document_type: '-',
        professional: 'Coordenação',
      }),
    ]);

    fixture.destroy();
    expect(channelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve recarregar pacientes sem loading ao receber "update" no BroadcastChannel', async () => {
    await initPage();
    getPatientsMock.mockClear();
    dialogOpenMock.mockClear();
    getPatientsMock.mockImplementation(() => of([samplePatients[0]]));

    channelMock.onmessage?.({ data: 'ignorar' } as MessageEvent<string>);
    expect(getPatientsMock).not.toHaveBeenCalled();

    channelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(getPatientsMock).toHaveBeenCalledTimes(1);
    expect(dialogOpenMock).not.toHaveBeenCalled();
    expect(component['ownerDataSource'].data).toHaveLength(1);
    expect(component['othersDataSource'].data).toHaveLength(0);
  });

  it('deve manter ownerDataSource e othersDataSource vazios quando getPatients retornar null', async () => {
    await initPage(of(null));
    expect(component['ownerDataSource'].data).toEqual([]);
    expect(component['othersDataSource'].data).toEqual([]);
  });

  it('deve manter ownerDataSource e othersDataSource vazios quando getPatients falhar', async () => {
    await initPage(throwError(() => new Error('Falha na API')));
    expect(component['ownerDataSource'].data).toEqual([]);
    expect(component['othersDataSource'].data).toEqual([]);
  });

  it('deve filtrar owner e others, chamar firstPage nos paginators e avaliar permissões', async () => {
    await initPage();

    const ownerPaginatorMock = {
      firstPage: vi.fn(),
      page: of(),
      _change: of(),
      initialized: of(),
    } as unknown as MatPaginator;

    const othersPaginatorMock = {
      firstPage: vi.fn(),
      page: of(),
      _change: of(),
      initialized: of(),
    } as unknown as MatPaginator;

    component['ownerDataSource'].paginator = ownerPaginatorMock;
    component['othersDataSource'].paginator = othersPaginatorMock;

    component['applyOwnerFilter']({
      target: { value: '  MARIA FERNANDA  ' },
    } as unknown as Event);

    component['applyOthersFilter']({
      target: { value: '  JOÃO SILVA  ' },
    } as unknown as Event);

    expect(component['ownerDataSource'].filter).toBe('maria fernanda');
    expect(component['othersDataSource'].filter).toBe('joão silva');
    expect(ownerPaginatorMock.firstPage).toHaveBeenCalledTimes(1);
    expect(othersPaginatorMock.firstPage).toHaveBeenCalledTimes(1);

    expect(component['checkPermissions']('paciente listar')).toBe(false);
    expect(component['checkPermissions']('paciente editar')).toBe(false);
    expect(component['checkPermissions']('paciente excluir')).toBe(true);

    currentUserSignal.set({ id: 1, roles: [] } as unknown as TfdUser);
    expect(component['checkPermissions']('paciente listar')).toBe(true);
  });

  describe('Ações da tabela', () => {
    const targetPatientCare = samplePatients[0];

    beforeEach(async () => {
      await initPage();
      getPatientsMock.mockClear();
      channelMock.postMessage.mockClear();
    });

    it('deve abrir modais sem refresh (detail, escorts, reports) e não atualizar ao fechar', () => {
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

      component['patientEscorts'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientEscortsComponent,
        expect.objectContaining({
          width: '1200px',
          height: 'auto',
          data: { patient_care: targetPatientCare },
        })
      );

      component['patientReports'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientReportsComponent,
        expect.objectContaining({
          width: '1200px',
          height: 'auto',
          data: { patient_care: targetPatientCare },
        })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getPatientsMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir modais com refresh (update, archive, moveFromOthers, validate, finishBack, requirement) e atualizar ao confirmar', () => {
      component['patientUpdate'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientUpdateComponent,
        expect.objectContaining({
          width: '1200px',
          height: '700px',
          data: { patient_care: targetPatientCare },
        })
      );

      component['patientArchive'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientArchiveComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          data: { patient_care: targetPatientCare },
        })
      );

      component['patientMoveFromOthers'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientMoveFromOthersComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          data: { patient_care: targetPatientCare },
        })
      );

      component['patientValidate'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientValidateComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          data: { patient_care: targetPatientCare },
        })
      );

      component['patientFinishBack'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientFinishBackComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          data: { patient_care: targetPatientCare },
        })
      );

      component['patientRequirement'](targetPatientCare);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequirementComponent,
        expect.objectContaining({
          width: '500px',
          height: 'auto',
          data: { patient_care: targetPatientCare },
        })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getPatientsMock).toHaveBeenCalledTimes(6);
      expect(channelMock.postMessage).toHaveBeenCalledTimes(6);
      expect(channelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('não deve atualizar quando modal com refresh for cancelado', () => {
      component['patientUpdate'](targetPatientCare);
      afterClosed$.next(false);
      afterClosed$.complete();

      expect(getPatientsMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});