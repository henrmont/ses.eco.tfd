import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSelectChange } from '@angular/material/select';
import { of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CreatePatientRequestComponent } from './create-patient-request-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreatePatientRequestComponent', () => {
  let component: CreatePatientRequestComponent;
  let fixture: ComponentFixture<CreatePatientRequestComponent>;

  let patientRequestServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockPatientsResponse = [
    { id: 1, status: true, is_valid: true, patient: { name: 'Carlos Alberto' } },
    { id: 2, status: false, is_valid: true, patient: { name: 'Inativo' } }
  ];

  const mockCidsResponse = [
    { id: 10, cid: { code: 'A00', name: 'Cólera' } },
    { id: 11, cid: { code: 'B10', name: 'Herpes' } }
  ];

  const mockHospitalsResponse = [
    { id: 20, name: 'Hospital de Base' },
    { id: 21, name: 'UPA Central' }
  ];

  beforeEach(async () => {
    patientRequestServiceMock = {
      getPatients: vi.fn(),
      getReports: vi.fn(),
      getHospitalUnities: vi.fn(),
      createPatientRequest: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    patientRequestServiceMock.getPatients.mockReturnValue(of(mockPatientsResponse));
    patientRequestServiceMock.getHospitalUnities.mockReturnValue(of(mockHospitalsResponse));
    patientRequestServiceMock.getReports.mockReturnValue(of(mockCidsResponse));
    patientRequestServiceMock.createPatientRequest.mockReturnValue(of({ message: 'Sucesso!' }));

    await TestBed.configureTestingModule({
      imports: [CreatePatientRequestComponent],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: PatientRequestService, useValue: patientRequestServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: {} }
      ]
    })
    .overrideComponent(CreatePatientRequestComponent, {
      set: {
        providers: [{ provide: MatDialogRef, useValue: dialogRefMock }]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatePatientRequestComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar os formulários com valores padrão', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isScheduling']()).toBe(false);
    expect(component['createPatientRequestForm']).toBeTruthy();
  });

  describe('Ciclo Reativo e Condicionais de Tipo (Effect)', () => {
    it('deve habilitar e validar a data da consulta quando for uma solicitação de Agendamento', () => {
      fixture.detectChanges();
      
      component['isScheduling'].set(true);
      TestBed.flushEffects(); // ✅ Executa os efeitos síncronos baseados em Signals sem precisar de Zone.js

      const dateControl = component['createPatientRequestForm'].get('consultation_date');
      expect(dateControl?.enabled).toBe(true);
      
      dateControl?.setValue(null);
      expect(dateControl?.valid).toBe(false);
    });

    it('deve desabilitar e limpar o campo de data quando não for Agendamento', () => {
      fixture.detectChanges();
      
      const dateControl = component['createPatientRequestForm'].get('consultation_date');
      
      // 1. Força ir para "true" primeiro para mudar o estado inicial do componente
      component['isScheduling'].set(true);
      TestBed.flushEffects();
      
      // 2. Simula o preenchimento de uma data pelo usuário
      dateControl?.setValue(new Date());
      expect(dateControl?.value).toBeTruthy();

      // 3. Agora muda para "false" para garantir que o Effect detecte a alteração
      component['isScheduling'].set(false);
      TestBed.flushEffects(); // Dispara o bloco condicional do Effect

      // Asserções finais
      expect(dateControl?.enabled).toBe(false);
      expect(dateControl?.value).toBeNull();
    });

    it('deve alternar o sinal de agendamento no evento de mudança de seleção do template', () => {
      fixture.detectChanges();
      
      const mockEvent = { value: 'Agendamento' } as MatSelectChange;
      component['onTypeSelectionChange'](mockEvent);
      expect(component['isScheduling']()).toBe(true);

      const mockEvent2 = { value: 'Consulta Regular' } as MatSelectChange;
      component['onTypeSelectionChange'](mockEvent2);
      expect(component['isScheduling']()).toBe(false);
    });
  });

  describe('Buscas Automáticas e Autocomplete (Filtros RxJS)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve filtrar pacientes pelo nome digitado', () => {
      component['patientControl'].setValue('Carlos');
      fixture.detectChanges();

      let options: any[] = [];
      component['filteredPatientOptions'].pipe(take(1)).subscribe(res => options = res);
      
      expect(options.length).toBe(1);
      expect(options[0].name).toBe('Carlos Alberto');
    });

    it('deve carregar e filtrar CIDs vinculados após selecionar um paciente', () => {
      const selectedPatientCare = { id: 99, name: 'Carlos Alberto' };
      component['onPatientSelected'](selectedPatientCare);

      expect(patientRequestServiceMock.getReports).toHaveBeenCalledWith(99);
    });

    it('deve tratar falhas de rede na busca de pacientes de forma segura', () => {
      patientRequestServiceMock.getPatients.mockReturnValue(throwError(() => new Error('Erro de Rede')));
      
      fixture = TestBed.createComponent(CreatePatientRequestComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['patientReadOnly']()).toBe(true);
    });
  });

  describe('Fluxo de Submissão do Formulário (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      component['patientControl'].setValue('Carlos Alberto');
      component['cidControl'].setValue('A00 - Cólera');
      component['hospitalControl'].setValue('Hospital de Base');

      component['createPatientRequestForm'].patchValue({
        report_id: 10,
        type: 'Consulta Regular',
        hospital_unity_id: 20,
        observation: 'Urgência operacional'
      });
    });

    it('deve reter a submissão e marcar controles se qualquer campo isolado ou principal for inválido', () => {
      // ✅ Invalida explicitamente tanto o form de controle solto quanto o principal para travar o fluxo com segurança
      component['patientControl'].setValue(null); 
      component['createPatientRequestForm'].get('report_id')?.setValue(null);
      fixture.detectChanges();

      component['onSubmit']();
      expect(patientRequestServiceMock.createPatientRequest).not.toHaveBeenCalled();
    });

    it('deve submeter a solicitação, emitir mensagem de sucesso do backend e fechar o diálogo', () => {
      patientRequestServiceMock.createPatientRequest.mockReturnValue(of({ message: 'Solicitação salva!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação salva!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve gerenciar falhas do servidor na criação sem estourar falhas em tela', () => {
      const serverError = { error: { message: 'Inconsistência cadastral no TFD.' } };
      patientRequestServiceMock.createPatientRequest.mockReturnValue(throwError(() => serverError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Inconsistência cadastral no TFD.');
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });

  describe('Tratamento de Exceções e Métodos Auxiliares de Template (Display Fns)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve formatar adequadamente as funções de exibição (Display Functions) para os autocompletes', () => {
      expect(component['displayPatient']({ name: 'Ana' })).toBe('Ana');
      expect(component['displayPatient'](null)).toBe('');

      expect(component['displayCid']({ code: 'A10', name: 'Febre' })).toBe('A10 - Febre');
      expect(component['displayCid'](null)).toBe('');

      expect(component['displayHospitalUnity']({ name: 'Hosp' })).toBe('Hosp');
    });

    it('deve acionar o fallback padrão de erro se a resposta do servidor vier sem corpo de mensagem', () => {
      component['patientControl'].setValue('Valid');
      component['cidControl'].setValue('Valid');
      component['hospitalControl'].setValue('Valid');
      component['createPatientRequestForm'].patchValue({
        report_id: 1, type: 'Procedimento', hospital_unity_id: 1, observation: 'Obs'
      });
      fixture.detectChanges();

      expect(component['createPatientRequestForm'].valid).toBe(true);

      patientRequestServiceMock.createPatientRequest.mockReturnValue(throwError(() => ({ status: 500 })));
      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Houve um erro operacional ao criar a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});