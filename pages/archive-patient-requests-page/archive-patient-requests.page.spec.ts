// src/app/tfd/pages/archive-patient-requests-page/archive-patient-requests.page.spec.ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ArchivePatientRequestsPage } from './archive-patient-requests.page';
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestMoveFromArchiveComponent } from '../../components/patient-requests/patient-request-move-from-archive/patient-request-move-from-archive.component';
import { PatientRequestRequirementComponent } from '../../components/patient-requests/patient-request-requirement/patient-request-requirement.component';
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

describe('ArchivePatientRequestsPage', () => {
  let fixture: ComponentFixture<ArchivePatientRequestsPage>;
  let component: ArchivePatientRequestsPage;

  let channelMock: MockBroadcastChannel;
  let currentUserSignal: ReturnType<typeof signal<TfdUser | null>>;
  let getArchivePatientRequestsMock: ReturnType<typeof vi.fn>;
  let dialogOpenMock: ReturnType<typeof vi.fn>;
  let loadingCloseMock: ReturnType<typeof vi.fn>;
  let afterClosed$: Subject<unknown>;

  const longPatientName = 'Maria Fernanda de Albuquerque Vasconcelos Cavalcanti';
  const truncatedLongName = `${longPatientName.slice(0, 32)}...${longPatientName.slice(-5)}`;

  const sampleArchivedRequests = [
    {
      id: 1,
      report: {
        patient_care: {
          patient: {
            name: longPatientName,
            cns: '123456789012345',
            document: '12345678901',
            document_type: 'CPF',
          },
        },
      },
      owner_professional: {
        name: 'Dr. Carlos Eduardo Mendes',
      },
    },
    {
      id: 2,
      report: {
        patient_care: {
          patient: {
            name: 'João Silva',
            cns: '987654321098765',
            document: '98765432109',
            document_type: 'CPF',
          },
        },
      },
      owner_professional: {
        name: 'Coordenação',
      },
    },
    {
      id: 3,
      report: {},
    },
  ] as unknown as PatientRequest[];

  async function initPage(
    requestsStream$: Observable<PatientRequest[] | null> = of(sampleArchivedRequests),
    userValue: TfdUser | null = {
      id: 1,
      roles: [
        {
          permissions: [
            { name: 'tfd/solicitação arquivada listar' },
            { name: 'solicitação desarquivar' },
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
    getArchivePatientRequestsMock = vi.fn(() => requestsStream$);
    dialogOpenMock = vi.fn((comp: unknown) => {
      if (comp === LoadingComponent) {
        return { close: loadingCloseMock };
      }
      return {
        afterClosed: () => afterClosed$.asObservable(),
      };
    });

    await TestBed.configureTestingModule({
      imports: [ArchivePatientRequestsPage],
      providers: [
        provideRouter([]),
        {
          provide: PatientRequestService,
          useValue: { getArchivePatientRequests: getArchivePatientRequestsMock },
        },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
      ],
    })
      .overrideComponent(ArchivePatientRequestsPage, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ArchivePatientRequestsPage);
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

  it('deve inicializar canal, carregar e mapear solicitações arquivadas com loading e fechar canal ao destruir', async () => {
    await initPage();

    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
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
        fullResponsible: 'Dr. Carlos Eduardo Mendes',
      }),
      expect.objectContaining({
        id: 2,
        name: 'João Silva',
        cns: '987654321098765',
        document: '98765432109',
        document_type: 'CPF',
        responsible: 'Coordenação',
        fullResponsible: 'Coordenação',
      }),
      expect.objectContaining({
        id: 3,
        name: '-',
        cns: '-',
        document: '-',
        document_type: '-',
        responsible: '-',
        fullResponsible: '-',
      }),
    ]);

    fixture.destroy();
    expect(loadingCloseMock).toHaveBeenCalledTimes(2);
    expect(channelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve recarregar solicitações arquivadas sem loading ao receber "update" no BroadcastChannel', async () => {
    await initPage();
    getArchivePatientRequestsMock.mockClear();
    dialogOpenMock.mockClear();
    getArchivePatientRequestsMock.mockImplementation(() => of([sampleArchivedRequests[1]]));

    channelMock.onmessage?.({ data: 'ignorar' } as MessageEvent<string>);
    expect(getArchivePatientRequestsMock).not.toHaveBeenCalled();

    channelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(getArchivePatientRequestsMock).toHaveBeenCalledTimes(1);
    expect(dialogOpenMock).not.toHaveBeenCalled();
    expect(component['archivedDataSource'].data).toHaveLength(1);
  });

  it('deve manter archivedDataSource vazio quando getArchivePatientRequests retornar null', async () => {
    await initPage(of(null));
    expect(component['archivedDataSource'].data).toEqual([]);
  });

  it('deve manter archivedDataSource vazio quando getArchivePatientRequests falhar', async () => {
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

    expect(component['checkPermissions']('solicitação arquivada listar')).toBe(false);
    expect(component['checkPermissions']('solicitação desarquivar')).toBe(false);
    expect(component['checkPermissions']('solicitação excluir')).toBe(true);

    currentUserSignal.set({ id: 1, roles: [] } as unknown as TfdUser);
    expect(component['checkPermissions']('solicitação arquivada listar')).toBe(true);
  });

  describe('Ações da tabela', () => {
    const targetRequest = sampleArchivedRequests[0];

    beforeEach(async () => {
      await initPage();
      getArchivePatientRequestsMock.mockClear();
      channelMock.postMessage.mockClear();
    });

    it('deve abrir modal de detalhe (1200px x 700px) sem atualizar ao fechar', () => {
      component['patientRequestDetail'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestDetailComponent,
        expect.objectContaining({
          width: '1200px',
          height: '700px',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { patient_request: targetRequest },
        })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getArchivePatientRequestsMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir modais com refresh (moveFromArchive em 400px e requirement em 500px) e atualizar ao confirmar', () => {
      component['patientRequestMoveFromArchive'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestMoveFromArchiveComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { patient_request: targetRequest },
        })
      );

      component['patientRequestRequirement'](targetRequest);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        PatientRequestRequirementComponent,
        expect.objectContaining({
          width: '500px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { patient_request: targetRequest },
        })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getArchivePatientRequestsMock).toHaveBeenCalledTimes(2);
      expect(channelMock.postMessage).toHaveBeenCalledTimes(2);
      expect(channelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('não deve atualizar quando modal com refresh for cancelado', () => {
      component['patientRequestMoveFromArchive'](targetRequest);
      afterClosed$.next(false);
      afterClosed$.complete();

      expect(getArchivePatientRequestsMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});