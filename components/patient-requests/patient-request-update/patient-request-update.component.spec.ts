// src/app/tfd/components/patient-requests/patient-request-update/patient-request-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import moment, { Moment } from 'moment';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OptionItem,
  PatientRequestUpdateComponent,
  PatientRequestUpdateDialogData,
} from './patient-request-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestUpdateComponent', () => {
  let component: PatientRequestUpdateComponent;
  let fixture: ComponentFixture<PatientRequestUpdateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    getPatients: ReturnType<typeof vi.fn>;
    getHospitalUnities: ReturnType<typeof vi.fn>;
    getReports: ReturnType<typeof vi.fn>;
    updatePatientRequest: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const mockPatients = [
    { id: 10, status: true, is_valid: true, patient: { name: 'Ana Paula' } },
    { id: 11, status: false, is_valid: true, patient: { name: 'Inválido Status' } },
    { id: 12, status: true, is_valid: false, patient: { name: 'Inválido Flag' } },
    { id: 13, name: 'Bruno Sem Flags' },
  ];

  const mockHospitals = [
    { id: 20, name: 'Hospital Central' },
    { id: 21, name: 'Hospital Regional' },
  ];

  const mockReports = [
    {
      id: 30,
      lawsuit: false,
      has_entrance_or_lawsuit: false,
      has_entrance_or_lawsuit_finished: false,
      cid: { code: 'A00', name: 'Cólera' },
    },
    {
      id: 31,
      lawsuit: true,
      has_entrance_or_lawsuit: false,
      has_entrance_or_lawsuit_finished: false,
      cid: { code: 'B20', name: 'HIV' },
    },
    {
      id: 32,
      lawsuit: false,
      has_entrance_or_lawsuit: true,
      has_entrance_or_lawsuit_finished: true,
      cid: { code: 'C50', name: 'Neoplasia' },
    },
  ];

  const defaultDialogData: PatientRequestUpdateDialogData = {
    patient_request: {
      id: 500,
      report_id: 30,
      type: 'Entrada',
      consultation_date: '2026-12-10',
      hospital_unity_id: 20,
      hospital_unity: { id: 20, name: 'Hospital Central' },
      observation: 'Observação inicial',
      report: {
        id: 30,
        cid: { code: 'A00', name: 'Cólera' },
        patient_care: {
          id: 10,
          patient: { name: 'Ana Paula' },
        },
      },
    } as unknown as PatientRequest,
  };

  async function createComponent(
    dialogData: PatientRequestUpdateDialogData | null = defaultDialogData
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestUpdateComponent);
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
      getPatients: vi.fn().mockReturnValue(of(mockPatients)),
      getHospitalUnities: vi.fn().mockReturnValue(of(mockHospitals)),
      getReports: vi.fn().mockReturnValue(of(mockReports)),
      updatePatientRequest: vi.fn().mockReturnValue(of({ message: 'Atualizada!' })),
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

  it('deve criar o componente, abrir BroadcastChannel e carregar dados iniciais', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
    expect(patientRequestServiceMock.getPatients).toHaveBeenCalledTimes(1);
    expect(patientRequestServiceMock.getHospitalUnities).toHaveBeenCalledTimes(1);
    expect(patientRequestServiceMock.getReports).toHaveBeenCalledWith(10);
    expect(component['patientOptions']().map((p) => p.id)).toEqual([10, 13]);
    expect(component['filteredPatientOptions']().map((p) => p.id)).toEqual([10]);
    expect(component['hospitalOptions']()).toHaveLength(2);
    expect(component['filteredHospitalOptions']()).toHaveLength(1);
    expect(component['cidOptions']()).toHaveLength(3);
    expect(component['filteredCidOptions']()).toEqual([]);
    expect(component['currentReportFlags']()).toEqual({
      lawsuit: false,
      hasEntranceOrLawsuit: false,
    });
    expect(component['patientRequestForm'].get('observation')?.value).toBe('Observação inicial');
    expect(component['isFormInvalid']()).toBe(true); // pristine
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve lidar com ausência de patient_care.id e erro ao carregar dados iniciais', async () => {
    patientRequestServiceMock.getReports.mockClear();

    await createComponent({
      patient_request: { id: 501, type: null } as unknown as PatientRequest,
    });
    expect(patientRequestServiceMock.getReports).not.toHaveBeenCalled();
    expect(component['cidReadOnly']()).toBe(true);

    patientRequestServiceMock.getPatients.mockReturnValueOnce(
      throwError(() => new Error('Erro de rede'))
    );
    await createComponent();
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Erro ao carregar dados cadastrais da solicitação.'
    );
    expect(component['patientReadOnly']()).toBe(true);
    expect(component['hospitalReadOnly']()).toBe(true);
    expect(component['cidReadOnly']()).toBe(true);
  });

  describe('Display, Filtros, Cleaners e Seleção', () => {
    it('deve formatar displays e filtrar opções com limite de 10 itens', () => {
      expect(component['displayPatient'](null)).toBe('');
      expect(component['displayPatient']({ name: 'Teste' })).toBe('Teste');

      expect(component['displayCid'](null)).toBe('');
      expect(component['displayCid']({ code: 'A00' })).toBe('');
      expect(component['displayCid']({ code: 'A00', name: 'Cólera' })).toBe('A00 - Cólera');

      expect(component['displayHospitalUnity'](null)).toBe('');
      expect(component['displayHospitalUnity']({ name: 'Hospital' })).toBe('Hospital');

      const manyPatients: OptionItem[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 100,
        name: `Paciente ${i + 1}`,
      }));
      component['patientOptions'].set(manyPatients);
      expect(component['filterPatient']('')).toHaveLength(10);
      expect(component['filterPatient']('Paciente 1')).toHaveLength(4); // 1, 10, 11, 12

      expect(component['filterCid']('')).toHaveLength(3);
      expect(component['filterCid']('B20')).toHaveLength(1);
      expect(component['filterCid']('Neoplasia')).toHaveLength(1);

      expect(component['filterHospital']('')).toHaveLength(2);
      expect(component['filterHospital']('Regional')).toHaveLength(1);
    });

    it('deve atualizar laudos ao chamar setPatient (sucesso e erro) e limpar campos quando desmarcado', () => {
      component['setPatient']({});
      expect(patientRequestServiceMock.getReports).toHaveBeenCalledTimes(1);

      component['setPatient']({ id: 99 });
      expect(patientRequestServiceMock.getReports).toHaveBeenCalledWith(99);
      expect(component['cidReadOnly']()).toBe(false);

      patientRequestServiceMock.getReports.mockReturnValueOnce(
        throwError(() => new Error('Erro CID'))
      );
      component['setPatient']({ id: 98 });
      expect(component['cidReadOnly']()).toBe(true);
      expect(component['filteredCidOptions']()).toEqual([]);

      component['patientRequestForm'].get('patient_search')?.setValue('');
      expect(component['patientRequestForm'].get('report_id')?.value).toBeNull();
      expect(component['patientRequestForm'].get('type')?.value).toBeNull();
    });

    it('deve definir tipo automaticamente em setCid e limpar ao desmarcar CID ou hospital', () => {
      component['setCid']({});
      expect(component['currentReportFlags']()).toEqual({
        lawsuit: false,
        hasEntranceOrLawsuit: false,
      });

      component['setCid'](mockReports[2]); // id 32, hasEntranceOrLawsuitFinished = true -> Agendamento
      expect(component['patientRequestForm'].get('report_id')?.value).toBe(32);
      expect(component['patientRequestForm'].get('type')?.value).toBe('Agendamento');
      expect(component['isScheduling']()).toBe(true);

      component['setCid'](mockReports[1]); // id 31, lawsuit = true -> Ação Judicial
      expect(component['patientRequestForm'].get('type')?.value).toBe('Ação Judicial');

      component['setCid']({ id: 35, lawsuit: false, has_entrance_or_lawsuit: false }); // Entrada
      expect(component['patientRequestForm'].get('type')?.value).toBe('Entrada');

      component['setCid']({
        id: 36,
        lawsuit: false,
        has_entrance_or_lawsuit: true,
        has_entrance_or_lawsuit_finished: false,
      });
      expect(component['patientRequestForm'].get('type')?.value).toBeNull();

      component['setCid']({ id: 30, lawsuit: false, has_entrance_or_lawsuit: false }); // mesmo report_id original
      expect(component['patientRequestForm'].get('type')?.value).toBe('Entrada');

      component['patientRequestForm'].get('cid_search')?.setValue('');
      expect(component['patientRequestForm'].get('report_id')?.value).toBeNull();

      component['setHospitalUnity']({});
      component['setHospitalUnity']({ id: 21 });
      expect(component['patientRequestForm'].get('hospital_unity_id')?.value).toBe(21);

      component['patientRequestForm'].get('hospital_search')?.setValue('');
      expect(component['patientRequestForm'].get('hospital_unity_id')?.value).toBeNull();
    });
  });

  describe('Data de Agendamento e Teclado', () => {
    it('deve validar entrada de data via input, datepicker e teclas permitidas', () => {
      component['setType']('Agendamento');
      const dateCtrl = component['patientRequestForm'].get('consultation_date')!;
      expect(dateCtrl.enabled).toBe(true);

      const makeInputEvent = (val: string) =>
        ({ target: { value: val } }) as unknown as Event;

      component['onConsultationDateInput'](makeInputEvent(''));
      expect(dateCtrl.value).toBeNull();

      component['onConsultationDateInput'](makeInputEvent('12'));
      expect(dateCtrl.value).toBeNull();

      component['onConsultationDateInput'](makeInputEvent('32/13/2026'));
      expect(dateCtrl.hasError('invalidDate')).toBe(true);

      component['onConsultationDateInput'](makeInputEvent('15/06/2026'));
      expect(dateCtrl.hasError('invalidDate')).toBe(false);
      expect(moment.isMoment(dateCtrl.value)).toBe(true);

      const invalidYearMoment = moment('15/06/0500', 'DD/MM/YYYY');
      component['setConsultationDate']({
        value: invalidYearMoment,
      } as MatDatepickerInputEvent<Moment | null>);
      expect(dateCtrl.hasError('invalidDate')).toBe(true);

      const validMoment = moment('20/08/2026', 'DD/MM/YYYY');
      component['setConsultationDate']({
        value: validMoment,
      } as MatDatepickerInputEvent<Moment | null>);
      expect(dateCtrl.hasError('invalidDate')).toBe(false);
      expect(dateCtrl.value).toBe(validMoment);

      const preventDefault = vi.fn();
      expect(
        component['onlyNumbersAndSlashes']({
          key: 'a',
          preventDefault,
        } as unknown as KeyboardEvent)
      ).toBe(false);
      expect(preventDefault).toHaveBeenCalled();

      expect(
        component['onlyNumbersAndSlashes']({
          key: '5',
          preventDefault,
        } as unknown as KeyboardEvent)
      ).toBe(true);
      expect(
        component['onlyNumbersAndSlashes']({
          key: '/',
          preventDefault,
        } as unknown as KeyboardEvent)
      ).toBe(true);
    });
  });

  describe('Envio (onSubmit)', () => {
    it('deve exibir mensagem quando patient_request.id não for encontrado', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da solicitação não encontrado.'
      );
      expect(patientRequestServiceMock.updatePatientRequest).not.toHaveBeenCalled();
    });

    it('deve marcar controles como touched e não enviar quando formulário estiver inválido', () => {
      component['patientRequestForm'].get('observation')?.setValue('');

      component['onSubmit']();

      expect(component['patientRequestForm'].get('observation')?.touched).toBe(true);
      expect(patientRequestServiceMock.updatePatientRequest).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, restaurar estado, notificar canal e fechar dialog no sucesso', () => {
      component['patientRequestForm'].get('observation')?.setValue('Observação atualizada');
      component['patientRequestForm'].markAsDirty();

      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.updatePatientRequest.mockReturnValueOnce(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['patientRequestForm'].disabled).toBe(true);
      expect(patientRequestServiceMock.updatePatientRequest).toHaveBeenCalledTimes(1);

      pending$.next({ message: 'Solicitação salva!' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['patientRequestForm'].get('observation')?.enabled).toBe(true);
      expect(component['patientRequestForm'].get('type')?.disabled).toBe(true);
      expect(component['patientRequestForm'].get('consultation_date')?.disabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação salva!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso e tratar erros da API ou fallback', () => {
      component['patientRequestForm'].get('observation')?.setValue('Observação válida');
      component['patientRequestForm'].markAsDirty();

      patientRequestServiceMock.updatePatientRequest.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Solicitação de paciente atualizada com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      patientRequestServiceMock.updatePatientRequest.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Conflito ao atualizar.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Conflito ao atualizar.');

      patientRequestServiceMock.updatePatientRequest.mockReturnValueOnce(
        throwError(() => new Error('Erro desconhecido'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Houve um erro operacional ao atualizar a solicitação.'
      );
    });
  });
});