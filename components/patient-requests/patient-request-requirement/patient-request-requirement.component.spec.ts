// src/app/tfd/components/patient-requests/patient-request-requirement/patient-request-requirement.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestRequirementComponent,
  PatientRequestRequirementDialogData,
} from './patient-request-requirement.component';
import { PatientRequest } from '../../../models/patient-request.model';

describe('PatientRequestRequirementComponent', () => {
  let component: PatientRequestRequirementComponent;
  let fixture: ComponentFixture<PatientRequestRequirementComponent>;

  async function createComponent(
    dialogData: PatientRequestRequirementDialogData | null = null
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestRequirementComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestRequirementComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestRequirementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await createComponent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente e retornar lista vazia quando patient_request não for informado', async () => {
    expect(component).toBeTruthy();
    expect(component['requirements']()).toEqual([]);

    await createComponent({});
    expect(component['requirements']()).toEqual([]);
  });

  it('deve listar apenas Avaliação Médica e Avaliação Social quando type for "Entrada"', async () => {
    await createComponent({
      patient_request: {
        type: 'Entrada',
        medical_status: true,
        social_status: false,
        travel_status: true,
        cost_assistance_status: true,
      } as unknown as PatientRequest,
    });

    expect(component['requirements']()).toEqual([
      { label: 'Avaliação Médica', fulfilled: true },
      { label: 'Avaliação Social', fulfilled: false },
    ]);
  });

  it('deve listar todos os 4 requisitos quando type não for "Entrada" e avaliar status booleano', async () => {
    await createComponent({
      patient_request: {
        type: 'Agendamento',
        medical_status: true,
        social_status: null,
        travel_status: undefined,
        cost_assistance_status: false,
      } as unknown as PatientRequest,
    });

    expect(component['requirements']()).toEqual([
      { label: 'Avaliação Médica', fulfilled: true },
      { label: 'Avaliação Social', fulfilled: false },
      { label: 'TFD / Viagem', fulfilled: false },
      { label: 'Ajuda de Custo', fulfilled: false },
    ]);
  });

  it('deve marcar TFD / Viagem e Ajuda de Custo como atendidos quando truthy', async () => {
    await createComponent({
      patient_request: {
        type: 'Retorno',
        medical_status: true,
        social_status: true,
        travel_status: true,
        cost_assistance_status: true,
      } as unknown as PatientRequest,
    });

    expect(component['requirements']()).toEqual([
      { label: 'Avaliação Médica', fulfilled: true },
      { label: 'Avaliação Social', fulfilled: true },
      { label: 'TFD / Viagem', fulfilled: true },
      { label: 'Ajuda de Custo', fulfilled: true },
    ]);
  });
});