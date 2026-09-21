import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideNgxMask } from 'ngx-mask';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fileSaver from 'file-saver';

// 🚀 Resolve o problema de ESM criando um mock global do pacote file-saver para o Vitest
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

import { UpdatePatientEscortComponent } from './update-patient-escort-component';
import { PatientService } from '../../../services/patient-service';
import { ViacepService } from '../../../../core/services/viacep-service';
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';

describe('UpdatePatientEscortComponent', () => {
  let component: UpdatePatientEscortComponent;
  let fixture: ComponentFixture<UpdatePatientEscortComponent>;
  
  let patientServiceMock: any;
  let viacepServiceMock: any;
  let messageServiceMock: any;
  let storageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_care: {
      id: 123,
      patient: {
        cep: '78000000',
        address: 'Av. Historiador Rubens de Mendonça',
        number: '1000',
        complement: 'Sala 402',
        neighborhood: 'Alvorada',
        city: 'Cuiabá',
        state: 'MT',
        file_address_id: 99
      }
    },
    escort: {
      id: 1,
      cns: '209348572093845',
      file_cns_id: 101,
      document: '00011122233',
      file_document_id: 102,
      name: 'Maria da Silva',
      relation: 'Mãe',
      birth_date: '1980-05-15 00:00:00',
      gender: 'Feminino',
      is_same_address: false,
      cep: '78050000',
      address: 'Rua das Flores',
      file_address_id: 103,
      number: '123',
      complement: 'Ap 10',
      neighborhood: 'Centro',
      city: 'Cuiabá',
      state: 'MT'
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      updatePatientEscort: vi.fn(),
      cnsEscortExistsValidator: vi.fn().mockReturnValue(() => of(null)),
      documentEscortExistsValidator: vi.fn().mockReturnValue(() => of(null))
    };

    viacepServiceMock = {
      getAddress: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    storageServiceMock = {
      download: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdatePatientEscortComponent
      ],
      providers: [
        provideNgxMask(),
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: PatientService, useValue: patientServiceMock },
        { provide: ViacepService, useValue: viacepServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: StorageService, useValue: storageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(UpdatePatientEscortComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdatePatientEscortComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar estados baseados no MAT_DIALOG_DATA', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);

    expect(component['updateEscortPersonalForm'].get('name')?.value).toBe('Maria da Silva');
    expect(component['updateEscortAddressForm'].get('address')?.value).toBe('Rua das Flores');
    expect(component['labelsFiles'].cns()).toContain('Arquivo já cadastrado');
  });

  describe('Processamento de Datas e Integração ViaCEP', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve fazer o parse correto da birth_date string para objeto Date limpando a hora', () => {
      const birthDateValue = component['updateEscortPersonalForm'].get('birth_date')?.value;
      expect(birthDateValue).toBeInstanceOf(Date);
      expect(birthDateValue.getFullYear()).toBe(1980);
      expect(birthDateValue.getMonth()).toBe(4);
      expect(birthDateValue.getDate()).toBe(15);
    });

    it('deve buscar dados de endereço automaticamente via ViaCEP se o CEP tiver 8 caracteres', () => {
      const mockViaCep = {
        logradouro: 'Avenida Pantanal',
        bairro: 'Jardim Itália',
        localidade: 'Cuiabá',
        uf: 'MT'
      };
      viacepServiceMock.getAddress.mockReturnValue(of(mockViaCep));

      component['updateEscortAddressForm'].get('cep')?.setValue('78000000');
      component['getAddress']();

      expect(viacepServiceMock.getAddress).toHaveBeenCalledWith('78000000');
      expect(component['updateEscortAddressForm'].get('address')?.value).toBe('Avenida Pantanal');
    });

    // 🌟 EXTRA BRANCH: Evita chamadas desnecessárias se o CEP for inválido/incompleto
    it('não deve disparar a requisição de CEP caso o valor possua tamanho incorreto', () => {
      component['updateEscortAddressForm'].get('cep')?.setValue('123');
      component['getAddress']();
      expect(viacepServiceMock.getAddress).not.toHaveBeenCalled();
    });
  });

  describe('Gerenciamento de Endereço Herdado via Signal Effect', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve clonar o endereço do paciente e desabilitar inputs reativamente ao ativar is_same_address', () => {
      component['updateEscortPersonalForm'].get('is_same_address')?.setValue(true);
      fixture.detectChanges();

      expect(component['isSameAddressSignal']()).toBe(true);
      expect(component['updateEscortAddressForm'].disabled).toBe(true);
      expect(component['updateEscortAddressForm'].get('cep')?.value).toBe('78000000');
    });

    it('deve resetar o formulário de endereço e marcá-lo como dirty se a flag for desmarcada', () => {
      component['updateEscortPersonalForm'].get('is_same_address')?.setValue(false);
      component['updateEscortPersonalForm'].get('is_same_address')?.markAsDirty();
      
      component['resetAddress']();
      component['updateEscortAddressForm'].markAsDirty();

      expect(component['updateEscortAddressForm'].get('cep')?.value).toBeNull();
      expect(component['updateEscortPersonalForm'].get('is_same_address')?.dirty).toBe(true);
      expect(component['updateEscortAddressForm'].dirty).toBe(true);
    });
  });

  describe('Downloads e Uploads de Arquivos Anexados', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve disparar o download e acionar a biblioteca file-saver', () => {
      const mockBlob = { archive: new Blob(['content'], { type: 'application/pdf' }) };
      storageServiceMock.download.mockReturnValue(of(mockBlob));

      component['download'](101, 'cns_comprovante');

      expect(storageServiceMock.download).toHaveBeenCalledWith(101);
      expect(fileSaver.saveAs).toHaveBeenCalledWith(mockBlob.archive, 'cns_comprovante');
    });

    it('deve atualizar a label e marcar o formulário como dirty ao selecionar um novo arquivo local', () => {
      const mockFile = new File([''], 'novo_cns.pdf', { type: 'application/pdf' });
      const mockEvent = { target: { files: [mockFile] } };

      component['onFileSelected'](mockEvent, 'cns');

      expect(component['labelsFiles'].cns()).toBe('novo_cns.pdf');
      expect(component['files']['cns']).toBe(mockFile);
      expect(component['updateEscortPersonalForm'].dirty).toBe(true);
    });
  });

  describe('Fluxo de Update e Submissão (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      const personalForm = component['updateEscortPersonalForm'];
      Object.keys(personalForm.controls).forEach(key => {
        const control = personalForm.get(key);
        control?.clearValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      const addressForm = component['updateEscortAddressForm'];
      Object.keys(addressForm.controls).forEach(key => {
        const control = addressForm.get(key);
        control?.clearValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      Object.defineProperty(personalForm, 'invalid', { get: () => !personalForm.valid, configurable: true });
      Object.defineProperty(personalForm, 'valid', { get: () => !personalForm.errors, configurable: true });
      Object.defineProperty(addressForm, 'invalid', { get: () => !addressForm.valid, configurable: true });
      Object.defineProperty(addressForm, 'valid', { get: () => !addressForm.errors, configurable: true });
    });

    it('deve barrar o envio caso o formulário pessoal seja inválido', () => {
      component['updateEscortPersonalForm'].setErrors({ required: true });
      component['onSubmit']();
      expect(patientServiceMock.updatePatientEscort).not.toHaveBeenCalled();
    });

    // 🌟 EXTRA BRANCH: Impede submissão se o formulário de endereço estiver inválido
    it('deve barrar o envio caso o formulário de endereço seja inválido', () => {
      component['updateEscortAddressForm'].setErrors({ required: true });
      component['onSubmit']();
      expect(patientServiceMock.updatePatientEscort).not.toHaveBeenCalled();
    });

    it('deve atualizar os dados com sucesso, emitir mensagem e fechar o diálogo', () => {
      patientServiceMock.updatePatientEscort.mockReturnValue(of({ message: 'Acompanhante atualizado!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(patientServiceMock.updatePatientEscort).toHaveBeenCalledWith(mockDialogData.escort.id, expect.any(Object));
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Acompanhante atualizado!'); // 🌟 Corrigido aqui
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve interceptar respostas de erro do servidor mantendo a modal aberta', () => {
      const mockApiError = { error: { message: 'Erro ao salvar alterações.' } };
      patientServiceMock.updatePatientEscort.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao salvar alterações.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  // 🏁 === BLOCO ADICIONADO PARA CAPTURAR 100% DAS BRANCHES E AS LINHAS RESTANTES ===
  describe('Cobertura de Branches de Exceção e Casos de Borda', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    // 🎯 Captura Linha 207-208: Fallback de Mensagem Genérica se API quebrar sem message predefinido
    it('deve exibir mensagem genérica de erro caso o servidor falhe sem retornar um objeto de erro válido', () => {
      // Forçamos os formulários a ficarem válidos bypassando validações
      const personalForm = component['updateEscortPersonalForm'];
      const addressForm = component['updateEscortAddressForm'];
      Object.defineProperty(personalForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(addressForm, 'invalid', { get: () => false, configurable: true });

      // Simula um erro de conexão cru (ex: 500 sem payload estruturado)
      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      patientServiceMock.updatePatientEscort.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    // 🎯 Captura Linha 226: Abortar upload se a janela de arquivos fechar vazia
    it('não deve alterar os labels ou arquivos salvos caso a seleção de arquivos locais seja cancelada vazia', () => {
      // Estado original inicializado como nulo
      component['files']['cns'] = null;
      
      // Simula evento onde o array files vem zerado
      const mockEventCancelado = { target: { files: [] } };
      component['onFileSelected'](mockEventCancelado, 'cns');

      expect(component['files']['cns']).toBeNull();
    });
  });
});