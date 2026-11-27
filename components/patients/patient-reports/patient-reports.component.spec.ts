// src/app/tfd/components/patients/patient-reports/patient-reports.component.spec.ts
import { Overlay } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientReportDialogData,
  PatientReportsComponent,
} from './patient-reports.component';
import { MessageService } from '../../../../core/services/message.service';
import { Specialty } from '../../../enums/specialties';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientService } from '../../../services/patient.service';
import { PatientReportCreateComponent } from '../patient-report-create/patient-report-create.component';
import { PatientReportDeleteComponent } from '../patient-report-delete/patient-report-delete.component';
import { PatientReportDetailComponent } from '../patient-report-detail/patient-report-detail.component';
import { PatientReportUpdateComponent } from '../patient-report-update/patient-report-update.component';
import { ReportAttachmentsComponent } from '../report-attachments/report-attachments.component';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
}

describe('PatientReportsComponent', () => {
  let component: PatientReportsComponent;
  let fixture: ComponentFixture<PatientReportsComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    getPatientReports: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogMock: {
    open: ReturnType<typeof vi.fn>;
  };
  let noopScrollStrategyMock: Record<string, never>;
  let overlayMock: {
    scrollStrategies: { noop: ReturnType<typeof vi.fn> };
  };

  const sampleReport: PatientReport = {
    id: 11,
    protocol: 'PROT-001',
    specialty: Object.keys(Specialty)[0],
    cid: { id: 3, code: 'J18.9', name: 'Pneumonia' },
    lawsuit: false,
  } as unknown as PatientReport;

  const baseDialogData: PatientReportDialogData = {
    patient_care: { id: 64 } as unknown as PatientCare,
  };

  async function createComponent(
    dialogData: PatientReportDialogData | null = {
      patient_care: { ...baseDialogData.patient_care } as unknown as PatientCare,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientReportsComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: Overlay, useValue: overlayMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientReportsComponent, {
        set: {
          template: '',
          providers: [{ provide: MatDialog, useValue: dialogMock }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientReportsComponent);
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
      getPatientReports: vi.fn().mockReturnValue(of([sampleReport])),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    noopScrollStrategyMock = {};
    overlayMock = {
      scrollStrategies: {
        noop: vi.fn(() => noopScrollStrategyMock),
      },
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

  it('deve criar o componente, abrir o BroadcastChannel e carregar os laudos do paciente', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(patientServiceMock.getPatientReports).toHaveBeenCalledWith(64);
    expect(component['isLoading']()).toBe(false);
    expect(component['reports']()).toEqual([sampleReport]);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve lidar com ausência de patient_care.id e com erro no getPatientReports', async () => {
    patientServiceMock.getPatientReports.mockClear();
    await createComponent(null);
    expect(patientServiceMock.getPatientReports).not.toHaveBeenCalled();
    expect(component['isLoading']()).toBe(false);

    patientServiceMock.getPatientReports.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Falha específica ao buscar laudos.' } }))
    );
    await createComponent({ patient_care: { id: 65 } as unknown as PatientCare });
    expect(component['reports']()).toEqual([]);
    expect(component['isLoading']()).toBe(false);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Falha específica ao buscar laudos.'
    );

    patientServiceMock.getPatientReports.mockReturnValueOnce(
      throwError(() => new Error('Erro de rede'))
    );
    await createComponent({ patient_care: { id: 66 } as unknown as PatientCare });
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Não foi possível carregar os laudos do paciente.'
    );
  });

  it('deve atualizar a lista quando receber mensagem "update" no BroadcastChannel', () => {
    patientServiceMock.getPatientReports.mockClear();
    const updatedReports = [
      sampleReport,
      { id: 12, protocol: 'PROT-002' } as unknown as PatientReport,
    ];
    patientServiceMock.getPatientReports.mockReturnValueOnce(of(updatedReports));

    broadcastChannelMock.onmessage?.({ data: 'ignorar' } as MessageEvent<string>);
    expect(patientServiceMock.getPatientReports).not.toHaveBeenCalled();

    broadcastChannelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(patientServiceMock.getPatientReports).toHaveBeenCalledWith(64);
    expect(component['reports']()).toEqual(updatedReports);
  });

  describe('Formatação de Especialidade e CID', () => {
    it('deve resolver rótulo da especialidade pelo enum, manter chave avulsa ou usar fallback', () => {
      const firstKey = Object.keys(Specialty)[0] as keyof typeof Specialty;
      expect(component['getSpecialtyLabel'](firstKey)).toBe(Specialty[firstKey]);
      expect(component['getSpecialtyLabel']('OUTRA_ESPECIALIDADE')).toBe('OUTRA_ESPECIALIDADE');
      expect(component['getSpecialtyLabel'](null)).toBe('Não informada');
      expect(component['getSpecialtyLabel'](undefined)).toBe('Não informada');
    });

    it('deve formatar rótulo do CID conforme code e name presentes', () => {
      expect(
        component['getCidLabel']({ cid: { code: '  E11  ', name: '  Diabetes  ' } } as PatientReport)
      ).toBe('E11 - Diabetes');
      expect(component['getCidLabel']({ cid: { code: ' I10 ' } } as PatientReport)).toBe('I10');
      expect(component['getCidLabel']({ cid: { name: ' Asma ' } } as PatientReport)).toBe('Asma');
      expect(component['getCidLabel']({} as PatientReport)).toBe('Não informado');
    });
  });

  describe('Ações de Diálogos', () => {
    it('deve abrir diálogos de detalhe e anexos sem recarregar quando fechados', () => {
      patientServiceMock.getPatientReports.mockClear();
      dialogMock.open.mockReturnValueOnce({ afterClosed: () => of(true) });

      component['patientReportDetail'](sampleReport);
      expect(dialogMock.open).toHaveBeenCalledWith(
        PatientReportDetailComponent,
        expect.objectContaining({
          width: '800px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: noopScrollStrategyMock,
          data: { patient_care: baseDialogData.patient_care, patient_report: sampleReport },
        })
      );
      expect(patientServiceMock.getPatientReports).not.toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();

      dialogMock.open.mockReturnValueOnce({ afterClosed: () => of(true) });
      component['reportAttachments'](sampleReport);
      expect(dialogMock.open).toHaveBeenCalledWith(
        ReportAttachmentsComponent,
        expect.objectContaining({ width: '600px' })
      );
      expect(patientServiceMock.getPatientReports).not.toHaveBeenCalled();
    });

    it('deve abrir diálogos de criação, edição e exclusão e atualizar lista/canal ao confirmar', () => {
      const pendingRefresh$ = new Subject<PatientReport[]>();
      patientServiceMock.getPatientReports.mockReturnValueOnce(pendingRefresh$.asObservable());
      dialogMock.open.mockReturnValueOnce({ afterClosed: () => of(true) });

      component['patientReportCreate']();
      expect(dialogMock.open).toHaveBeenCalledWith(
        PatientReportCreateComponent,
        expect.objectContaining({
          width: '800px',
          data: { patient_care: baseDialogData.patient_care },
        })
      );
      expect(component['isLoading']()).toBe(false);

      pendingRefresh$.next([sampleReport]);
      pendingRefresh$.complete();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');

      dialogMock.open.mockReturnValueOnce({ afterClosed: () => of(false) });
      component['patientReportUpdate'](sampleReport);
      expect(dialogMock.open).toHaveBeenCalledWith(
        PatientReportUpdateComponent,
        expect.objectContaining({
          width: '800px',
          data: { patient_care: baseDialogData.patient_care, patient_report: sampleReport },
        })
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledTimes(1);

      dialogMock.open.mockReturnValueOnce({ afterClosed: () => of(true) });
      component['patientReportDelete'](sampleReport);
      expect(dialogMock.open).toHaveBeenCalledWith(
        PatientReportDeleteComponent,
        expect.objectContaining({
          width: '400px',
          data: { patient_care: baseDialogData.patient_care, patient_report: sampleReport },
        })
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledTimes(2);
    });
  });
});