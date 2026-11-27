// src/app/tfd/components/patients/patient-report-update/patient-report-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientReportUpdateComponent,
  PatientReportUpdateDialogData,
} from './patient-report-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { Specialty } from '../../../enums/specialties';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientReportUpdateComponent', () => {
  let component: PatientReportUpdateComponent;
  let fixture: ComponentFixture<PatientReportUpdateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    getCids: ReturnType<typeof vi.fn>;
    updatePatientReport: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const firstSpecialtyKey = Object.keys(Specialty)[0];
  const firstSpecialtyLabel = Specialty[firstSpecialtyKey as keyof typeof Specialty];

  const sampleCids = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    code: i === 0 ? 'I10' : i === 4 ? 'K35' : `A${String(i).padStart(2, '0')}`,
    name:
      i === 0
        ? 'Hipertensão essencial'
        : i === 4
          ? 'Apendicite aguda'
          : `Condição ${i}`,
  }));

  const baseDialogData: PatientReportUpdateDialogData = {
    patient_care: {
      id: 70,
    } as unknown as PatientCare,
    patient_report: {
      id: 19,
      protocol: 'PROT-550',
      specialty: firstSpecialtyKey,
      cid_id: 5,
      cid: { id: 5, code: 'K35', name: 'Apendicite aguda' },
      lawsuit: true,
      diagnosis: 'Quadro clínico avaliado',
    } as unknown as PatientReport,
  };

  async function createComponent(
    dialogData: PatientReportUpdateDialogData | null = {
      patient_care: { ...baseDialogData.patient_care } as unknown as PatientCare,
      patient_report: {
        ...baseDialogData.patient_report,
        cid: { ...baseDialogData.patient_report?.cid },
      } as unknown as PatientReport,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientReportUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientReportUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientReportUpdateComponent);
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
      getCids: vi.fn().mockReturnValue(of(sampleCids)),
      updatePatientReport: vi.fn().mockReturnValue(of({ message: 'Laudo atualizado!' })),
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

  it('deve criar o componente, abrir o BroadcastChannel, preencher formulário e sincronizar CID', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(patientServiceMock.getCids).toHaveBeenCalledWith(70);
    expect(component['cidLoading']()).toBe(false);
    expect(component['reportForm'].controls.protocol.value).toBe('PROT-550');
    expect(component['reportForm'].controls.specialty.value).toBe(firstSpecialtyKey);
    expect(component['reportForm'].controls.specialty_search.value).toEqual({
      key: firstSpecialtyKey,
      label: firstSpecialtyLabel,
    });
    expect(component['reportForm'].controls.cid_id.value).toBe(5);
    expect(component['reportForm'].controls.cid_search.value).toEqual(sampleCids[4]);
    expect(component['reportForm'].controls.lawsuit.value).toBe(true);
    expect(component['reportForm'].controls.diagnosis.value).toBe('Quadro clínico avaliado');
    expect(component['isFormPristine']()).toBe(true);
    expect(component['isFormInvalidOrPending']).toBe(false);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve lidar com ausência de patient_care/patient_report, erro no getCids e CID não encontrado na lista', async () => {
    patientServiceMock.getCids.mockClear();
    await createComponent(null);
    expect(patientServiceMock.getCids).not.toHaveBeenCalled();
    expect(component['filteredCidOptions']()).toEqual([]);

    patientServiceMock.getCids.mockReturnValueOnce(throwError(() => new Error('Falha CID')));
    await createComponent({
      patient_care: { id: 70 } as unknown as PatientCare,
      patient_report: { id: 19, protocol: 'P1', diagnosis: 'D1' } as unknown as PatientReport,
    });
    expect(component['cidLoading']()).toBe(false);
    expect(component['filteredCidOptions']()).toEqual([]);

    patientServiceMock.getCids.mockReturnValueOnce(of([{ id: 99, code: 'Z00', name: 'Exame' }]));
    await createComponent({
      patient_care: { id: 70 } as unknown as PatientCare,
      patient_report: {
        id: 19,
        protocol: 'P2',
        specialty: 'DESCONHECIDA',
        cid_id: 77,
        cid: { id: 77, code: 'M54', name: 'Dorsalgia' },
        diagnosis: 'D2',
      } as unknown as PatientReport,
    });
    expect(component['reportForm'].controls.specialty_search.value).toBeNull();
    expect(component['reportForm'].controls.cid_id.value).toBe(77);
    expect(component['reportForm'].controls.cid_search.value).toEqual({
      id: 77,
      code: 'M54',
      name: 'Dorsalgia',
    });
  });

  it('deve preservar cid_search sujo (dirty) ao sincronizar lista de CIDs', async () => {
    const cidSubject = new Subject<Array<{ id?: number; code?: string; name?: string }>>();
    patientServiceMock.getCids.mockReturnValueOnce(cidSubject.asObservable());

    await createComponent();
    component['reportForm'].controls.cid_search.setValue('texto manual');
    component['reportForm'].controls.cid_search.markAsDirty();

    cidSubject.next(sampleCids);
    cidSubject.complete();

    expect(component['reportForm'].controls.cid_search.value).toBe('texto manual');
  });

  describe('Display, Seleção, Filtros e Cleaners', () => {
    it('deve formatar labels em displayCid e displaySpecialty', () => {
      expect(component['displayCid'](null)).toBe('');
      expect(component['displayCid']('B20')).toBe('B20');
      expect(component['displayCid']({ code: 'I10', name: 'Hipertensão' })).toBe(
        'I10 - Hipertensão'
      );
      expect(component['displayCid']({ code: 'K35' })).toBe('K35');
      expect(component['displayCid']({ name: 'Asma' })).toBe('Asma');
      expect(component['displayCid']({})).toBe('');

      expect(component['displaySpecialty'](null)).toBe('');
      expect(component['displaySpecialty']('Ortopedia')).toBe('Ortopedia');
      expect(component['displaySpecialty']({ key: 'ORTO', label: 'Ortopedia' })).toBe('Ortopedia');
      expect(component['displaySpecialty']({ key: 'VAZIO', label: '' })).toBe('');
    });

    it('deve selecionar CID e especialidade e atualizar valores e dirty', () => {
      component['onCidSelected']({ id: 1, code: 'I10', name: 'Hipertensão essencial' });
      expect(component['reportForm'].controls.cid_id.value).toBe(1);
      expect(component['reportForm'].controls.cid_id.dirty).toBe(true);

      const secondSpec = component['specialtyOptions'][1] ?? component['specialtyOptions'][0];
      component['onSpecialtySelected'](secondSpec);
      expect(component['reportForm'].controls.specialty.value).toBe(secondSpec.key);
      expect(component['reportForm'].controls.specialty.dirty).toBe(true);
      expect(component['isFormPristine']()).toBe(false);
    });

    it('deve filtrar CIDs e especialidades e limpar/marcar invalidSelection ao digitar', () => {
      component['reportForm'].controls.cid_search.setValue('I10');
      expect(component['filteredCidOptions']()).toEqual([sampleCids[0]]);
      expect(component['reportForm'].controls.cid_id.value).toBeNull();
      expect(component['reportForm'].controls.cid_search.errors?.['invalidSelection']).toBe(true);

      component['reportForm'].controls.cid_search.setValue('');
      expect(component['reportForm'].controls.cid_search.errors?.['invalidSelection']).toBeUndefined();

      component['reportForm'].controls.specialty_search.setValue(firstSpecialtyLabel);
      expect(component['filteredSpecialtyOptions']()[0]?.key).toBe(firstSpecialtyKey);
      expect(component['reportForm'].controls.specialty.value).toBeNull();
      expect(
        component['reportForm'].controls.specialty_search.errors?.['invalidSelection']
      ).toBe(true);

      component['reportForm'].controls.specialty_search.setValue('');
      expect(
        component['reportForm'].controls.specialty_search.errors?.['invalidSelection']
      ).toBeUndefined();
    });
  });

  describe('Atualização (onSubmit)', () => {
    it('deve exibir mensagem quando patient_care.id ou patient_report.id estiverem ausentes', async () => {
      await createComponent({
        patient_care: { id: 70 } as unknown as PatientCare,
        patient_report: undefined,
      });
      component['onSubmit']();

      await createComponent({
        patient_care: undefined,
        patient_report: { id: 19 } as unknown as PatientReport,
      });
      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificadores do atendimento ou laudo inválidos.'
      );
      expect(patientServiceMock.updatePatientReport).not.toHaveBeenCalled();
    });

    it('deve marcar controles como touched quando formulário for inválido ou faltar specialty/cid_id', () => {
      component['reportForm'].controls.protocol.setValue('');
      component['onSubmit']();
      expect(patientServiceMock.updatePatientReport).not.toHaveBeenCalled();
      expect(component['reportForm'].controls.protocol.touched).toBe(true);

      component['reportForm'].controls.protocol.setValue('PROT-550');
      component['reportForm'].controls.cid_id.setValue(null);
      component['onSubmit']();
      expect(patientServiceMock.updatePatientReport).not.toHaveBeenCalled();
      expect(component['reportForm'].controls.cid_id.touched).toBe(true);
    });

    it('deve gerenciar isSubmitting, enviar payload trimado, notificar canal e fechar dialog no sucesso', () => {
      component['reportForm'].patchValue({
        protocol: '  PROT-777  ',
        diagnosis: '  Diagnóstico revisado.  ',
        lawsuit: false,
      });

      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.updatePatientReport.mockReturnValueOnce(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['reportForm'].disabled).toBe(true);
      expect(patientServiceMock.updatePatientReport).toHaveBeenCalledWith(70, 19, {
        protocol: 'PROT-777',
        specialty: firstSpecialtyKey,
        cid_id: 5,
        lawsuit: false,
        diagnosis: 'Diagnóstico revisado.',
      });

      pending$.next({ message: 'Laudo atualizado com sucesso!' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['reportForm'].enabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso e tratar erros da API ou fallback', () => {
      patientServiceMock.updatePatientReport.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      patientServiceMock.updatePatientReport.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Laudo bloqueado para edição.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo bloqueado para edição.');

      patientServiceMock.updatePatientReport.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao atualizar o laudo médico.'
      );
    });
  });
});