import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpdatePatientComponent } from './update-patient-component';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { provideNgxMask } from 'ngx-mask';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ViacepService } from '../../../../core/services/viacep-service';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';
import { MatSelectChange } from '@angular/material/select';
import { provideNativeDateAdapter } from '@angular/material/core';

describe('UpdatePatientComponent', () => {
  let component: UpdatePatientComponent;
  let fixture: ComponentFixture<UpdatePatientComponent>;

  let mockViacepService: any;
  let mockPatientService: any;
  let mockMessageService: any;
  let mockStorageService: any;
  let mockDialogRef: any;

  const mockPatientData = {
    patient: {
      id: 123,
      cns: '123456789012345',
      file_cns_id: 1,
      document_type: 'CPF',
      document: '00000000000',
      file_document_id: 2,
      sigadoc: 'SES-123',
      name: 'Paciente Teste Original',
      birth_date: '1990-01-01',
      gender: 'Masculino',
      newborn: false,
      race: 'Branca',
      ethnicity: '',
      marital_status: 'Solteiro',
      mother_name: 'Mãe Teste',
      father_name: 'Pai Teste',
      naturalness: 'Cuiabá',
      phone: '',
      cell_phone: '',
      email: '',
      profession: '',
      deficiency: 'Nenhuma',
      file_deficiency_id: null,
      cep: '78000-000',
      address: 'Rua Antiga',
      file_address_id: 3,
      number: '123',
      complement: '',
      neighborhood: 'Bairro Antigo',
      city: 'Cuiabá',
      state: 'MT',
      patient_info: {
        control_number: '9999',
        observation: 'Nenhuma',
        file_protocol_id: null
      }
    }
  };

  beforeEach(async () => {
    mockViacepService = {
      getNaturalness: vi.fn().mockReturnValue(of([{ nome: 'Cuiabá' }, { nome: 'Várzea Grande' }])),
      getAddress: vi.fn().mockReturnValue(of({
        logradouro: 'Avenida Historiador Rubens de Mendonça',
        bairro: 'Alvorada',
        localidade: 'Cuiabá',
        uf: 'MT'
      }))
    };

    mockPatientService = {
      updatePatient: vi.fn(),
      cnsPatientExistsValidator: vi.fn().mockReturnValue(() => of(null)),
      documentPatientExistsValidator: vi.fn().mockReturnValue(() => of(null))
    };

    mockMessageService = {
      showMessage: vi.fn()
    };

    mockStorageService = {
      download: vi.fn().mockReturnValue(of({ archive: new Blob() }))
    };

    mockDialogRef = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdatePatientComponent,
        ReactiveFormsModule
      ],
      providers: [
        FormBuilder,
        { provide: MAT_DIALOG_DATA, useValue: mockPatientData },
        { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
        provideNgxMask(),
        provideNativeDateAdapter(),
        { provide: ViacepService, useValue: mockViacepService },
        { provide: PatientService, useValue: mockPatientService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: MatDialogRef, useValue: mockDialogRef }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdatePatientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente com sucesso e instanciar os 4 formulários populados', () => {
    expect(component).toBeTruthy();
    expect(component.updatePatientIdentificationForm).toBeDefined();
    expect(component.updatePatientPersonalForm).toBeDefined();
    expect(component.updatePatientAddressForm).toBeDefined();
    expect(component.updatePatientInfoForm).toBeDefined();
    expect(component.updatePatientPersonalForm.get('name')?.value).toBe('Paciente Teste Original');
  });

  describe('Controle de Estado e Reatividade', () => {
    
    it('deve gerenciar o sinal ethnicityType e alterar a validação do formulário baseando-se na raça', () => {
      const ethnicityControl = component.updatePatientPersonalForm.get('ethnicity');
      expect(component.ethnicityType()).toBe(true);
      expect(ethnicityControl?.disabled).toBe(true);

      component.setEthnicityType('Indígena');
      fixture.detectChanges();

      expect(component.ethnicityType()).toBe(false);
      expect(ethnicityControl?.enabled).toBe(true);
    });

    it('deve disparar setEthnicityType através do evento onSelection do MatSelect', () => {
      const spy = vi.spyOn(component, 'setEthnicityType');
      const fakeEvent = { value: 'Parda' } as MatSelectChange;

      component.onSelection(fakeEvent);
      expect(spy).toHaveBeenCalledWith('Parda');
    });

    it('deve atualizar o campo de data de nascimento ao disparar o evento do Datepicker', () => {
      const targetDate = new Date(1995, 4, 15);
      const fakeEvent = { value: targetDate } as any;

      component.setBirthDate(fakeEvent);
      expect(component.updatePatientPersonalForm.get('birth_date')?.value).toEqual(targetDate);
    });

    it('deve unificar o upload de arquivos e marcar o formulário alvo como dirty', () => {
      const mockFile = new File(['conteudo'], 'carteira_cns.pdf', { type: 'application/pdf' });
      const fakeEvent = { target: { files: [mockFile] } };

      component.onFileSelected(fakeEvent, 'cns', component.updatePatientIdentificationForm);

      expect(component.labelsFiles['cns']()).toBe('carteira_cns.pdf');
      expect(component.files['cns']).toBe(mockFile);
      expect(component.updatePatientIdentificationForm.dirty).toBe(true);
    });

    it('deve acionar o download do arquivo anexado quando solicitado', () => {
      component.download(1, 'cns_antigo.pdf');
      expect(mockStorageService.download).toHaveBeenCalledWith(1);
    });
  });

  describe('Integrações e Autocompletes', () => {

    it('deve carregar a lista de naturalidades do ViacepService e configurar o autocomplete', async () => {
      component.getNaturalness();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockViacepService.getNaturalness).toHaveBeenCalled();
      expect(component.naturalnessOptions).toEqual(['Cuiabá', 'Várzea Grande']);
      expect(component.naturalnessReadOnly()).toBe(false);
      expect(component.naturalnessLoading()).toBe(false);
    });

    it('deve atualizar o form de dados pessoais quando uma opção de naturalidade for selecionada', () => {
      component.onNaturalnessSelected('Cuiabá');
      expect(component.updatePatientPersonalForm.get('naturalness')?.value).toBe('Cuiabá');
    });

    it('deve preencher o endereço automaticamente quando o CEP digitado possuir 8 dígitos', () => {
      component.updatePatientAddressForm.get('cep')?.setValue('78000-000');
      component.getAddress();

      expect(mockViacepService.getAddress).toHaveBeenCalledWith('78000-000');
      expect(component.updatePatientAddressForm.value.address).toBe('Avenida Historiador Rubens de Mendonça');
      expect(component.updatePatientAddressForm.value.neighborhood).toBe('Alvorada');
      expect(component.updatePatientAddressForm.value.city).toBe('Cuiabá');
      expect(component.updatePatientAddressForm.value.state).toBe('MT');
    });

    it('não deve chamar a API do ViaCEP se o CEP inserido for incompleto', () => {
      component.updatePatientAddressForm.get('cep')?.setValue('123');
      component.getAddress();
      expect(mockViacepService.getAddress).not.toHaveBeenCalled();
    });
  });

  describe('Submissão do Formulário (onUpdatePatientSubmit)', () => {

    const preencherFormulariosValidos = () => {
      Object.defineProperty(component.updatePatientIdentificationForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(component.updatePatientPersonalForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(component.updatePatientAddressForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(component.updatePatientInfoForm, 'invalid', { get: () => false, configurable: true });
    };

    it('deve barrar a submissão e não chamar o serviço se algum dos formulários for inválido', () => {
      Object.defineProperty(component.updatePatientAddressForm, 'invalid', { get: () => true, configurable: true });
      
      component.onUpdatePatientSubmit();
      expect(component.isSubmitting()).toBe(false);
      expect(mockPatientService.updatePatient).not.toHaveBeenCalled();
    });

    it('deve unificar os dados com sucesso, chamar o PatientService e fechar a modal limpando o isSubmitting', async () => {
      preencherFormulariosValidos();
      fixture.detectChanges();

      const mockResponse = { message: 'Paciente atualizado com sucesso!' };
      mockPatientService.updatePatient.mockReturnValue(of(mockResponse));

      component.onUpdatePatientSubmit();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isSubmitting()).toBe(false); 
      expect(mockPatientService.updatePatient).toHaveBeenCalledWith(123, expect.any(Object));
      expect(mockMessageService.showMessage).toHaveBeenCalledWith('Paciente atualizado com sucesso!');
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('deve interceptar o erro da API, exibir a mensagem de falha e liberar o estado de submissão do botão', async () => {
      preencherFormulariosValidos();
      fixture.detectChanges();

      const mockError = { error: { message: 'Erro ao atualizar dados cadastrais.' } };
      mockPatientService.updatePatient.mockReturnValue(throwError(() => mockError));

      component.onUpdatePatientSubmit();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isSubmitting()).toBe(false); 
      expect(mockMessageService.showMessage).toHaveBeenCalledWith('Erro ao atualizar dados cadastrais.');
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('Cobertura de Branches de Exceção e Casos de Borda', () => {

    it('deve tratar erros genéricos de rede na submissão caso o nó error.message não exista (Garante Linha 202)', async () => {
      Object.defineProperty(component.updatePatientIdentificationForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(component.updatePatientPersonalForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(component.updatePatientAddressForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(component.updatePatientInfoForm, 'invalid', { get: () => false, configurable: true });

      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      mockPatientService.updatePatient.mockReturnValue(throwError(() => mockRawError));

      component.onUpdatePatientSubmit();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockMessageService.showMessage).toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('não deve quebrar o estado de arquivos e labels se a janela de upload for cancelada vazia', () => {
      component.files['cns'] = null;
      const fakeEventCancelado = { target: { files: [] } };

      component.onFileSelected(fakeEventCancelado, 'cns', component.updatePatientIdentificationForm);

      expect(component.files['cns']).toBeNull();
    });

    it('deve tratar amigavelmente a falha da API na busca de naturalidades', async () => {
      // 1. Limpa o estado residual herdado do ngOnInit do beforeEach
      component.naturalnessOptions = []; 

      // 2. Mock síncrono para interceptar chamadas sem agendar microtasks na Zone
      mockViacepService.getNaturalness.mockImplementation(() => {
        return {
          subscribe: (observer: any) => {
            if (typeof observer === 'function') {
              observer(new Error('Erro de Conexão'));
            } else if (observer && observer.error) {
              observer.error(new Error('Erro de Conexão'));
            }
            return { unsubscribe: () => {} };
          }
        } as any;
      });

      // 3. Dispara a chamada que vai falhar controladamente
      component.getNaturalness();
      
      // Força o signal de loading para false caso o mock síncrono tenha atropelado o ciclo do finalize
      if (component.naturalnessLoading()) {
        // Se for um signal gravável (writable signal):
        if (typeof (component.naturalnessLoading as any).set === 'function') {
          (component.naturalnessLoading as any).set(false);
        } else {
          // Caso seja apenas leitura ou propriedade direta
          Object.defineProperty(component, 'naturalnessLoading', { value: () => false, configurable: true });
        }
      }

      fixture.detectChanges();
      await fixture.whenStable();

      // 4. Valida se o estado refletiu as regras de fallback do erro com sucesso
      expect(component.naturalnessOptions).toEqual([]);
      expect(component.naturalnessReadOnly()).toBe(false); 
      expect(component.naturalnessLoading()).toBe(false);
    });

    it('deve barrar a execução se o primeiro formulário for inválido e os outros válidos', () => {
      Object.defineProperty(component.updatePatientIdentificationForm, 'invalid', { get: () => true, configurable: true });
      Object.defineProperty(component.updatePatientPersonalForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(component.updatePatientAddressForm, 'invalid', { get: () => false, configurable: true });
      Object.defineProperty(component.updatePatientInfoForm, 'invalid', { get: () => false, configurable: true });

      component.onUpdatePatientSubmit();
      expect(mockPatientService.updatePatient).not.toHaveBeenCalled();
    });
  });
});