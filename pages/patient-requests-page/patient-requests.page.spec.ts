// src/app/tfd/pages/patient-requests-page/patient-requests.page.spec.ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientRequestsPage } from './patient-requests.page';
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientRequestArchiveComponent } from '../../components/patient-requests/patient-request-archive/patient-request-archive.component';
import { PatientRequestAttachmentsComponent } from '../../components/patient-requests/patient-request-attachments/patient-request-attachments.component';
import { PatientRequestDeleteComponent } from '../../components/patient-requests/patient-request-delete/patient-request-delete.component';
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestFinishBackComponent } from '../../components/patient-requests/patient-request-finish-back/patient-request-finish-back.component';
import { PatientRequestHaltedComponent } from '../../components/patient-requests/patient-request-halted/patient-request-halted.component';
import { PatientRequestMoveFromOthersComponent } from '../../components/patient-requests/patient-request-move-from-others/patient-request-move-from-others.component';
import { PatientRequestMoveFromProcessesComponent } from '../../components/patient-requests/patient-request-move-from-processes/patient-request-move-from-processes.component';
import { PatientRequestProcessComponent } from '../../components/patient-requests/patient-request-process/patient-request-process.component';
import { PatientRequestRequirementComponent } from '../../components/patient-requests/patient-request-requirement/patient-request-requirement.component';
import { PatientRequestUpdateComponent } from '../../components/patient-requests/patient-request-update/patient-request-update.component';
import { PatientRequest } from '../../models/patient-request.model';
import { TfdUser } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { PatientRequestService } from '../../services/patient-request.service';

class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
  }
}

describe('PatientRequestsPage', () => {
  let fixture: ComponentFixture<PatientRequestsPage>;
  let component: PatientRequestsPage;

  let channelMock: MockBroadcastChannel;
  let currentUserSignal: ReturnType<typeof signal<TfdUser | null>>;
  let getPatientRequestsMock: ReturnType<typeof vi.fn>;
  let dialogOpenMock: ReturnType<typeof vi.fn>;
  let loadingCloseMock: ReturnType<typeof vi.fn>;
  let afterClosed$: Subject<unknown>;

  const longPatientName = 'Maria Fernanda de Albuquerque Vasconcelos Cavalcanti';
  const truncatedLongName = `${longPatientName.slice(0, 32)} ...${longPatientName.slice(-5)}`;

  const sampleRequests = [
    {
      id: 1,
      owner: true,
      report: {
        patient_care: {
          patient: {
            name: longPatientName,
            cns: '123456789012345',
          },
        },
      },
    },
    {
      id: 2,
      owner: false,
      report: {
        patient_care: {
          patient: {
            name: 'João Silva',
            cns: '987654321098765',
          },
        },
      },
      owner_professional: {
        name: 'Dr. Carlos Eduardo Mendes',
      },
    },
    {
      id: 3,
      owner: false,
      report: {},
      owner_professional: {
        name: 'Coordenação',
      },
    },
    {
      id: 4,
      owner: true,
      report: {
        patient_care: {
          patient: {
            name: 'Ana',
          },
        },
      },
    },
  ] as unknown as PatientRequest[];

  async function initPage(
    requestsStream$: Observable<PatientRequest[] | null> = of(sampleRequests),
    userValue: TfdUser | null = {
      id: 1,
      roles: [
        {
          permissions: [
            { name: 'tfd/solicitação listar' },
            { name: 'solicitação editar' },
            { name: '' },
          ],
        },
        {},
      ],
    } as unknown as TfdUser
  ): Promise<void> {
    loadingCloseMock = vi.fn();
    afterClosed$ = new Subject<unknown>();

    channelMock = new MockBroadcastChannel('tfd-patient-requests-channel');
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return channelMock;
      })
    );

    currentUserSignal = signal<TfdUser | null>(userValue);
    getPatientRequestsMock = vi.fn(() => requestsStream$);
    dialogOpenMock = vi.fn((comp: unknown) => {
      if (comp === LoadingComponent) {
        return { close: loadingCloseMock };
      }
      return {
        afterClosed: () => afterClosed$.asObservable(),
      };
    });

    await TestBed.configureTestingModule({
      imports: [PatientRequestsPage],
      providers: [
        provideRouter([]),
        { provide: PatientRequestService, useValue: { getPatientRequests: getPatientRequestsMock } },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
      ],
    })
      .overrideComponent(PatientRequestsPage, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestsPage);
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

  it('deve inicializar canal, carregar e mapear solicitações (owner e others) com loading e fechar canal ao destruir', async () => {
    await initPage();

    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
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
      }),
      expect.objectContaining({
        id: 4,
        name: 'Ana',
        cns: '-',
      }),
    ]);

    expect(component['othersDataSource'].data).toEqual([
      expect.objectContaining({
        id: 2,
        name: 'João Silva',
        cns: '987654321098765',
        responsible: 'Dr. Mendes',
        fullResponsible: 'Dr. Carlos Eduardo Mendes',
      }),
      expect.objectContaining({
        id: 3,
        name: '-',
        cns: '-',
        responsible: 'Coordenação',
        fullResponsible: 'Coordenação',
      }),
    ]);

    fixture.destroy();
    expect(loadingCloseMock).toHaveBeenCalledTimes(2);
    expect(channelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve recarregar solicitações sem loading ao receber "update" no BroadcastChannel', async () => {
    await initPage();
    getPatientRequestsMock.mockClear();
    dialogOpenMock.mockClear();
    getPatientRequestsMock.mockImplementation(() => of([sampleRequests[0]]));

    channelMock.onmessage?.({ data: 'ignorar' } as MessageEvent<string>);
    expect(getPatientRequestsMock).not.toHaveBeenCalled();

    channelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(getPatientRequestsMock).toHaveBeenCalledTimes(1);
    expect(dialogOpenMock).not.toHaveBeenCalled();
    expect(component['ownerDataSource'].data).toHaveLength(1);
    expect(component['othersDataSource'].data).toHaveLength(0);
  });

  it('deve manter ownerDataSource e othersDataSource vazios quando getPatientRequests retornar null', async () => {
    await initPage(of(null));
    expect(component['ownerDataSource'].data).toEqual([]);
    expect(component['othersDataSource'].data).toEqual([]);
  });

  it('deve manter ownerDataSource e othersDataSource vazios quando getPatientRequests falhar', async () => {
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

    expect(component['checkPermissions']('solicitação listar')).toBe(false);
    expect(component['checkPermissions']('solicitação editar')).toBe(false);
    expect(component['checkPermissions']('solicitação excluir')).toBe(true);

    currentUserSignal.set({ id: 1, roles: [] } as unknown as TfdUser);
    expect(component['checkPermissions']('solicitação listar')).toBe(true);
  });

  describe('Ações da tabela', () => {
    const targetRequest = sampleRequests[0];

    beforeEach(async () => {
      await initPage();
      getPatientRequestsMock.mockClear();
      channelMock.postMessage.mockClear();
    });

    it('deve abrir modais sem refresh (detail, attachments) e não atualizar ao fechar', () => {
      component['patientRequestDetail'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestDetailComponent,
        expect.objectContaining({
          width: '1000px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { patient_request: targetRequest },
        })
      );

      component['patientRequestAttachments'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestAttachmentsComponent,
        expect.objectContaining({
          width: '600px',
          height: 'auto',
          data: { patient_request: targetRequest },
        })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getPatientRequestsMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir modais com refresh e atualizar ao confirmar', () => {
      component['patientRequestHalted'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestHaltedComponent,
        expect.objectContaining({ width: '400px', data: { patient_request: targetRequest } })
      );

      component['patientRequestArchive'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestArchiveComponent,
        expect.objectContaining({ width: '400px', data: { patient_request: targetRequest } })
      );

      component['patientRequestUpdate'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestUpdateComponent,
        expect.objectContaining({ width: '800px', data: { patient_request: targetRequest } })
      );

      component['patientRequestDelete'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestDeleteComponent,
        expect.objectContaining({ width: '400px', data: { patient_request: targetRequest } })
      );

      component['patientRequestProcess'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestProcessComponent,
        expect.objectContaining({ width: '500px', data: { patient_request: targetRequest } })
      );

      component['patientRequestMoveFromProcesses'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestMoveFromProcessesComponent,
        expect.objectContaining({ width: '400px', data: { patient_request: targetRequest } })
      );

      component['patientRequestMoveFromOthers'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestMoveFromOthersComponent,
        expect.objectContaining({ width: '400px', data: { patient_request: targetRequest } })
      );

      component['patientRequestFinishBack'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestFinishBackComponent,
        expect.objectContaining({ width: '400px', data: { patient_request: targetRequest } })
      );

      component['patientRequestRequirement'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestRequirementComponent,
        expect.objectContaining({ width: '500px', data: { patient_request: targetRequest } })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getPatientRequestsMock).toHaveBeenCalledTimes(9);
      expect(channelMock.postMessage).toHaveBeenCalledTimes(9);
      expect(channelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('não deve atualizar quando modal com refresh for cancelado', () => {
      component['patientRequestUpdate'](targetRequest);
      afterClosed$.next(false);
      afterClosed$.complete();

      expect(getPatientRequestsMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});