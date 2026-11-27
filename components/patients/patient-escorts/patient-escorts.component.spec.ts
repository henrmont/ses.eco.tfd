// src/app/tfd/components/patients/patient-escorts/patient-escorts.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientEscortDialogData,
  PatientEscortsComponent,
} from './patient-escorts.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientEscortsComponent', () => {
  let component: PatientEscortsComponent;
  let fixture: ComponentFixture<PatientEscortsComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    getPatientEscorts: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogMock: {
    open: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientEscortDialogData | null;

  const baseCare: PatientCare = {
    id: 99,
  } as unknown as PatientCare;

  const sampleEscorts: PatientEscort[] = [
    {
      id: 1,
      name: 'Ana Clara',
      document: '12345678901',
      cns: '123456789012345',
    } as unknown as PatientEscort,
    {
      id: 2,
      name: 'Nome Muito Longo De Acompanhante Para Testar Truncamento',
      document: '98765432100',
      cns: '987654321098765',
    } as unknown as PatientEscort,
    {
      id: 3,
      name: '   ',
      document: '11122233344',
      cns: '111222333444555',
    } as unknown as PatientEscort,
  ];

  function mockDialogAfterClosed(result: unknown): void {
    dialogMock.open.mockReturnValueOnce({
      afterClosed: () => of(result),
    });
  }

  async function createComponent(
    dialogData: PatientEscortDialogData | null = { patient_care: baseCare }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientEscortsComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientEscortsComponent, {
        set: {
          template: '',
          providers: [{ provide: MatDialog, useValue: dialogMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientEscortsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    broadcastChannelMock = new MockBroadcastChannel();
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return broadcastChannelMock;
      })
    );

    patientServiceMock = {
      getPatientEscorts: vi.fn().mockReturnValue(of(sampleEscorts)),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogMock = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(false),
      }),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e carregar acompanhantes formatados', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isLoading']()).toBe(false);
    expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledWith(99);
    expect(component['dataSource'].data).toHaveLength(3);

    expect(component['dataSource'].data[0]).toMatchObject({
      id: 1,
      name: 'Ana Clara',
      fullName: 'Ana Clara',
    });

    expect(component['dataSource'].data[1]).toMatchObject({
      id: 2,
      name: 'Nome Muito Longo De Acompanhan ...mento',
      fullName: 'Nome Muito Longo De Acompanhante Para Testar Truncamento',
    });

    expect(component['dataSource'].data[2]).toMatchObject({
      id: 3,
      name: 'Não informado',
      fullName: 'Não informado',
    });
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve encerrar isLoading sem chamar getPatientEscorts quando patient_care.id não existir', async () => {
    patientServiceMock.getPatientEscorts.mockClear();

    await createComponent(null);

    expect(component['isLoading']()).toBe(false);
    expect(patientServiceMock.getPatientEscorts).not.toHaveBeenCalled();
  });

  it('deve atualizar isLoading durante requisição pendente e tratar erro com mensagem da API ou fallback', async () => {
    const pending$ = new Subject<PatientEscort[]>();
    patientServiceMock.getPatientEscorts.mockReturnValueOnce(pending$.asObservable());

    await createComponent();
    expect(component['isLoading']()).toBe(true);

    pending$.next([sampleEscorts[0]]);
    pending$.complete();
    expect(component['isLoading']()).toBe(false);
    expect(component['dataSource'].data).toHaveLength(1);

    patientServiceMock.getPatientEscorts.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Falha ao buscar acompanhantes.' } }))
    );
    component['fetchPatientEscorts'](true);
    expect(component['dataSource'].data).toEqual([]);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Falha ao buscar acompanhantes.'
    );

    patientServiceMock.getPatientEscorts.mockReturnValueOnce(
      throwError(() => new Error('Erro genérico'))
    );
    component['fetchPatientEscorts'](false);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Erro ao carregar os acompanhantes do paciente.'
    );
  });

  it('deve recarregar a lista quando BroadcastChannel receber mensagem "update" e ignorar outras', () => {
    patientServiceMock.getPatientEscorts.mockClear();

    broadcastChannelMock.onmessage?.({ data: 'outro-evento' } as MessageEvent<string>);
    expect(patientServiceMock.getPatientEscorts).not.toHaveBeenCalled();

    broadcastChannelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledTimes(1);
    expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledWith(99);
  });

  describe('Ações e Diálogos', () => {
    it('deve abrir diálogo de detalhe sem disparar refresh mesmo com resultado positivo', () => {
      mockDialogAfterClosed(true);
      patientServiceMock.getPatientEscorts.mockClear();

      const row = component['dataSource'].data[2];
      component['patientEscortDetail'](row);

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          width: '800px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          data: {
            patient_escort: expect.objectContaining({
              id: 3,
              name: '',
            }),
          },
        })
      );
      expect(patientServiceMock.getPatientEscorts).not.toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir diálogo de requisitos sem refresh', () => {
      const row = component['dataSource'].data[0];
      component['patientEscortRequirement'](row);

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          width: '500px',
          height: 'auto',
          data: {
            patient_escort: expect.objectContaining({
              id: 1,
              name: 'Ana Clara',
            }),
          },
        })
      );
    });

    it('deve abrir diálogo de criação e recarregar/notificar canal quando fechado com true', () => {
      mockDialogAfterClosed(true);
      patientServiceMock.getPatientEscorts.mockClear();

      component['patientEscortCreate']();

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          width: '800px',
          data: { patient_care: baseCare },
        })
      );
      expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledWith(99);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve abrir diálogo de atualização e não atualizar quando fechado com false', () => {
      mockDialogAfterClosed(false);
      patientServiceMock.getPatientEscorts.mockClear();

      const row = component['dataSource'].data[1];
      component['patientEscortUpdate'](row);

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          width: '800px',
          data: {
            patient_care: baseCare,
            patient_escort: expect.objectContaining({
              id: 2,
              name: 'Nome Muito Longo De Acompanhante Para Testar Truncamento',
            }),
          },
        })
      );
      expect(patientServiceMock.getPatientEscorts).not.toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir diálogo de exclusão com largura 400px e atualizar quando confirmado', () => {
      mockDialogAfterClosed(true);
      patientServiceMock.getPatientEscorts.mockClear();

      const row = component['dataSource'].data[0];
      component['patientEscortDelete'](row);

      expect(dialogMock.open).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          data: {
            patient_care: baseCare,
            patient_escort: expect.objectContaining({ id: 1, name: 'Ana Clara' }),
          },
        })
      );
      expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledWith(99);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
    });
  });
});