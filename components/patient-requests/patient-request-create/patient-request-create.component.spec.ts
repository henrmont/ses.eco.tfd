// src/app/tfd/components/patient-requests/patient-request-create/patient-request-create.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import moment, { Moment } from 'moment';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientCareOption,
  PatientRequestCreateComponent,
} from './patient-request-create.component';
import { MessageService } from '../../../../core/services/message.service';
import { HospitalUnity } from '../../../models/hospital-unity.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientRequestService } from '../../../services/patient-request.service';

interface OptionItem {
  id?: number;
  name?: string;
  code?: string;
  lawsuit?: boolean;
  has_entrance_or_lawsuit?: boolean;
  has_entrance_or_lawsuit_finished?: boolean;
  [key: string]: unknown;
}

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestCreateComponent', () => {
  let component: PatientRequestCreateComponent;
  let fixture: ComponentFixture<PatientRequestCreateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    getPatients: ReturnType<typeof vi.fn>;
    getReports: ReturnType<typeof vi.fn>;
    getHospitalUnities: ReturnType<typeof vi.fn>;
    createPatientRequest: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const samplePatients: PatientCareOption[] = [
    {
      id: 1,
      name: 'Ana Silva',
      status: true,
      is_valid: true,
      patient: { name: 'Ana Silva' },
    } as PatientCareOption,
    {
      id: 2,
      name: 'Inativo',
      status: false,
      is_valid: true,
      patient: { name: 'Inativo' },
    } as PatientCareOption,
    {
      id: 3,
      name: 'Inválido',
      status: true,
      is_valid: false,
      patient: { name: 'Inválido' },
    } as PatientCareOption,
  ];

  const sampleReports: OptionItem[] = [
    {
      id: 101,
      code: 'J18.9',
      name: 'Pneumonia',
      lawsuit: false,
      has_entrance_or_lawsuit: false,
      has_entrance_or_lawsuit_finished: false,
    },
    {
      id: 102,
      code: 'I10',
      name: 'Hipertensão',
      lawsuit: true,
      has_entrance_or_lawsuit: false,
      has_entrance_or_lawsuit_finished: false,
    },
    {
      id: 103,
      code: 'E11',
      name: 'Diabetes',
      lawsuit: false,
      has_entrance_or_lawsuit: true,
      has_entrance_or_lawsuit_finished: true,
    },
    {
      id: 104,
      code: 'K35',
      name: 'Apendicite',
      lawsuit: false,
      has_entrance_or_lawsuit: true,
      has_entrance_or_lawsuit_finished: false,
    },
  ];

  const sampleHospitals: HospitalUnity[] = [
    { id: 201, name: 'Hospital Central' } as HospitalUnity,
    { id: 202, name: 'Hospital Regional' } as HospitalUnity,
  ];

  async function createComponent(): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestCreateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: null },
        ],
      })
      .overrideComponent(PatientRequestCreateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestCreateComponent);
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

    patientRequestServiceMock = {
      getPatients: vi.fn().mockReturnValue(of(samplePatients)),
      getReports: vi.fn().mockReturnValue(of(sampleReports as unknown as PatientReport[])),
      getHospitalUnities: vi.fn().mockReturnValue(of(sampleHospitals)),
      createPatientRequest: vi.fn().mockReturnValue(of({ message: 'Solicitação criada!' })),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e carregar pacientes e hospitais filtrados', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
    expect(patientRequestServiceMock.getPatients).toHaveBeenCalledTimes(1);
    expect(patientRequestServiceMock.getHospitalUnities).toHaveBeenCalledTimes(1);
    expect(component['patientLoading']()).toBe(false);
    expect(component['hospitalLoading']()).toBe(false);
    expect(component['patientReadOnly']()).toBe(false);
    expect(component['hospitalReadOnly']()).toBe(false);
    expect(component['filteredPatientOptions']()).toEqual([samplePatients[0]]);
    expect(component['filteredHospitalOptions']()).toEqual(sampleHospitals);
    expect(component['patientRequestForm'].get('patient_search')?.enabled).toBe(true);
    expect(component['patientRequestForm'].get('hospital_search')?.enabled).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve lidar com falhas ao carregar pacientes ou unidades hospitalares', async () => {
    patientRequestServiceMock.getPatients.mockReturnValueOnce(
      throwError(() => new Error('Erro pacientes'))
    );
    patientRequestServiceMock.getHospitalUnities.mockReturnValueOnce(
      throwError(() => new Error('Erro hospitais'))
    );

    await createComponent();

    expect(component['patientReadOnly']()).toBe(true);
    expect(component['filteredPatientOptions']()).toEqual([]);
    expect(component['hospitalReadOnly']()).toBe(true);
    expect(component['filteredHospitalOptions']()).toEqual([]);
  });

  describe('Display, Seleção, Tipo, Datas e Filtros', () => {
    it('deve formatar labels de paciente, CID/laudo e unidade hospitalar', () => {
      expect(component['displayPatient'](null)).toBe('');
      expect(component['displayPatient'](samplePatients[0])).toBe('Ana Silva');

      expect(component['displayCid'](null)).toBe('');
      expect(component['displayCid']({ code: 'J18.9', name: 'Pneumonia' })).toBe(
        'J18.9 - Pneumonia'
      );
      expect(component['displayCid']({ code: 'J18.9' })).toBe('');

      expect(component['displayHospitalUnity'](null)).toBe('');
      expect(component['displayHospitalUnity'](sampleHospitals[0])).toBe('Hospital Central');
    });

    it('deve buscar laudos ao selecionar paciente e tratar erro em getReports', () => {
      component['setPatient'](samplePatients[0]);
      expect(patientRequestServiceMock.getReports).toHaveBeenCalledWith(1);
      expect(component['cidLoading']()).toBe(false);
      expect(component['cidReadOnly']()).toBe(false);
      expect(component['patientRequestForm'].get('cid_search')?.enabled).toBe(true);
      expect(component['filteredCidOptions']()).toHaveLength(4);

      patientRequestServiceMock.getReports.mockReturnValueOnce(
        throwError(() => new Error('Erro laudos'))
      );
      component['setPatient'](samplePatients[0]);
      expect(component['cidReadOnly']()).toBe(true);
      expect(component['filteredCidOptions']()).toEqual([]);
    });

    it('deve definir tipo automaticamente conforme flags do laudo em setCid', () => {
      component['setCid'](sampleReports[0]);
      expect(component['patientRequestForm'].get('report_id')?.value).toBe(101);
      expect(component['patientRequestForm'].get('type')?.value).toBe('Entrada');
      expect(component['isScheduling']()).toBe(false);
      expect(component['patientRequestForm'].get('consultation_date')?.disabled).toBe(true);

      component['setCid'](sampleReports[1]);
      expect(component['patientRequestForm'].get('type')?.value).toBe('Ação Judicial');
      expect(component['isScheduling']()).toBe(true);
      expect(component['patientRequestForm'].get('consultation_date')?.enabled).toBe(true);

      component['setCid'](sampleReports[2]);
      expect(component['patientRequestForm'].get('type')?.value).toBe('Agendamento');
      expect(component['isScheduling']()).toBe(true);

      component['setCid'](sampleReports[3]);
      expect(component['patientRequestForm'].get('type')?.value).toBeNull();
      expect(component['isScheduling']()).toBe(false);
      expect(component['patientRequestForm'].get('consultation_date')?.disabled).toBe(true);
    });

    it('deve selecionar unidade hospitalar e validar entrada de data e teclado', () => {
      component['setHospitalUnity'](sampleHospitals[0]);
      expect(component['patientRequestForm'].get('hospital_unity_id')?.value).toBe(201);
      expect(component['patientRequestForm'].get('hospital_unity_id')?.dirty).toBe(true);

      const preventDefault = vi.fn();
      expect(
        component['onlyNumbersAndSlashes']({ key: 'a', preventDefault } as unknown as KeyboardEvent)
      ).toBe(false);
      expect(preventDefault).toHaveBeenCalled();
      expect(
        component['onlyNumbersAndSlashes']({ key: '5', preventDefault } as unknown as KeyboardEvent)
      ).toBe(true);

      component['setType']('Agendamento');
      const dateCtrl = component['patientRequestForm'].get('consultation_date')!;

      component['onConsultationDateInput']({
        target: { value: '   ' },
      } as unknown as Event);
      expect(dateCtrl.value).toBeNull();

      component['onConsultationDateInput']({
        target: { value: '1205' },
      } as unknown as Event);
      expect(dateCtrl.value).toBeNull();

      component['onConsultationDateInput']({
        target: { value: '32132026' },
      } as unknown as Event);
      expect(dateCtrl.errors?.['invalidDate']).toBe(true);
      expect(dateCtrl.touched).toBe(true);

      component['onConsultationDateInput']({
        target: { value: '15082026' },
      } as unknown as Event);
      expect(dateCtrl.errors?.['invalidDate']).toBeUndefined();
      expect(moment.isMoment(dateCtrl.value)).toBe(true);
      expect(dateCtrl.value.format('DD/MM/YYYY')).toBe('15/08/2026');

      component['setConsultationDate']({
        value: moment('0500-01-01', 'YYYY-MM-DD'),
      } as MatDatepickerInputEvent<Moment | null>);
      expect(dateCtrl.errors?.['invalidDate']).toBe(true);

      const pickerMoment = moment('2026-10-20', 'YYYY-MM-DD');
      component['setConsultationDate']({
        value: pickerMoment,
      } as MatDatepickerInputEvent<Moment | null>);
      expect(dateCtrl.value).toBe(pickerMoment);
      expect(dateCtrl.errors?.['invalidDate']).toBeUndefined();
    });

    it('deve filtrar opções e limpar campos dependentes ao digitar texto livre', () => {
      component['setPatient'](samplePatients[0]);
      component['setCid'](sampleReports[1]);
      component['setHospitalUnity'](sampleHospitals[0]);

      component['patientRequestForm'].get('patient_search')?.setValue('Ana');
      expect(component['filteredPatientOptions']()).toEqual([samplePatients[0]]);

      component['patientRequestForm'].get('patient_search')?.setValue('Texto Livre');
      expect(component['patientRequestForm'].get('report_id')?.value).toBeNull();
      expect(component['patientRequestForm'].get('type')?.value).toBeNull();
      expect(component['cidReadOnly']()).toBe(true);

      component['setPatient'](samplePatients[0]);
      component['patientRequestForm'].get('cid_search')?.setValue('Pneumonia');
      expect(component['filteredCidOptions']()).toHaveLength(1);

      component['patientRequestForm'].get('cid_search')?.setValue('CID Livre');
      expect(component['patientRequestForm'].get('report_id')?.value).toBeNull();
      expect(component['patientRequestForm'].get('type')?.value).toBeNull();

      component['patientRequestForm'].get('hospital_search')?.setValue('Regional');
      expect(component['filteredHospitalOptions']()).toEqual([sampleHospitals[1]]);

      component['patientRequestForm'].get('hospital_search')?.setValue('Hospital Livre');
      expect(component['patientRequestForm'].get('hospital_unity_id')?.value).toBeNull();
    });
  });

  describe('Submissão (onSubmit)', () => {
    function fillValidEntradaForm(): void {
      component['setPatient'](samplePatients[0]);
      component['patientRequestForm'].get('patient_search')?.setValue(samplePatients[0]);
      component['setCid'](sampleReports[0]);
      component['patientRequestForm'].get('cid_search')?.setValue(sampleReports[0]);
      component['setHospitalUnity'](sampleHospitals[0]);
      component['patientRequestForm'].get('hospital_search')?.setValue(sampleHospitals[0]);
      component['patientRequestForm'].get('observation')?.setValue('Solicitação inicial');
    }

    it('deve marcar controles como touched e não enviar quando formulário for inválido ou sem type', () => {
      component['onSubmit']();
      expect(patientRequestServiceMock.createPatientRequest).not.toHaveBeenCalled();
      expect(component['patientRequestForm'].get('observation')?.touched).toBe(true);

      fillValidEntradaForm();
      component['patientRequestForm'].get('type')?.setValue(null);
      component['onSubmit']();
      expect(patientRequestServiceMock.createPatientRequest).not.toHaveBeenCalled();
      expect(component['patientRequestForm'].get('type')?.touched).toBe(true);
    });

    it('deve gerenciar isSubmitting, enviar payload, notificar canal e fechar dialog no sucesso', () => {
      fillValidEntradaForm();

      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.createPatientRequest.mockReturnValueOnce(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['patientRequestForm'].disabled).toBe(true);
      expect(patientRequestServiceMock.createPatientRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          report_id: 101,
          type: 'Entrada',
          hospital_unity_id: 201,
          observation: 'Solicitação inicial',
        })
      );

      pending$.next({ message: 'Solicitação cadastrada!' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['patientRequestForm'].get('patient_search')?.enabled).toBe(true);
      expect(component['patientRequestForm'].get('type')?.disabled).toBe(true);
      expect(component['patientRequestForm'].get('consultation_date')?.disabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação cadastrada!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve manter consultation_date habilitado após submit quando isScheduling for true e tratar erros', () => {
      fillValidEntradaForm();
      component['setCid'](sampleReports[1]);
      component['patientRequestForm'].get('cid_search')?.setValue(sampleReports[1]);
      component['patientRequestForm']
        .get('consultation_date')
        ?.setValue(moment('2026-11-30', 'YYYY-MM-DD'));

      patientRequestServiceMock.createPatientRequest.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(component['patientRequestForm'].get('consultation_date')?.enabled).toBe(true);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Solicitação criada com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      fillValidEntradaForm();
      patientRequestServiceMock.createPatientRequest.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Conflito de solicitação.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Conflito de solicitação.');

      fillValidEntradaForm();
      patientRequestServiceMock.createPatientRequest.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Houve um erro operacional ao criar a solicitação.'
      );
    });
  });
});