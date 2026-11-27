// src/app/tfd/components/patients/patient-requirement/patient-requirement.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequirementComponent,
  PatientRequirementDialogData,
} from './patient-requirement.component';
import { PatientCare } from '../../../models/patient-care.model';

describe('PatientRequirementComponent', () => {
  let component: PatientRequirementComponent;
  let fixture: ComponentFixture<PatientRequirementComponent>;

  async function createComponent(
    dialogData: PatientRequirementDialogData | null = null
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequirementComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequirementComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequirementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente e retornar lista vazia quando patient_care não for informado', async () => {
    await createComponent(null);

    expect(component).toBeTruthy();
    expect(component['requirements']()).toEqual([]);
  });

  it('deve marcar todos os 12 requisitos como atendidos quando os dados estiverem completos', async () => {
    const completeCare = {
      id: 1,
      has_reports: true,
      patient: {
        marital_status: 'CASADO',
        phone: '6533221100',
        cell_phone: '65999887766',
        email: 'paciente@exemplo.com',
        mother_name: 'Maria Aparecida',
        city: 'Cuiabá',
        state: 'MT',
        file_cns_id: 10,
        file_document_id: 20,
        file_address_id: 30,
        patient_info: {
          control_number: 'CTRL-2026-001',
          file_sigadoc_id: 40,
        },
      },
    } as unknown as PatientCare;

    await createComponent({ patient_care: completeCare });

    const items = component['requirements']();
    expect(items).toHaveLength(12);
    expect(items.every((item) => item.fulfilled)).toBe(true);
  });

  it('deve avaliar corretamente strings em branco, NaN, telefone/celular alternativos e anexos ausentes', async () => {
    const partialCare = {
      id: 2,
      has_reports: false,
      patient: {
        marital_status: '   ',
        phone: '',
        cell_phone: '65991112233',
        email: '   ',
        mother_name: 'Ana',
        city: null,
        state: 'MT',
        file_cns_id: null,
        file_document_id: 0,
        file_address_id: undefined,
        patient_info: {
          control_number: Number.NaN,
          file_sigadoc_id: 0,
        },
      },
    } as unknown as PatientCare;

    await createComponent({ patient_care: partialCare });

    const mapByLabel = new Map(
      component['requirements']().map((item) => [item.label, item.fulfilled])
    );

    expect(mapByLabel.get('Estado civil')).toBe(false);
    expect(mapByLabel.get('Telefone ou celular de contato')).toBe(true);
    expect(mapByLabel.get('E-mail')).toBe(false);
    expect(mapByLabel.get('Nome da mãe')).toBe(true);
    expect(mapByLabel.get('Cidade')).toBe(false);
    expect(mapByLabel.get('Estado (UF)')).toBe(true);
    expect(mapByLabel.get('Número de controle')).toBe(false);
    expect(mapByLabel.get('Laudo cadastrado')).toBe(false);
    expect(mapByLabel.get('Comprovante do CNS')).toBe(false);
    expect(mapByLabel.get('Documento anexado (CPF/Certidão)')).toBe(true);
    expect(mapByLabel.get('Comprovante de endereço anexado')).toBe(false);
    expect(mapByLabel.get('SigaDoc anexado')).toBe(true);
  });

  it('deve aceitar valores numéricos válidos em hasValue', async () => {
    const numericCare = {
      id: 3,
      has_reports: 1,
      patient: {
        marital_status: 2,
        phone: 65999999999,
        email: 'teste@saude.gov.br',
        mother_name: 'Luzia',
        city: 'Várzea Grande',
        state: 'MT',
        file_cns_id: 1,
        file_document_id: 2,
        file_address_id: 3,
        patient_info: {
          control_number: 12345,
          file_sigadoc_id: 4,
        },
      },
    } as unknown as PatientCare;

    await createComponent({ patient_care: numericCare });

    expect(component['requirements']().every((item) => item.fulfilled)).toBe(true);
  });
});