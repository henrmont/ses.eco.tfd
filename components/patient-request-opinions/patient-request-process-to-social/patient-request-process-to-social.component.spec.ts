import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ProcessPatientRequestToSocialComponent } from './process-patient-request-to-social-component';
import { OpinionService } from '../../../services/opinion-service';
import { MessageService } from '../../../../core/services/message-service';

describe('ProcessPatientRequestToSocialComponent', () => {
  let component: ProcessPatientRequestToSocialComponent;
  let fixture: ComponentFixture<ProcessPatientRequestToSocialComponent>;

  let opinionServiceMock: any;
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
    { id: 10, name: 'Sra. Mariana Luz', patient_social_requests_count: 3, patient: { name: 'Sra. Mariana Luz' } },
    { id: 20, name: 'Sr. Adalberto Silva', patient_social_requests_count: 0, patient: { name: 'Sr. Adalberto Silva' } },
    { id: 30, name: 'Sra. Amanda Costa', patient_social_requests_count: 1, patient: { name: 'Sra. Amanda Costa' } }
  ];

  beforeEach(async () => {
    opinionServiceMock = {
      getSocialProfessionals: vi.fn(),
      processPatientRequestToSocial: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    // Respostas padrão das Streams assinadas
    opinionServiceMock.getSocialProfessionals.mockReturnValue(of(mockProfessionalsList));
    opinionServiceMock.processPatientRequestToSocial.mockReturnValue(of({ message: 'Solicitação encaminhada com sucesso!' }));

    await TestBed.configureTestingModule({
      imports: [
        ProcessPatientRequestToSocialComponent
      ],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: OpinionService, useValue: opinionServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ChangeDetectorRef
      ]
    })
    .overrideComponent(ProcessPatientRequestToSocialComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProcessPatientRequestToSocialComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário reativo vazio', () => {
    fixture.detectChanges();
    
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['tramitPatientRequestForm']).toBeTruthy();

    const formValues = component['tramitPatientRequestForm'].value;
    expect(formValues.social_professional_id).toBeNull();
  });

  describe('Buscas Automáticas e Autocomplete (Assistentes Sociais) na Tramitação', () => {
    it('deve carregar a lista de profissionais sociais mapeando as propriedades do patient anexado', () => {
      fixture.detectChanges();

      expect(opinionServiceMock.getSocialProfessionals).toHaveBeenCalled();
      expect(component['socialProfessionalOptions'].length).toBe(3);
      expect(component['socialProfessionalReadOnly']()).toBe(false);
      expect(component['socialProfessionalOptions'][0].name).toBe('Sra. Mariana Luz');
    });

    it('deve filtrar as opções de assistentes sociais com base no input do formulário em formato String', () => {
      fixture.detectChanges();

      let resultOptions: any[] = [];
      component['filteredSocialProfessionalOptions'].subscribe(options => {
        resultOptions = options;
      });

      // Dispara o valor diretamente para ativar a stream reativa do valueChanges
      component['socialProfessionalControl'].setValue('Adalberto');

      expect(resultOptions.length).toBe(1);
      expect(resultOptions[0].name).toBe('Sr. Adalberto Silva');
    });

    it('deve filtrar as opções de assistentes sociais corretamente quando o valor do input for um objeto Profissional', () => {
      fixture.detectChanges();

      let resultOptions: any[] = [];
      component['filteredSocialProfessionalOptions'].subscribe(options => {
        resultOptions = options;
      });

      const selectedObj = { id: 30, name: 'Sra. Amanda Costa' };
      component['socialProfessionalControl'].setValue(selectedObj);

      expect(resultOptions.length).toBe(1);
      expect(resultOptions[0].name).toBe('Sra. Amanda Costa');
    });

    it('deve manter socialProfessionalReadOnly como verdadeiro quando a busca de assistentes sociais falhar na inicialização', () => {
      opinionServiceMock.getSocialProfessionals.mockReturnValue(throwError(() => new Error('Erro na API')));
      
      fixture = TestBed.createComponent(ProcessPatientRequestToSocialComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['socialProfessionalReadOnly']()).toBe(true);
    });

    it('deve formatar o texto de exibição do profissional corretamente através de displaySocialProfessional', () => {
      fixture.detectChanges();
      const docObj = { id: 10, name: 'Sra. Mariana Luz' };
      expect(component['displaySocialProfessional'](docObj)).toBe('Sra. Mariana Luz');
      expect(component['displaySocialProfessional'](null)).toBe('');
    });

    it('deve atualizar o controle social_professional_id e marcar o formulário como dirty ao disparar setSocialProfessional', () => {
      fixture.detectChanges();
      const selectedDoc = { id: 20, name: 'Sr. Adalberto Silva' };
      
      component['setSocialProfessional'](selectedDoc);
      fixture.detectChanges();

      const docIdControl = component['tramitPatientRequestForm'].get('social_professional_id');
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
      expect(component['socialProfessionalControl'].touched).toBe(true);
      expect(opinionServiceMock.processPatientRequestToSocial).not.toHaveBeenCalled();
    });

    it('deve barrar a submissão e exibir alerta se o ID da solicitação do paciente não existir nos dados da modal', () => {
      component['data'].patient_request.id = null;

      component['onSubmit']();
      
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
      expect(opinionServiceMock.processPatientRequestToSocial).not.toHaveBeenCalled();
    });

    it('deve tramitar a solicitação com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['data'].patient_request.id = 550;
      
      component['tramitPatientRequestForm'].patchValue({
        social_professional_id: 10
      });

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false); 
      expect(opinionServiceMock.processPatientRequestToSocial).toHaveBeenCalledWith(
        550,
        component['tramitPatientRequestForm'].getRawValue()
      );
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação encaminhada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve lidar amigavelmente com falhas estruturadas do backend ao tramitar', () => {
      component['data'].patient_request.id = 550;
      component['tramitPatientRequestForm'].patchValue({ social_professional_id: 10 });
      
      const mockApiError = { error: { message: 'Profissional selecionado indisponível para novos trâmites.' } };
      opinionServiceMock.processPatientRequestToSocial.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Profissional selecionado indisponível para novos trâmites.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Cobertura de Branches de Exceção e Casos de Borda', () => {
    it('deve exibir mensagem genérica de erro caso o servidor falhe no onSubmit sem retornar uma mensagem estruturada', () => {
      fixture.detectChanges();
      
      const tramitForm = component['tramitPatientRequestForm'];
      Object.defineProperty(tramitForm, 'invalid', { get: () => false, configurable: true });

      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      opinionServiceMock.processPatientRequestToSocial.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao tentar encaminhar a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve garantir que o ciclo finalize de carregamento limpe o estado visual mesmo em quebras drásticas da API', () => {
      opinionServiceMock.getSocialProfessionals.mockReturnValue(throwError(() => new Error('Crash')));
      
      fixture = TestBed.createComponent(ProcessPatientRequestToSocialComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['socialProfessionalOptions']).toEqual([]);
      expect(component['socialProfessionalLoading']()).toBe(false);
      expect(component['socialProfessionalReadOnly']()).toBe(true);
    });
  });
});