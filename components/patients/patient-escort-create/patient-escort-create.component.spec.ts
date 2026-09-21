import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNgxMask } from 'ngx-mask';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CreatePatientEscortComponent } from './create-patient-escort-component';
import { PatientService } from '../../../services/patient-service';
import { ViacepService } from '../../../../core/services/viacep-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreatePatientEscortComponent', () => {
  let component: CreatePatientEscortComponent;
  let fixture: ComponentFixture<CreatePatientEscortComponent>;
  
  let patientServiceMock: any;
  let viacepServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_care: {
      id: 123,
      patient: {
        cep: '78000-000',
        address: 'Av. Historiador Rubens de Mendonça',
        number: '1000',
        complement: 'Sala 402',
        neighborhood: 'Alvorada',
        city: 'Cuiabá',
        state: 'MT',
        file_address_id: 99
      }
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      getEscortCns: vi.fn(),
      getEscortDocument: vi.fn(),
      createPatientEscort: vi.fn(),
      cnsEscortExistsValidator: vi.fn().mockReturnValue(() => of(null)),
      documentEscortExistsValidator: vi.fn().mockReturnValue(() => of(null))
    };

    viacepServiceMock = {
      getAddress: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        CreatePatientEscortComponent
      ],
      providers: [
        provideNgxMask(),
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: PatientService, useValue: patientServiceMock },
        { provide: ViacepService, useValue: viacepServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(CreatePatientEscortComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatePatientEscortComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar estados', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
  });

  describe('Buscas Automáticas e Integrações de API', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve buscar e preencher dados do acompanhante pelo CNS tratando data vinda com timestamp do banco', () => {
      const mockResponse = {
        cns: '123456789012345',
        name: 'Carlos Acompanhante',
        document: '11122233344',
        gender: 'Masculino',
        relation: 'Irmão',
        birth_date: '1985-08-20 00:00:00',
        is_same_address: false,
        cep: '78048-000',
        address: 'Rua das Palmeiras',
        number: '450',
        neighborhood: 'Bosque',
        city: 'Cuiabá',
        state: 'MT'
      };
      patientServiceMock.getEscortCns.mockReturnValue(of(mockResponse));

      component['createEscortPersonalForm'].get('cns')?.setValue('123456789012345');
      component['getEscortCns']();

      expect(patientServiceMock.getEscortCns).toHaveBeenCalledWith('123456789012345');
      expect(component['createEscortPersonalForm'].get('name')?.value).toBe('Carlos Acompanhante');
      expect(component['createEscortAddressForm'].get('address')?.value).toBe('Rua das Palmeiras');
      
      const birthDateValue = component['createEscortPersonalForm'].get('birth_date')?.value;
      expect(birthDateValue).toBeInstanceOf(Date);
      expect(birthDateValue.getFullYear()).toBe(1985);
      expect(birthDateValue.getMonth()).toBe(7);
      expect(birthDateValue.getDate()).toBe(20);
    });

    it('deve buscar e preencher dados do acompanhante pelo CPF quando o campo atingir 11 caracteres', () => {
      const mockResponse = {
        document: '99988877766',
        name: 'Fernanda Acompanhante',
        gender: 'Feminino',
        birth_date: '1994-10-12T00:00:00',
        is_same_address: false
      };
      patientServiceMock.getEscortDocument.mockReturnValue(of(mockResponse));

      component['createEscortPersonalForm'].get('document')?.setValue('99988877766');
      component['getEscortDocument']();

      expect(patientServiceMock.getEscortDocument).toHaveBeenCalledWith('99988877766');
      expect(component['createEscortPersonalForm'].get('name')?.value).toBe('Fernanda Acompanhante');
      
      const birthDateValue = component['createEscortPersonalForm'].get('birth_date')?.value;
      expect(birthDateValue).toBeInstanceOf(Date);
      expect(birthDateValue.getFullYear()).toBe(1994);
      expect(birthDateValue.getMonth()).toBe(9);
    });

    it('deve buscar dados de endereço automaticamente via ViaCEP se o CEP tiver 8 caracteres', () => {
      const mockViaCep = {
        logradouro: 'Avenida Pantanal',
        bairro: 'Jardim Itália',
        localidade: 'Cuiabá',
        uf: 'MT'
      };
      viacepServiceMock.getAddress.mockReturnValue(of(mockViaCep));

      component['createEscortAddressForm'].get('cep')?.setValue('78000000');
      component['getAddress']();

      expect(viacepServiceMock.getAddress).toHaveBeenCalledWith('78000000');
      expect(component['createEscortAddressForm'].get('address')?.value).toBe('Avenida Pantanal');
      expect(component['createEscortAddressForm'].get('state')?.value).toBe('MT');
    });
  });

  describe('Gerenciamento e Fluxo de Endereço Herdado via Signal Effect', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve injetar o endereço do paciente e desabilitar o formulário reativamente através do is_same_address', () => {
      component['createEscortPersonalForm'].get('is_same_address')?.setValue(true);
      fixture.detectChanges();

      expect(component['isSameAddressSignal']()).toBe(true);
      expect(component['createEscortAddressForm'].disabled).toBe(true);
      expect(component['createEscortAddressForm'].get('cep')?.value).toBe('78000000');
      expect(component['createEscortAddressForm'].get('city')?.value).toBe('Cuiabá');
    });

    it('deve resetar o formulário de endereço se a flag de herança for desmarcada pelo usuário', () => {
      component['createEscortPersonalForm'].get('is_same_address')?.setValue(false);
      component['createEscortAddressForm'].get('cep')?.setValue('78000-111');
      
      fixture.detectChanges();
      component['resetAddress']();

      expect(component['createEscortAddressForm'].get('cep')?.value).toBeNull();
    });
  });

  describe('Upload de Arquivos anexados', () => {
    it('deve armazenar a referência do arquivo e atualizar o signal de label corretamente', () => {
      fixture.detectChanges();
      const mockFile = new File(['conteudo'], 'documento_identidade.pdf', { type: 'application/pdf' });
      const mockEvent = { target: { files: [mockFile] } };

      component['onFileSelected'](mockEvent, 'document');

      expect(component['labelsFiles'].document()).toBe('documento_identidade.pdf');
      expect(component['files']['document']).toBe(mockFile);
    });
  });

  describe('Fluxo de Submissão do Formulário (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      const personalForm = component['createEscortPersonalForm'];
      Object.keys(personalForm.controls).forEach(key => {
        const control = personalForm.get(key);
        control?.clearValidators();
        control?.clearAsyncValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      const addressForm = component['createEscortAddressForm'];
      Object.keys(addressForm.controls).forEach(key => {
        const control = addressForm.get(key);
        control?.clearValidators();
        control?.clearAsyncValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      Object.defineProperty(personalForm, 'invalid', { get: () => !personalForm.valid, configurable: true });
      Object.defineProperty(personalForm, 'valid', { get: () => !personalForm.errors, configurable: true });
      Object.defineProperty(addressForm, 'invalid', { get: () => !addressForm.valid, configurable: true });
      Object.defineProperty(addressForm, 'valid', { get: () => !addressForm.errors, configurable: true });
    });

    it('deve barrar a execução se o formulário pessoal ou de endereço estiver inválido', () => {
      component['createEscortPersonalForm'].setErrors({ required: true });
      
      component['onSubmit']();
      expect(patientServiceMock.createPatientEscort).not.toHaveBeenCalled();
    });

    it('deve enviar o formulário com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['createEscortPersonalForm'].patchValue({
        cns: '143456789012345',
        document: '00011122233',
        name: 'Acompanhante Oficial',
        gender: 'Masculino',
        relation: 'Outro',
        birth_date: new Date(1990, 0, 1)
      });

      patientServiceMock.createPatientEscort.mockReturnValue(of({ message: 'Acompanhante cadastrado!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(patientServiceMock.createPatientEscort).toHaveBeenCalledWith(123, expect.any(Object));
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Acompanhante cadastrado!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve lidar amigavelmente com falhas do backend exibindo o erro sem fechar a modal', () => {
      component['createEscortPersonalForm'].patchValue({
        cns: '143456789012345',
        document: '00011122233',
        name: 'Acompanhante Oficial',
        gender: 'Feminino',
        relation: 'Outro',
        birth_date: new Date(1990, 0, 1)
      });

      const mockApiError = { error: { message: 'Erro crítico de banco de dados.' }, message: 'Erro crítico de banco de dados.' };
      patientServiceMock.createPatientEscort.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro crítico de banco de dados.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  // =========================================================================
  // 🚀 NOVOS TESTES PARA COBERTURA MÁXIMA DE BRANCHES INTERNAS
  // =========================================================================

  describe('Cobertura Otimizada de Branches (Casos de Borda)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('não deve submeter se APENAS o formulário de endereço for inválido', () => {
      // Força o formulário pessoal a ser válido e o de endereço inválido
      const personalForm = component['createEscortPersonalForm'];
      const addressForm = component['createEscortAddressForm'];
      Object.defineProperty(personalForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(addressForm, 'invalid', { get: () => true, configurable: true });

      component['onSubmit']();
      expect(patientServiceMock.createPatientEscort).not.toHaveBeenCalled();
    });

    it('deve exibir erro genérico de rede na submissão caso a resposta do servidor venha limpa sem o nó error.message', () => {
      const personalForm = component['createEscortPersonalForm'];
      const addressForm = component['createEscortAddressForm'];
      Object.defineProperty(personalForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(addressForm, 'invalid', { get: () => false, configurable: true });

      // Simula queda de rede (HTTP 500 sem corpo JSON estruturado)
      const mockRawError = { status: 500, statusText: 'Server Error' };
      patientServiceMock.createPatientEscort.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('não deve invocar a API getEscortCns se o valor do campo for nulo, vazio ou inválido', () => {
      component['createEscortPersonalForm'].get('cns')?.setValue('');
      component['getEscortCns']();
      expect(patientServiceMock.getEscortCns).not.toHaveBeenCalled();

      component['createEscortPersonalForm'].get('cns')?.setValue(null as any);
      component['getEscortCns']();
      expect(patientServiceMock.getEscortCns).not.toHaveBeenCalled();
    });

    it('não deve invocar a API getEscortDocument se o comprimento do CPF for diferente de 11', () => {
      component['createEscortPersonalForm'].get('document')?.setValue('123');
      component['getEscortDocument']();
      expect(patientServiceMock.getEscortDocument).not.toHaveBeenCalled();
    });

    it('não deve chamar a API do ViaCEP se o comprimento do CEP for inválido', () => {
      component['createEscortAddressForm'].get('cep')?.setValue('1234');
      component['getAddress']();
      expect(viacepServiceMock.getAddress).not.toHaveBeenCalled();
    });

    it('não deve estourar erro ou alterar labels se a seleção do input file for cancelada pelo usuário', () => {
      component['files']['document'] = null;
      const mockEventCancelado = { target: { files: [] } };

      component['onFileSelected'](mockEventCancelado, 'document');

      expect(component['files']['document']).toBeFalsy();
    });
  });
});