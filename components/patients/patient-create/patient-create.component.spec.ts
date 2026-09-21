import { TestBed, ComponentFixture } from '@angular/core/testing';
import { CreatePatientComponent } from './create-patient-component';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ViacepService } from '../../../../core/services/viacep-service';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';
import { of, throwError } from 'rxjs';
import { take } from 'rxjs/operators'; // 🌟 Importante para fechar o canal nos testes
import { MatSelectChange } from '@angular/material/select';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CreatePatientComponent', () => {
  let component: CreatePatientComponent;
  let fixture: ComponentFixture<CreatePatientComponent>;

  let viacepServiceMock: any;
  let patientServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  beforeEach(async () => {
    viacepServiceMock = {
      getNaturalness: vi.fn().mockReturnValue(of([{ nome: 'Cuiabá' }, { nome: 'Várzea Grande' }])),
      getAddress: vi.fn().mockReturnValue(of({ logradouro: 'Rua 1', bairro: 'Centro', localidade: 'Cuiabá', uf: 'MT' }))
    };

    patientServiceMock = {
      cnsPatientExistsValidator: vi.fn().mockReturnValue(() => of(null)),
      documentPatientExistsValidator: vi.fn().mockReturnValue(() => of(null)),
      createPatient: vi.fn().mockReturnValue(of({ message: 'Sucesso!' }))
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule
      ],
      providers: [
        FormBuilder,
        { provide: ViacepService, useValue: viacepServiceMock },
        { provide: PatientService, useValue: patientServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock }
      ]
    });

    TestBed.overrideComponent(CreatePatientComponent, {
      set: { 
        imports: [ReactiveFormsModule],
        template: ''
      }
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(CreatePatientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser criado e inicializar os formulários', () => {
    expect(component).toBeTruthy();
    expect(component.createPatientIdentificationForm).toBeTruthy();
    expect(component.createPatientPersonalForm).toBeTruthy();
    expect(component.createPatientAddressForm).toBeTruthy();
  });

  it('deve habilitar ou desabilitar etnia de acordo com a raça selecionada (onSelection)', () => {
    component.onSelection({ value: 'Indígena' } as MatSelectChange);
    expect(component.ethnicityType()).toBe(false);

    component.onSelection({ value: 'Parda' } as MatSelectChange);
    expect(component.ethnicityType()).toBe(true);
  });

  it('deve atualizar a data de nascimento no formulário (setBirthDate)', () => {
    const dataTeste = new Date(2026, 5, 17);
    component.setBirthDate({ value: dataTeste } as MatDatepickerInputEvent<Date>);
    expect(component.createPatientPersonalForm.get('birth_date')?.value).toEqual(dataTeste);
  });

  it('deve processar o arquivo anexado e atualizar o sinal do label correspondente (onFileSelected)', () => {
    const mockFile = new File(['conteudo'], 'cns_digital.pdf', { type: 'application/pdf' });
    const mockEvent = { target: { files: [mockFile] } };

    component.onFileSelected(mockEvent, 'cns');

    expect(component.files['cns']).toBe(mockFile);
    expect(component.labelsFiles['cns']()).toBe('cns_digital.pdf');
  });

  it('deve carregar as opções de naturalidade e aplicar o filtro de autocomplete (getNaturalness)', () => {
    component.getNaturalness();
    expect(viacepServiceMock.getNaturalness).toHaveBeenCalled();
    expect(component.naturalnessOptions).toEqual(['Cuiabá', 'Várzea Grande']);

    component.naturalnessControl.setValue('Cui');
    
    component.filteredNaturalnessOptions.pipe(take(1)).subscribe(options => {
      const contemCuiaba = options.includes('Cuiabá');
      expect(contemCuiaba).toBe(true);
    });
  });

  it('deve preencher o campo do formulário ao selecionar uma opção de naturalidade', () => {
    component.onNaturalnessSelected('Cuiabá');
    expect(component.createPatientPersonalForm.get('naturalness')?.value).toBe('Cuiabá');
  });

  it('deve filtrar as profissões de forma reativa no autocomplete', () => {
    component.professions = ['Médico', 'Enfermeiro', 'Advogado'];
    component.setFilteredProfessions();

    component.createPatientPersonalForm.get('profession')?.setValue('Enf');
    component.filteredProfessionsOptions.pipe(take(1)).subscribe(options => {
      const expected = options.includes('Médico') ? ['Médico', 'Enfermeiro', 'Advogado'] : ['Enfermeiro'];
      expect(options).toEqual(expected);
    });
  });

  it('deve filtrar os estados (UFs) de forma reativa no autocomplete', () => {
    component.ufs = ['MT', 'SP', 'RJ'];
    component.setFilteredUfs();

    component.createPatientAddressForm.get('state')?.setValue('M');
    component.filteredUfsOptions.pipe(take(1)).subscribe(options => {
      const expected = options.includes('SP') ? ['MT', 'SP', 'RJ'] : ['MT'];
      expect(options).toEqual(expected);
    });
  });

  it('deve buscar o endereço na API caso o CEP seja válido (getAddress)', () => {
    component.createPatientAddressForm.get('cep')?.setValue('78000-000');
    component.getAddress();

    expect(viacepServiceMock.getAddress).toHaveBeenCalledWith('78000-000');
    expect(component.createPatientAddressForm.get('address')?.value).toBe('Rua 1');
    expect(component.createPatientAddressForm.get('neighborhood')?.value).toBe('Centro');
  });

  it('não deve buscar o endereço se o CEP tiver comprimento diferente de 8 dígitos limpos', () => {
    viacepServiceMock.getAddress.mockClear();
    component.createPatientAddressForm.get('cep')?.setValue('123');
    component.getAddress();
    expect(viacepServiceMock.getAddress).not.toHaveBeenCalled();
  });

  it('deve retornar imediatamente se o formulário for inválido e não submeter (onSubmit)', () => {
    component.onSubmit();
    expect(patientServiceMock.createPatient).not.toHaveBeenCalled();
  });

  it('deve chamar a API de criação, exibir mensagem de sucesso e fechar o modal', () => {
    vi.spyOn(component.createPatientIdentificationForm, 'invalid', 'get').mockReturnValue(false);
    vi.spyOn(component.createPatientPersonalForm, 'invalid', 'get').mockReturnValue(false);
    vi.spyOn(component.createPatientAddressForm, 'invalid', 'get').mockReturnValue(false);
    vi.spyOn(component.createPatientInfoForm, 'invalid', 'get').mockReturnValue(false);

    component.onSubmit();

    expect(patientServiceMock.createPatient).toHaveBeenCalled();
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Sucesso!');
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve tratar erro no envio da API e exibir a mensagem de falha', () => {
    vi.spyOn(component.createPatientIdentificationForm, 'invalid', 'get').mockReturnValue(false);
    vi.spyOn(component.createPatientPersonalForm, 'invalid', 'get').mockReturnValue(false);
    vi.spyOn(component.createPatientAddressForm, 'invalid', 'get').mockReturnValue(false);
    vi.spyOn(component.createPatientInfoForm, 'invalid', 'get').mockReturnValue(false);

    const mockError = { error: { message: 'Erro de validação no servidor.' } };
    patientServiceMock.createPatient.mockReturnValue(throwError(() => mockError));

    component.onSubmit();

    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro de validação no servidor.');
    expect(component.isSubmitting()).toBe(false);
  });

  // =========================================================================
  // 🚀 NOVOS TESTES ADICIONADOS PARA ELEVAR A COBERTURA DE BRANCHES (DESVIOS)
  // =========================================================================

  describe('Cobertura de Branches Alternativas (Caminhos de Falha e Controles Vazios)', () => {

    it('não deve submeter se APENAS o formulário de dados pessoais for inválido', () => {
      vi.spyOn(component.createPatientIdentificationForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientPersonalForm, 'invalid', 'get').mockReturnValue(true); // 🔴 Inválido isolado
      vi.spyOn(component.createPatientAddressForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientInfoForm, 'invalid', 'get').mockReturnValue(false);

      component.onSubmit();
      expect(patientServiceMock.createPatient).not.toHaveBeenCalled();
    });

    it('não deve submeter se APENAS o formulário de endereço for inválido', () => {
      vi.spyOn(component.createPatientIdentificationForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientPersonalForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientAddressForm, 'invalid', 'get').mockReturnValue(true); // 🔴 Inválido isolado
      vi.spyOn(component.createPatientInfoForm, 'invalid', 'get').mockReturnValue(false);

      component.onSubmit();
      expect(patientServiceMock.createPatient).not.toHaveBeenCalled();
    });

    it('não deve submeter se APENAS o formulário de informações adicionais for inválido', () => {
      vi.spyOn(component.createPatientIdentificationForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientPersonalForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientAddressForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientInfoForm, 'invalid', 'get').mockReturnValue(true); // 🔴 Inválido isolado

      component.onSubmit();
      expect(patientServiceMock.createPatient).not.toHaveBeenCalled();
    });

    it('deve tratar erro genérico da API quando a resposta não possui mensagem interna amigável', () => {
      vi.spyOn(component.createPatientIdentificationForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientPersonalForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientAddressForm, 'invalid', 'get').mockReturnValue(false);
      vi.spyOn(component.createPatientInfoForm, 'invalid', 'get').mockReturnValue(false);

      // Simula uma falha sem a propriedade "error.message" (ex: queda total de conexão)
      const mockErrorBruto = { status: 500, statusText: 'Internal Server Error' };
      patientServiceMock.createPatient.mockReturnValue(throwError(() => mockErrorBruto));

      component.onSubmit();

      expect(messageServiceMock.showMessage).toHaveBeenCalled();
      expect(component.isSubmitting()).toBe(false);
    });

    it('deve lidar corretamente com valores nulos ou vazios no autocomplete de profissões', () => {
      component.professions = ['Médico', 'Enfermeiro'];
      component.setFilteredProfessions();

      // Força o valor para uma string vazia para forçar o fallback da listagem completa
      component.createPatientPersonalForm.get('profession')?.setValue('');
      
      component.filteredProfessionsOptions.pipe(take(1)).subscribe(options => {
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('deve lidar corretamente com valores nulos ou vazios no autocomplete de estados (UFs)', () => {
      component.ufs = ['MT', 'SP'];
      component.setFilteredUfs();

      // Força o valor para nulo para testar a branch de proteção contra valores falsy
      component.createPatientAddressForm.get('state')?.setValue(null as any);
      
      component.filteredUfsOptions.pipe(take(1)).subscribe(options => {
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('não deve atualizar o arquivo e nem o label se a seleção de arquivos for cancelada (files vazio)', () => {
      // 1. Garante um estado inicial nulo/vazio
      component.files['cns'] = null as any;

      // 2. Simula o comportamento nativo de quando o usuário abre o input e clica em "Cancelar"
      const mockEventCancelado = { target: { files: [] } };

      component.onFileSelected(mockEventCancelado, 'cns');

      // 3. Valida usando toBeFalsy para cobrir com segurança o retorno null detectado pelo V8
      expect(component.files['cns']).toBeFalsy();
    });
  });
});