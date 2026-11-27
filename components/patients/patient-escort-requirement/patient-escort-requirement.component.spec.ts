// src/app/tfd/components/patients/patient-escort-requirement/patient-escort-requirement.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientEscortRequirementComponent,
  PatientEscortRequirementDialogData,
} from './patient-escort-requirement.component';
import { PatientEscort } from '../../../models/patient-escort.model';

describe('PatientEscortRequirementComponent', () => {
  let component: PatientEscortRequirementComponent;
  let fixture: ComponentFixture<PatientEscortRequirementComponent>;

  async function createComponent(
    dialogData: PatientEscortRequirementDialogData | null = null
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientEscortRequirementComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientEscortRequirementComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientEscortRequirementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await createComponent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente e retornar lista vazia quando patient_escort não for informado', () => {
    expect(component).toBeTruthy();
    expect(component['requirements']()).toEqual([]);
  });

  it('deve marcar todos os requisitos como atendidos quando todos os campos e anexos estiverem presentes', async () => {
    const fullEscort: PatientEscort = {
      name: 'Maria Aparecida',
      relation: 'Mãe',
      city: 'Cuiabá',
      state: 'MT',
      file_cns_id: 1,
      file_document_id: 2,
      file_address_id: 3,
    } as unknown as PatientEscort;

    await createComponent({ patient_escort: fullEscort });

    expect(component['requirements']()).toEqual([
      { label: 'Nome Completo', fulfilled: true },
      { label: 'Grau de Parentesco / Relação', fulfilled: true },
      { label: 'Cidade', fulfilled: true },
      { label: 'Estado (UF)', fulfilled: true },
      { label: 'Comprovante do CNS', fulfilled: true },
      { label: 'Documento Anexado (CPF/RG)', fulfilled: true },
      { label: 'Comprovante de Endereço Anexado', fulfilled: true },
    ]);
  });

  it('deve marcar requisitos como não atendidos para campos vazios, espaços em branco ou anexos nulos', async () => {
    const emptyEscort: PatientEscort = {
      name: '   ',
      relation: '',
      city: null,
      state: undefined,
      file_cns_id: null,
      file_document_id: undefined,
      file_address_id: null,
    } as unknown as PatientEscort;

    await createComponent({ patient_escort: emptyEscort });

    expect(component['requirements']()).toEqual([
      { label: 'Nome Completo', fulfilled: false },
      { label: 'Grau de Parentesco / Relação', fulfilled: false },
      { label: 'Cidade', fulfilled: false },
      { label: 'Estado (UF)', fulfilled: false },
      { label: 'Comprovante do CNS', fulfilled: false },
      { label: 'Documento Anexado (CPF/RG)', fulfilled: false },
      { label: 'Comprovante de Endereço Anexado', fulfilled: false },
    ]);
  });

  it('deve considerar id 0 em anexos e tipos não-string válidos no hasValue', async () => {
    const edgeEscort: PatientEscort = {
      name: { toString: () => 'Objeto' } as unknown as string,
      relation: true as unknown as string,
      city: 0 as unknown as string,
      state: Number.NaN as unknown as string,
      file_cns_id: 0,
      file_document_id: 0,
      file_address_id: 0,
    } as unknown as PatientEscort;

    await createComponent({ patient_escort: edgeEscort });

    expect(component['requirements']()).toEqual([
      { label: 'Nome Completo', fulfilled: true },
      { label: 'Grau de Parentesco / Relação', fulfilled: true },
      { label: 'Cidade', fulfilled: true },
      { label: 'Estado (UF)', fulfilled: false },
      { label: 'Comprovante do CNS', fulfilled: true },
      { label: 'Documento Anexado (CPF/RG)', fulfilled: true },
      { label: 'Comprovante de Endereço Anexado', fulfilled: true },
    ]);
  });
});