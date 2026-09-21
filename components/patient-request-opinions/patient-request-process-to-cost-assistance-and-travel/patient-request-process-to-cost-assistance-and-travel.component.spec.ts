import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ProcessPatientRequestToCostAssistanceAndTravelComponent } from './process-patient-request-to-cost-assistance-and-travel-component';
import { OpinionService } from '../../../services/opinion-service';
import { MessageService } from '../../../../core/services/message-service';

describe('ProcessPatientRequestToCostAssistanceAndTravelComponent', () => {
  let component: ProcessPatientRequestToCostAssistanceAndTravelComponent;
  let fixture: ComponentFixture<ProcessPatientRequestToCostAssistanceAndTravelComponent>;

  let opinionServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 770
    }
  };

  const mockAssistanceList = [
    { id: 1, name: 'Clara Medeiros', patient_cost_assistance_requests_count: 2 },
    { id: 2, name: 'Roberto Silva', patient_cost_assistance_requests_count: 0 }
  ];

  const mockTravelList = [
    { id: 10, name: 'Marcos Souza', patient_travel_requests_count: 5 }
  ];

  beforeEach(async () => {
    opinionServiceMock = {
      getCostAssistanceProfessionals: vi.fn(),
      getTravelProfessionals: vi.fn(),
      processPatientRequestToCostAssistanceAndTravel: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    opinionServiceMock.getCostAssistanceProfessionals.mockReturnValue(of(mockAssistanceList));
    opinionServiceMock.getTravelProfessionals.mockReturnValue(of(mockTravelList));
    opinionServiceMock.processPatientRequestToCostAssistanceAndTravel.mockReturnValue(of({ message: 'Solicitação encaminhada com sucesso!' }));

    await TestBed.configureTestingModule({
      imports: [ProcessPatientRequestToCostAssistanceAndTravelComponent],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: OpinionService, useValue: opinionServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ChangeDetectorRef
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProcessPatientRequestToCostAssistanceAndTravelComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente e inicializar campos vazios', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['tramitPatientRequestForm'].value.cost_assistance_professional_id).toBeNull();
    expect(component['tramitPatientRequestForm'].value.travel_professional_id).toBeNull();
  });

  describe('Filtros e Autocompletes em Paralelo', () => {
    it('deve carregar dados de profissionais de ajuda de custo e viagem', () => {
      fixture.detectChanges();
      expect(opinionServiceMock.getCostAssistanceProfessionals).toHaveBeenCalled();
      expect(opinionServiceMock.getTravelProfessionals).toHaveBeenCalled();
      expect(component['costAssistanceProfessionalOptions'].length).toBe(2);
      expect(component['travelProfessionalOptions'].length).toBe(1);
    });

    it('deve filtrar ajuda de custo com base na string digitada', () => {
      fixture.detectChanges();
      let filtered: any[] = [];
      component['filteredCostAssistanceProfessionalOptions'].subscribe(opts => filtered = opts);
      
      component['costAssistanceProfessionalControl'].setValue('Clara');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Clara Medeiros');
    });

    it('deve filtrar profissionais de viagem com base em objeto selecionado', () => {
      fixture.detectChanges();
      let filtered: any[] = [];
      component['filteredTravelProfessionalOptions'].subscribe(opts => filtered = opts);
      
      component['travelProfessionalControl'].setValue({ name: 'Marcos' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Marcos Souza');
    });

    it('deve marcar o formulário como dirty ao selecionar opções', () => {
      fixture.detectChanges();
      component['setCostAssistanceProfessional']({ id: 1 });
      component['setTravelProfessional']({ id: 10 });

      expect(component['tramitPatientRequestForm'].get('cost_assistance_professional_id')?.value).toBe(1);
      expect(component['tramitPatientRequestForm'].get('travel_professional_id')?.value).toBe(10);
      expect(component['tramitPatientRequestForm'].dirty).toBe(true);
    });

    it('deve exibir string vazia em displays se objeto for nulo', () => {
      expect(component['displayCostAssistanceProfessional'](null)).toBe('');
      expect(component['displayTravelProfessional'](null)).toBe('');
    });
  });

  describe('Fluxo de Submissão (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();

      // Altera a propriedade interna sem reatribuir o objeto readonly inteiro
      if (component['data'] && component['data'].patient_request) {
        component['data'].patient_request.id = 770;
      } else {
        // Caso o objeto não exista por algum motivo no escopo, redefine via property descriptor
        Object.defineProperty(component, 'data', {
          value: { patient_request: { id: 770 } },
          writable: true,
          configurable: true
        });
      }

      // Isola perfeitamente o estado do formulário forçando validade total
      const form = component['tramitPatientRequestForm'];
      Object.keys(form.controls).forEach(key => {
        const control = form.get(key);
        control?.clearValidators();
        control?.clearAsyncValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      Object.defineProperty(form, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(form, 'valid', { get: () => true, configurable: true });
    });

    it('deve barrar se o formulário estiver de fato inválido', () => {
      const form = component['tramitPatientRequestForm'];
      Object.defineProperty(form, 'invalid', { get: () => true, configurable: true });

      component['onSubmit']();
      expect(opinionServiceMock.processPatientRequestToCostAssistanceAndTravel).not.toHaveBeenCalled();
    });

    it('deve disparar erro se id do request for inexistente', () => {
      component['data'].patient_request.id = null;
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
    });

    it('deve encaminhar com sucesso e fechar modal', () => {
      component['tramitPatientRequestForm'].patchValue({ cost_assistance_professional_id: 1 });
      component['onSubmit']();

      expect(opinionServiceMock.processPatientRequestToCostAssistanceAndTravel).toHaveBeenCalledWith(
        770, 
        component['tramitPatientRequestForm'].getRawValue()
      );
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação encaminhada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve capturar mensagens estruturadas de erro da API', () => {
      component['tramitPatientRequestForm'].patchValue({ cost_assistance_professional_id: 1 });
      opinionServiceMock.processPatientRequestToCostAssistanceAndTravel.mockReturnValue(
        throwError(() => ({ error: { message: 'Limite de trâmites excedido.' } }))
      );
      
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Limite de trâmites excedido.');
    });
  });
});