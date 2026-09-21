import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ProcessPatientRequestToPaymentComponent } from './process-patient-request-to-payment-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { MessageService } from '../../../../core/services/message-service';
import { Archive } from '../../../models/archive';

describe('ProcessPatientRequestToPaymentComponent', () => {
  let component: ProcessPatientRequestToPaymentComponent;
  let fixture: ComponentFixture<ProcessPatientRequestToPaymentComponent>;

  let costAssistanceServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 770,
      attachments: [
        { id: 101, archive: 'documento_identidade.pdf' } as Archive,
        { id: 102, archive: 'comprovante_residencia.pdf' } as Archive
      ]
    }
  };

  const mockPaymentProfessionals = [
    { id: 1, name: 'Clara Medeiros', patient_payment_requests_count: 2 },
    { id: 2, name: 'Roberto Silva', patient_payment_requests_count: 0 }
  ];

  beforeEach(async () => {
    costAssistanceServiceMock = {
      getPaymentProfessionals: vi.fn(),
      processPatientRequestToPayment: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    costAssistanceServiceMock.getPaymentProfessionals.mockReturnValue(of(mockPaymentProfessionals));
    costAssistanceServiceMock.processPatientRequestToPayment.mockReturnValue(of({ message: 'Solicitação processada para pagamento com sucesso!' }));

    await TestBed.configureTestingModule({
      imports: [ProcessPatientRequestToPaymentComponent],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ChangeDetectorRef
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProcessPatientRequestToPaymentComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente e inicializar campos vazios no formulário', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['tramitPatientRequestForm'].value.payment_professional_id).toBeNull();
    expect(component['tramitPatientRequestForm'].value.archives).toEqual([]);
  });

  describe('Filtros e Comportamentos do Autocomplete', () => {
    it('deve carregar dados de profissionais de pagamento na inicialização', () => {
      fixture.detectChanges();
      expect(costAssistanceServiceMock.getPaymentProfessionals).toHaveBeenCalled();
      expect(component['paymentProfessionalOptions'].length).toBe(2);
      expect(component['paymentProfessionalReadOnly']()).toBe(false);
    });

    it('deve lidar com erro ao carregar profissionais de pagamento travando o campo como readonly', () => {
      costAssistanceServiceMock.getPaymentProfessionals.mockReturnValue(throwError(() => new Error('Erro')));
      fixture.detectChanges();
      expect(component['paymentProfessionalReadOnly']()).toBe(true);
    });

    it('deve filtrar profissionais com base na string digitada', () => {
      fixture.detectChanges();
      let filtered: any[] = [];
      component['filteredPaymentProfessionalOptions'].subscribe(opts => filtered = opts);
      
      component['paymentProfessionalControl'].setValue('Clara');
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Clara Medeiros');
    });

    it('deve filtrar profissionais utilizando o fatiamento máximo padrão quando termo for vazio', () => {
      fixture.detectChanges();
      let filtered: any[] = [];
      component['filteredPaymentProfessionalOptions'].subscribe(opts => filtered = opts);
      
      component['paymentProfessionalControl'].setValue('');
      expect(filtered.length).toBe(2);
    });

    it('deve filtrar profissionais de pagamento com base em objeto selecionado', () => {
      fixture.detectChanges();
      let filtered: any[] = [];
      component['filteredPaymentProfessionalOptions'].subscribe(opts => filtered = opts);
      
      component['paymentProfessionalControl'].setValue({ name: 'Roberto' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Roberto Silva');
    });

    it('deve marcar o formulário como dirty e vincular o ID ao selecionar uma opção', () => {
      fixture.detectChanges();
      component['setPaymentProfessional']({ id: 2 });

      expect(component['tramitPatientRequestForm'].get('payment_professional_id')?.value).toBe(2);
      expect(component['tramitPatientRequestForm'].dirty).toBe(true);
    });

    it('deve retornar string vazia em display se o objeto profissional for nulo', () => {
      expect(component['displayPaymentProfessional'](null)).toBe('');
    });
  });

  describe('Gerenciamento Imutável de Arquivos (toggleArchive)', () => {
    it('deve adicionar de forma imutável o ID do arquivo ao array se ele não estiver selecionado', () => {
      fixture.detectChanges();
      const mockItem = { id: 101, archive: 'documento_identidade.pdf' } as Archive;
      
      component['toggleArchive'](mockItem);
      
      expect(component['tramitPatientRequestForm'].value.archives).toEqual([101]);
      expect(component['tramitPatientRequestForm'].dirty).toBe(true);
    });

    it('deve remover de forma imutável o ID do arquivo se ele já estiver selecionado no formulário', () => {
      fixture.detectChanges();
      const mockItem = { id: 101, archive: 'documento_identidade.pdf' } as Archive;
      
      component['tramitPatientRequestForm'].patchValue({ archives: [101, 102] });
      
      component['toggleArchive'](mockItem);
      
      expect(component['tramitPatientRequestForm'].value.archives).toEqual([102]);
    });
  });

  describe('Fluxo de Submissão (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();

      if (component['data'] && component['data'].patient_request) {
        component['data'].patient_request.id = 770;
      } else {
        Object.defineProperty(component, 'data', {
          value: { patient_request: { id: 770 } },
          writable: true,
          configurable: true
        });
      }

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

    it('deve barrar o envio se o formulário estiver inválido e marcar os campos como touched', () => {
      const form = component['tramitPatientRequestForm'];
      Object.defineProperty(form, 'invalid', { get: () => true, configurable: true });

      component['onSubmit']();
      expect(costAssistanceServiceMock.processPatientRequestToPayment).not.toHaveBeenCalled();
      expect(component['paymentProfessionalControl'].touched).toBe(true);
    });

    it('deve disparar mensagem de erro se o ID do request não for localizado na modal', () => {
      component['data'].patient_request.id = null;
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
    });

    it('deve processar para pagamento com sucesso, exibir toast e fechar a modal de trâmite', () => {
      component['tramitPatientRequestForm'].patchValue({ payment_professional_id: 2, archives: [101] });
      component['onSubmit']();

      expect(costAssistanceServiceMock.processPatientRequestToPayment).toHaveBeenCalledWith(
        770, 
        component['tramitPatientRequestForm'].getRawValue()
      );
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação processada para pagamento com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve capturar e tratar mensagens de erro customizadas retornadas do servidor', () => {
      component['tramitPatientRequestForm'].patchValue({ payment_professional_id: 2 });
      costAssistanceServiceMock.processPatientRequestToPayment.mockReturnValue(
        throwError(() => ({ error: { message: 'Este trâmite não é permitido para o estado atual da solicitação.' } }))
      );
      
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Este trâmite não é permitido para o estado atual da solicitação.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});