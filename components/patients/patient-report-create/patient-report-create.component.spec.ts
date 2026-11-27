// src/app/tfd/components/patients/patient-report-create/patient-report-create.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientReportCreateComponent,
  PatientReportCreateDialogData,
} from './patient-report-create.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientReportCreateComponent', () => {
  let component: PatientReportCreateComponent;
  let fixture: ComponentFixture<PatientReportCreateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    getCids: ReturnType<typeof vi.fn>;
    createPatientReport: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const sampleCids = Array.from({ length: 14 }, (_, i) => ({
    id: i + 1,
    code: i === 0 ? 'J18.9' : `C${String(i).padStart(2, '0')}`,
    name: i === 0 ? 'Pneumonia não especificada' : `Diagnóstico ${i}`,
  }));

  const baseDialogData: PatientReportCreateDialogData = {
    patient_care: {
      id: 88,
    } as unknown as PatientCare,
  };

  async function createComponent(
    dialogData: PatientReportCreateDialogData | null = { ...baseDialogData }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientReportCreateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientReportCreateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientReportCreateComponent);
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
      createPatientReport: vi.fn().mockReturnValue(of({ message: 'Laudo salvo!' })),
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

  it('deve criar o componente, abrir o BroadcastChannel e carregar até 10 CIDs iniciais', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(patientServiceMock.getCids).toHaveBeenCalledWith(88);
    expect(component['cidLoading']()).toBe(false);
    expect(component['reportForm'].controls.cid_search.enabled).toBe(true);
    expect(component['filteredCidOptions']()).toHaveLength(10);
    expect(component['filteredSpecialtyOptions']()).toHaveLength(10);
    expect(component['isFormInvalidOrPending']).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve lidar com ausência de patient_care.id ao buscar CIDs e tratar erro no getCids', async () => {
    patientServiceMock.getCids.mockClear();
    await createComponent(null);
    expect(patientServiceMock.getCids).not.toHaveBeenCalled();

    patientServiceMock.getCids.mockReturnValueOnce(throwError(() => new Error('Erro CID')));
    await createComponent({ patient_care: { id: 99 } as unknown as PatientCare });

    expect(component['cidLoading']()).toBe(false);
    expect(component['filteredCidOptions']()).toEqual([]);
  });

  describe('Display, Seleção, Filtros e Cleaners', () => {
    it('deve formatar labels em displayCid e displaySpecialty', () => {
      expect(component['displayCid'](null)).toBe('');
      expect(component['displayCid']('A00')).toBe('A00');
      expect(component['displayCid']({ code: 'J18.9', name: 'Pneumonia' })).toBe(
        'J18.9 - Pneumonia'
      );
      expect(component['displayCid']({ code: 'K35' })).toBe('K35');
      expect(component['displayCid']({ name: 'Apendicite' })).toBe('Apendicite');
      expect(component['displayCid']({})).toBe('');

      expect(component['displaySpecialty'](null)).toBe('');
      expect(component['displaySpecialty']('Cardiologia')).toBe('Cardiologia');
      expect(component['displaySpecialty']({ key: 'CARDIO', label: 'Cardiologia' })).toBe(
        'Cardiologia'
      );
      expect(component['displaySpecialty']({ key: 'EMPTY', label: '' })).toBe('');
    });

    it('deve selecionar CID e especialidade e limpar erros invalidSelection', () => {
      const cidOpt = { id: 7, code: 'I10', name: 'Hipertensão' };
      component['onCidSelected'](cidOpt);
      expect(component['reportForm'].controls.cid_id.value).toBe(7);
      expect(component['reportForm'].controls.cid_id.dirty).toBe(true);

      const firstSpec = component['specialtyOptions'][0];
      component['onSpecialtySelected'](firstSpec);
      expect(component['reportForm'].controls.specialty.value).toBe(firstSpec.key);
      expect(component['reportForm'].controls.specialty.dirty).toBe(true);
    });

    it('deve filtrar CIDs e especialidades e marcar invalidSelection ao digitar texto livre', () => {
      component['reportForm'].controls.cid_search.setValue('J18.9');
      expect(component['filteredCidOptions']()).toEqual([sampleCids[0]]);
      expect(component['reportForm'].controls.cid_id.value).toBeNull();
      expect(component['reportForm'].controls.cid_search.errors?.['invalidSelection']).toBe(true);

      component['reportForm'].controls.cid_search.setValue('');
      expect(component['reportForm'].controls.cid_search.errors?.['invalidSelection']).toBeUndefined();

      const firstSpec = component['specialtyOptions'][0];
      component['reportForm'].controls.specialty_search.setValue(firstSpec.label);
      expect(component['filteredSpecialtyOptions']()).toContainEqual(firstSpec);
      expect(component['reportForm'].controls.specialty.value).toBeNull();
      expect(
        component['reportForm'].controls.specialty_search.errors?.['invalidSelection']
      ).toBe(true);

      component['reportForm'].controls.specialty_search.setValue(firstSpec);
      expect(component['filteredSpecialtyOptions']()).toContainEqual(firstSpec);

      component['reportForm'].controls.specialty_search.setValue('');
      expect(
        component['reportForm'].controls.specialty_search.errors?.['invalidSelection']
      ).toBeUndefined();
    });
  });

  describe('Submissão (onSubmit)', () => {
    function fillValidForm(): void {
      const cidOpt = { id: 10, code: 'E11', name: 'Diabetes mellitus tipo 2' };
      const specOpt = component['specialtyOptions'][0];

      component['reportForm'].controls.protocol.setValue('  PROT-2026-01  ');
      component['reportForm'].controls.cid_search.setValue(cidOpt);
      component['onCidSelected'](cidOpt);
      component['reportForm'].controls.specialty_search.setValue(specOpt);
      component['onSpecialtySelected'](specOpt);
      component['reportForm'].controls.lawsuit.setValue(true);
      component['reportForm'].controls.diagnosis.setValue('  Paciente com quadro estável.  ');
    }

    it('deve exibir mensagem quando patient_care.id for inválido', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do atendimento do paciente inválido.'
      );
      expect(patientServiceMock.createPatientReport).not.toHaveBeenCalled();
    });

    it('deve marcar controles como touched quando formulário for inválido ou faltar specialty/cid_id', () => {
      component['onSubmit']();
      expect(patientServiceMock.createPatientReport).not.toHaveBeenCalled();
      expect(component['reportForm'].controls.protocol.touched).toBe(true);

      fillValidForm();
      component['reportForm'].controls.cid_id.setValue(null);
      component['onSubmit']();
      expect(patientServiceMock.createPatientReport).not.toHaveBeenCalled();
      expect(component['reportForm'].controls.cid_id.touched).toBe(true);
    });

    it('deve gerenciar isSubmitting, enviar payload trimado, notificar canal e fechar dialog no sucesso', () => {
      fillValidForm();
      const firstSpecKey = component['specialtyOptions'][0].key;

      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.createPatientReport.mockReturnValueOnce(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['reportForm'].disabled).toBe(true);
      expect(patientServiceMock.createPatientReport).toHaveBeenCalledWith(88, {
        protocol: 'PROT-2026-01',
        specialty: firstSpecKey,
        cid_id: 10,
        lawsuit: true,
        diagnosis: 'Paciente com quadro estável.',
      });

      pending$.next({ message: 'Laudo cadastrado!' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['reportForm'].enabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo cadastrado!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso e tratar erros da API ou fallback', () => {
      fillValidForm();
      patientServiceMock.createPatientReport.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo criado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      fillValidForm();
      patientServiceMock.createPatientReport.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Protocolo já existente.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Protocolo já existente.');

      fillValidForm();
      patientServiceMock.createPatientReport.mockReturnValueOnce(
        throwError(() => new Error('Erro de rede'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao salvar o laudo médico.');
    });
  });
});