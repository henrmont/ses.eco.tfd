import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSelectChange } from '@angular/material/select';
import { of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { UpdatePatientRequestComponent } from './update-patient-request-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdatePatientRequestComponent', () => {
  let component: UpdatePatientRequestComponent;
  let fixture: ComponentFixture<UpdatePatientRequestComponent>;

  let patientRequestServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogInputData = {
    patient_request: {
      id: 55,
      report_id: 10,
      type: 'Consulta Regular',
      consultation_date: '2026-06-17T00:00:00.000Z',
      hospital_unity_id: 20,
      observation: 'Observação existente',
      hospital_unity: { id: 20, name: 'Hospital de Base' },
      report: {
        id: 10,
        cid: { code: 'A00', name: 'Cólera' },
        patient_care: {
          id: 100,
          patient: { id: 1, name: 'Carlos Alberto' }
        }
      }
    }
  };

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
      updatePatientRequest: vi.fn()
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
    patientRequestServiceMock.updatePatientRequest.mockReturnValue(of({ message: 'Atualizado com sucesso!' }));

    await TestBed.configureTestingModule({
      imports: [UpdatePatientRequestComponent],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: PatientRequestService, useValue: patientRequestServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogInputData }
      ]
    })
    .overrideComponent(UpdatePatientRequestComponent, {
      set: {
        providers: [{ provide: MatDialogRef, useValue: dialogRefMock }]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdatePatientRequestComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e preencher o formulário com dados prévios da solicitação', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isScheduling']()).toBe(false);
    
    const formValues = component['updatePatientRequestForm'].value;
    expect(formValues.report_id).toBe(10);
    expect(formValues.type).toBe('Consulta Regular');
    expect(formValues.hospital_unity_id).toBe(20);
    expect(formValues.observation).toBe('Observação existente');

    expect(component['patientControl'].value).toEqual({ id: 1, name: 'Carlos Alberto' });
    expect(component['hospitalUnitiesControl'].value).toEqual({ id: 20, name: 'Hospital de Base' });
  });

  describe('Ciclo Reativo e Condicionais de Tipo (Effect)', () => {
    it('deve habilitar e validar a data da consulta quando mudar para uma solicitação de Agendamento', () => {
      fixture.detectChanges();
      
      component['isScheduling'].set(true);
      TestBed.flushEffects();

      const dateControl = component['updatePatientRequestForm'].get('consultation_date');
      expect(dateControl?.enabled).toBe(true);
      
      dateControl?.setValue(null);
      expect(dateControl?.valid).toBe(false);
    });

    it('deve desabilitar e limpar o campo de data quando mudar o tipo e não for Agendamento', () => {
      fixture.detectChanges();
      
      const dateControl = component['updatePatientRequestForm'].get('consultation_date');
      
      component['isScheduling'].set(true);
      TestBed.flushEffects();
      
      dateControl?.setValue(new Date());
      expect(dateControl?.value).toBeTruthy();

      component['isScheduling'].set(false);
      TestBed.flushEffects(); 

      expect(dateControl?.enabled).toBe(false);
      expect(dateControl?.value).toBeNull();
    });

    it('deve alternar o sinal de agendamento no evento de mudança de seleção do template', () => {
      fixture.detectChanges();
      
      const mockEvent = { value: 'Agendamento' } as MatSelectChange;
      component['onTypeSelectionChange'](mockEvent);
      expect(component['isScheduling']()).toBe(true);

      const mockEvent2 = { value: 'Tratamento Fora de Domicílio' } as MatSelectChange;
      component['onTypeSelectionChange'](mockEvent2);
      expect(component['isScheduling']()).toBe(false);
    });
  });

  describe('Buscas Automáticas e Autocomplete (Filtros RxJS)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve filtrar pacientes pelo nome digitado no controle', () => {
      component['patientControl'].setValue('Alberto');
      fixture.detectChanges();

      let options: any[] = [];
      component['filteredPatientOptions'].pipe(take(1)).subscribe(res => options = res);
      
      expect(options.length).toBe(1);
      expect(options[0].name).toBe('Carlos Alberto');
    });

    it('deve carregar nova listagem de CIDs quando um paciente diferente for selecionado', () => {
      const selectedPatientCare = { id: 88, name: 'Novo Paciente' };
      component['onPatientSelected'](selectedPatientCare);

      expect(patientRequestServiceMock.getReports).toHaveBeenCalledWith(88);
      expect(component['updatePatientRequestForm'].get('report_id')?.value).toBeNull();
      expect(component['cidControl'].value).toBe('');
    });

    it('deve tratar falhas no carregamento de dados cadastrais iniciais de forma segura', () => {
      patientRequestServiceMock.getPatients.mockReturnValue(throwError(() => new Error('Falha no Servidor')));
      
      fixture = TestBed.createComponent(UpdatePatientRequestComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['patientReadOnly']()).toBe(true);
      expect(component['hospitalUnitiesReadOnly']()).toBe(true);
      expect(component['cidReadOnly']()).toBe(true);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao carregar dados cadastrais da solicitação.');
    });
  });

  describe('Fluxo de Submissão do Formulário de Edição (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve reter a submissão e marcar controles se qualquer campo do formulário principal for invalidado', () => {
      component['updatePatientRequestForm'].get('observation')?.setValue('');
      fixture.detectChanges();

      component['onSubmit'](); // 🎯 Corrigido para chamar onSubmit() igual à referência
      expect(patientRequestServiceMock.updatePatientRequest).not.toHaveBeenCalled();
    });

    it('deve submeter a alteração, emitir mensagem de sucesso do backend e fechar o diálogo passando true', () => {
      component['onSubmit'](); // 🎯 Corrigido para chamar onSubmit() igual à referência

      expect(component['isSubmitting']()).toBe(false);
      expect(patientRequestServiceMock.updatePatientRequest).toHaveBeenCalledWith(55, component['updatePatientRequestForm'].value);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve gerenciar erros retornados pelo servidor e manter o diálogo aberto', () => {
      const serverError = { error: { message: 'Não é possível alterar uma solicitação já auditada.' } };
      patientRequestServiceMock.updatePatientRequest.mockReturnValue(throwError(() => serverError));

      component['onSubmit'](); // 🎯 Corrigido para chamar onSubmit() igual à referência

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Não é possível alterar uma solicitação já auditada.');
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });

  describe('Formatadores e Exceções Auxiliares', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve responder corretamente com strings formatadas nas funções de exibição (Display)', () => {
      expect(component['displayPatient']({ name: 'Maria Silveira' })).toBe('Maria Silveira');
      expect(component['displayPatient'](null)).toBe('');

      expect(component['displayCid']({ code: 'Z00', name: 'Exame Geral' })).toBe('Z00 - Exame Geral');
      expect(component['displayCid'](null)).toBe('');

      expect(component['displayHospitalUnity']({ name: 'Hospital Regional' })).toBe('Hospital Regional');
    });

    it('deve acionar o texto de fallback caso o erro do servidor venha com a resposta vazia', () => {
      patientRequestServiceMock.updatePatientRequest.mockReturnValue(throwError(() => ({ status: 400 })));
      
      component['onSubmit'](); // 🎯 Corrigido para chamar onSubmit() igual à referência

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Houve um erro operacional ao atualizar a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});