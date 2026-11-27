// src/app/tfd/components/patient-requests/patient-request-process/patient-request-process.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GroupedProfessionalsResponse,
  PatientRequestProcessComponent,
  PatientRequestProcessDialogData,
  ProfessionalOption,
} from './patient-request-process.component';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientRequestProcessComponent', () => {
  let component: PatientRequestProcessComponent;
  let fixture: ComponentFixture<PatientRequestProcessComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientRequestServiceMock: {
    getProfessionals: ReturnType<typeof vi.fn>;
    processPatientRequest: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const medicalProf: ProfessionalOption = { id: 1, name: 'Dr. João', requests_count: 2 };
  const socialProf: ProfessionalOption = { id: 2, name: 'Dra. Maria', requests_count: 1 };
  const travelProf: ProfessionalOption = { id: 3, name: 'Carlos Viagens', requests_count: 4 };
  const costProf: ProfessionalOption = { id: 4, name: 'Ana Custos', requests_count: 3 };

  const groupedResponse: GroupedProfessionalsResponse = {
    medical_professionals: [medicalProf],
    social_professionals: [socialProf],
    travel_professionals: [travelProf],
    cost_assistance_professionals: [costProf],
  };

  async function createComponent(
    dialogData: PatientRequestProcessDialogData | null = {
      patient_request: {
        id: 120,
        type: 'Entrada',
      } as unknown as PatientRequest,
    }
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestProcessComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestProcessComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientRequestProcessComponent);
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
      getProfessionals: vi.fn().mockReturnValue(of(groupedResponse)),
      processPatientRequest: vi.fn().mockReturnValue(of({ message: 'Processado!' })),
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

  it('deve criar o componente, abrir o BroadcastChannel e carregar profissionais agrupados', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patient-requests-channel');
    expect(patientRequestServiceMock.getProfessionals).toHaveBeenCalledTimes(1);
    expect(component['isLoadingProfessionals']()).toBe(false);
    expect(component['isReadOnly']()).toBe(false);
    expect(component['isEntranceType']()).toBe(true);
    expect(component['filteredMedicalOptions']()).toEqual([medicalProf]);
    expect(component['filteredSocialOptions']()).toEqual([socialProf]);
    expect(component['filteredTravelOptions']()).toEqual([travelProf]);
    expect(component['filteredCostAssistanceOptions']()).toEqual([costProf]);
    expect(component['processForm'].enabled).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve suportar resposta em array, resposta inválida e erro ao carregar profissionais', async () => {
    const arrayList: ProfessionalOption[] = Array.from({ length: 12 }, (_, idx) => ({
      id: idx + 1,
      name: `Profissional ${idx + 1}`,
    }));
    patientRequestServiceMock.getProfessionals.mockReturnValueOnce(of(arrayList));
    await createComponent();
    expect(component['filteredMedicalOptions']()).toHaveLength(10);

    patientRequestServiceMock.getProfessionals.mockReturnValueOnce(of(null));
    await createComponent();
    expect(component['filteredMedicalOptions']()).toEqual([]);

    patientRequestServiceMock.getProfessionals.mockReturnValueOnce(
      throwError(() => new Error('Falha ao buscar profissionais'))
    );
    await createComponent();
    expect(component['isReadOnly']()).toBe(true);
    expect(component['filteredMedicalOptions']()).toEqual([]);
  });

  describe('Display, Filtros, Sincronização e Tipo', () => {
    it('deve formatar displayProfessionalFn e filtrar opções por texto ou objeto', () => {
      expect(component['displayProfessionalFn'](null)).toBe('');
      expect(component['displayProfessionalFn']('')).toBe('');
      expect(component['displayProfessionalFn']('Texto')).toBe('Texto');
      expect(component['displayProfessionalFn'](medicalProf)).toBe('Dr. João');
      expect(component['displayProfessionalFn']({ id: 9, name: '' })).toBe('');

      component['medicalProfessionalControl'].setValue('João');
      expect(component['filteredMedicalOptions']()).toEqual([medicalProf]);

      component['medicalProfessionalControl'].setValue(socialProf);
      expect(component['filteredMedicalOptions']()).toEqual([]);

      component['socialProfessionalControl'].setValue('Maria');
      expect(component['filteredSocialOptions']()).toEqual([socialProf]);

      component['travelProfessionalControl'].setValue('Carlos');
      expect(component['filteredTravelOptions']()).toEqual([travelProf]);

      component['costAssistanceProfessionalControl'].setValue('Ana');
      expect(component['filteredCostAssistanceOptions']()).toEqual([costProf]);
    });

    it('deve sincronizar IDs no processForm e exigir passagem/ajuda quando type não for Entrada', async () => {
      await createComponent({
        patient_request: {
          id: 120,
          type: 'Agendamento',
        } as unknown as PatientRequest,
      });

      expect(component['isEntranceType']()).toBe(false);
      expect(component['isFormInvalid']()).toBe(true);

      component['medicalProfessionalControl'].setValue(medicalProf);
      component['socialProfessionalControl'].setValue(socialProf);
      component['travelProfessionalControl'].setValue(travelProf);
      component['costAssistanceProfessionalControl'].setValue(costProf);

      expect(component['processForm'].get('medical_professional_id')?.value).toBe(1);
      expect(component['processForm'].get('social_professional_id')?.value).toBe(2);
      expect(component['processForm'].get('travel_professional_id')?.value).toBe(3);
      expect(component['processForm'].get('cost_assistance_professional_id')?.value).toBe(4);
      expect(component['isFormInvalid']()).toBe(false);

      component['medicalProfessionalControl'].setValue('Apenas Texto');
      expect(component['processForm'].get('medical_professional_id')?.value).toBeNull();

      component['processForm'].get('type')?.setValue('Entrada');
      expect(component['isEntranceType']()).toBe(true);
      expect(component['processForm'].get('travel_professional_id')?.value).toBeNull();
      expect(component['processForm'].get('cost_assistance_professional_id')?.value).toBeNull();
      expect(component['travelProfessionalControl'].value).toBe('');
      expect(component['costAssistanceProfessionalControl'].value).toBe('');
    });
  });

  describe('Processamento (onSubmit)', () => {
    it('deve exibir mensagem quando patient_request.id não for encontrado', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da solicitação não encontrado.'
      );
      expect(patientRequestServiceMock.processPatientRequest).not.toHaveBeenCalled();
    });

    it('deve marcar controles como touched e não enviar quando processForm for inválido', () => {
      component['onSubmit']();

      expect(component['processForm'].get('medical_professional_id')?.touched).toBe(true);
      expect(component['processForm'].get('social_professional_id')?.touched).toBe(true);
      expect(patientRequestServiceMock.processPatientRequest).not.toHaveBeenCalled();
    });

    it('deve gerenciar isSubmitting, enviar payload, notificar canal e fechar dialog no sucesso', () => {
      component['medicalProfessionalControl'].setValue(medicalProf);
      component['socialProfessionalControl'].setValue(socialProf);

      const pending$ = new Subject<{ message?: string }>();
      patientRequestServiceMock.processPatientRequest.mockReturnValueOnce(pending$.asObservable());

      component['onSubmit']();
      fixture.detectChanges();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['processForm'].disabled).toBe(true);
      expect(patientRequestServiceMock.processPatientRequest).toHaveBeenCalledWith(120, {
        type: 'Entrada',
        medical_professional_id: 1,
        social_professional_id: 2,
        travel_professional_id: null,
        cost_assistance_professional_id: null,
      });

      pending$.next({ message: 'Solicitação encaminhada!' });
      pending$.complete();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['processForm'].enabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação encaminhada!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso e tratar erros da API ou fallback', () => {
      component['medicalProfessionalControl'].setValue(medicalProf);
      component['socialProfessionalControl'].setValue(socialProf);

      patientRequestServiceMock.processPatientRequest.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Solicitação processada com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      patientRequestServiceMock.processPatientRequest.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Profissional indisponível.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Profissional indisponível.');

      patientRequestServiceMock.processPatientRequest.mockReturnValueOnce(
        throwError(() => new Error('Erro inesperado'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Houve um erro operacional ao processar a solicitação.'
      );
    });
  });
});