import { TestBed, ComponentFixture, fakeAsync, tick } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ProcessPatientRequestComponent } from './process-patient-request-component';
import { PatientRequestService } from '../../../services/patient-request-service';
import { MessageService } from '../../../../core/services/message-service';

describe('ProcessPatientRequestComponent', () => {
  let component: ProcessPatientRequestComponent;
  let fixture: ComponentFixture<ProcessPatientRequestComponent>;

  let patientRequestServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 550,
      report: {
        patient_care: { name: 'Carlos de Souza' }
      }
    }
  };

  const mockProfessionalsList = [
    { id: 10, name: 'Dr. Roberto Cruz', patient_medical_requests_count: 3, patient: { name: 'Dr. Roberto Cruz' } },
    { id: 20, name: 'Dr. Adalberto Silva', patient_medical_requests_count: 0, patient: { name: 'Dr. Adalberto Silva' } },
    { id: 30, name: 'Dra. Amanda Costa', patient_medical_requests_count: 1, patient: { name: 'Dra. Amanda Costa' } }
  ];

  beforeEach(async () => {
    patientRequestServiceMock = {
      getMedicalProfessionals: vi.fn(),
      processPatientRequestToMedical: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    // Respostas padrão das Streams assinadas
    patientRequestServiceMock.getMedicalProfessionals.mockReturnValue(of(mockProfessionalsList));
    patientRequestServiceMock.processPatientRequestToMedical.mockReturnValue(of({ message: 'Solicitação encaminhada com sucesso!' }));

    await TestBed.configureTestingModule({
      imports: [
        ProcessPatientRequestComponent
      ],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: PatientRequestService, useValue: patientRequestServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ChangeDetectorRef
      ]
    })
    .overrideComponent(ProcessPatientRequestComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProcessPatientRequestComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário reativo vazio', () => {
    fixture.detectChanges();
    
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['tramitPatientRequestForm']).toBeTruthy();

    const formValues = component['tramitPatientRequestForm'].value;
    expect(formValues.medical_professional_id).toBeNull();
  });

  describe('Buscas Automáticas e Autocomplete (Médicos) na Tramitação', () => {
    it('deve carregar a lista de profissionais médicos mapeando as propriedades do patient anexado', () => {
      fixture.detectChanges();

      expect(patientRequestServiceMock.getMedicalProfessionals).toHaveBeenCalled();
      expect(component['medicalProfessionalOptions'].length).toBe(3);
      expect(component['medicalProfessionalReadOnly']()).toBe(false);
      expect(component['medicalProfessionalOptions'][0].name).toBe('Dr. Roberto Cruz');
    });

    it('deve filtrar as opções de médicos com base no input do formulário em formato String', () => {
      fixture.detectChanges();

      let resultOptions: any[] = [];
      component['filteredMedicalProfessionalOptions'].subscribe(options => {
        resultOptions = options;
      });

      // Dispara o valor diretamente para ativar a stream reativa do valueChanges
      component['medicalProfessionalControl'].setValue('Adalberto');

      expect(resultOptions.length).toBe(1);
      expect(resultOptions[0].name).toBe('Dr. Adalberto Silva');
    });

    it('deve filtrar as opções de médicos corretamente quando o valor do input for um objeto Médico', () => {
      fixture.detectChanges();

      let resultOptions: any[] = [];
      component['filteredMedicalProfessionalOptions'].subscribe(options => {
        resultOptions = options;
      });

      const selectedObj = { id: 30, name: 'Dra. Amanda Costa' };
      component['medicalProfessionalControl'].setValue(selectedObj);

      // Retorna exatamente 1 item (o médico correspondente ao nome do objeto selecionado)
      expect(resultOptions.length).toBe(1);
      expect(resultOptions[0].name).toBe('Dra. Amanda Costa');
    });

    it('deve manter medicalProfessionalReadOnly como verdadeiro quando a busca de médicos falhar na inicialização', () => {
      patientRequestServiceMock.getMedicalProfessionals.mockReturnValue(throwError(() => new Error('Erro na API')));
      
      fixture = TestBed.createComponent(ProcessPatientRequestComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['medicalProfessionalReadOnly']()).toBe(true);
    });

    it('deve formatar o texto de exibição do médico corretamente através de displayMedicalProfessional', () => {
      fixture.detectChanges();
      const docObj = { id: 10, name: 'Dr. Roberto Cruz' };
      expect(component['displayMedicalProfessional'](docObj)).toBe('Dr. Roberto Cruz');
      expect(component['displayMedicalProfessional'](null)).toBe('');
    });

    it('deve atualizar o controle medical_professional_id e marcar o formulário como dirty ao disparar setMedicalProfessional', () => {
      fixture.detectChanges();
      const selectedDoc = { id: 20, name: 'Dr. Adalberto Silva' };
      
      component['setMedicalProfessional'](selectedDoc);
      fixture.detectChanges();

      const docIdControl = component['tramitPatientRequestForm'].get('medical_professional_id');
      expect(docIdControl?.value).toBe(20);
      expect(component['tramitPatientRequestForm'].dirty).toBe(true);
    });
  });

  describe('Fluxo de Submissão e Tramitação do Pedido (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();

      // Limpa validações para isolamento perfeito de testes de submissão
      const tramitForm = component['tramitPatientRequestForm'];
      Object.keys(tramitForm.controls).forEach(key => {
        const control = tramitForm.get(key);
        control?.clearValidators();
        control?.clearAsyncValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      Object.defineProperty(tramitForm, 'invalid', { get: () => !tramitForm.valid, configurable: true });
      Object.defineProperty(tramitForm, 'valid', { get: () => !tramitForm.errors, configurable: true });
    });

    it('deve barrar a submissão marcando controles como touched se o formulário estiver inválido', () => {
      component['tramitPatientRequestForm'].setErrors({ required: true });

      component['onSubmit']();
      
      expect(component['tramitPatientRequestForm'].touched).toBe(true);
      expect(component['medicalProfessionalControl'].touched).toBe(true);
      expect(patientRequestServiceMock.processPatientRequestToMedical).not.toHaveBeenCalled();
    });

    it('deve barrar a submissão e exibir alerta se o ID da solicitação do paciente não existir nos dados da modal', () => {
      // 🎯 CORREÇÃO: Altera a propriedade interna em vez de reatribuir o objeto completo 'data'
      component['data'].patient_request.id = null;

      component['onSubmit']();
      
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
      expect(patientRequestServiceMock.processPatientRequestToMedical).not.toHaveBeenCalled();
    });

    it('deve tramitar a solicitação com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      // Garante que o ID esteja restaurado para o teste de sucesso
      component['data'].patient_request.id = 550;
      
      component['tramitPatientRequestForm'].patchValue({
        medical_professional_id: 10
      });

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false); // Validado via Pipe Finalize
      expect(patientRequestServiceMock.processPatientRequestToMedical).toHaveBeenCalledWith(
        550,
        component['tramitPatientRequestForm'].getRawValue()
      );
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação encaminhada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve lidar amigavelmente com falhas estruturadas do backend ao tramitar', () => {
      component['data'].patient_request.id = 550;
      component['tramitPatientRequestForm'].patchValue({ medical_professional_id: 10 });
      
      const mockApiError = { error: { message: 'Médico selecionado indisponível para novos trâmites.' } };
      patientRequestServiceMock.processPatientRequestToMedical.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Médico selecionado indisponível para novos trâmites.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Cobertura de Branches de Exceção e Casos de Borda', () => {
    it('deve exibir mensagem genérica de erro caso o servidor falhe no onSubmit sem retornar uma mensagem estruturada', () => {
      fixture.detectChanges();
      
      const tramitForm = component['tramitPatientRequestForm'];
      Object.defineProperty(tramitForm, 'invalid', { get: () => false, configurable: true });

      // Simula um erro HTTP 500 puro sem corpo de mensagem interno
      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      patientRequestServiceMock.processPatientRequestToMedical.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao tentar encaminhar a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve garantir que o ciclo finalize de carregamento limpe o estado visual mesmo em quebras drásticas da API', () => {
      patientRequestServiceMock.getMedicalProfessionals.mockReturnValue(throwError(() => new Error('Crash')));
      
      fixture = TestBed.createComponent(ProcessPatientRequestComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['medicalProfessionalOptions']).toEqual([]);
      expect(component['medicalProfessionalLoading']()).toBe(false);
      expect(component['medicalProfessionalReadOnly']()).toBe(true);
    });
  });
});