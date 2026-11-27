// src/app/tfd/components/patients/patient-create/patient-create.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MatDialogRef } from '@angular/material/dialog';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import moment, { Moment } from 'moment';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientCreateComponent } from './patient-create.component';
import { MessageService } from '../../../../core/services/message.service';
import { ViacepService } from '../../../../core/services/viacep.service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { Patient } from '../../../models/patient.model';
import { PatientService } from '../../../services/patient.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

const TEST_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

describe('PatientCreateComponent', () => {
  let component: PatientCreateComponent;
  let fixture: ComponentFixture<PatientCreateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let viacepServiceMock: {
    getAddress: ReturnType<typeof vi.fn>;
    getNaturalness: ReturnType<typeof vi.fn>;
  };
  let patientServiceMock: {
    createPatient: ReturnType<typeof vi.fn>;
    cnsPatientExistsValidator: ReturnType<typeof vi.fn>;
    documentPatientExistsValidator: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  let capturedCnsOnFound: ((patient: Patient) => void) | undefined;
  let capturedDocOnFound: ((patient: Patient) => void) | undefined;

  const mockNaturalnessList = Array.from({ length: 15 }, (_, idx) => ({
    nome: `Cidade ${idx + 1}`,
  }));

  function createPassAsyncValidator(): AsyncValidatorFn {
    return () => of(null as ValidationErrors | null);
  }

  function fillValidForm(): void {
    component['identificationForm'].patchValue({
      cns: '123456789012345',
      document_type: 'CPF',
      document: '12345678901',
    });

    component['personalForm'].patchValue({
      name: 'Carlos Eduardo',
      birth_date: moment('1990-05-15', 'YYYY-MM-DD', true),
      gender: 'Masculino',
      newborn: false,
      race: 'Parda',
      marital_status: 'Solteiro',
      mother_name: 'Maria Clara',
      father_name: 'João Carlos',
      naturalness: 'Cuiabá',
      phone: '6533221100',
      cell_phone: '65999887766',
      email: 'carlos@exemplo.com',
      profession: 'Analista',
      deficiency: 'Nenhuma',
    });

    component['addressForm'].patchValue({
      cep: '78000000',
      address: 'Rua Principal',
      number: '100',
      complement: 'Apto 12',
      neighborhood: 'Centro',
      city: 'Cuiabá',
      state: 'MT',
    });

    component['infoForm'].patchValue({
      control_number: 'CTL-001',
      sigadoc: 'SIG-12345',
      observation: 'Sem observações',
    });
  }

  async function createComponent(
    naturalnessResponse = of(mockNaturalnessList)
  ): Promise<void> {
    capturedCnsOnFound = undefined;
    capturedDocOnFound = undefined;

    viacepServiceMock.getNaturalness.mockReturnValue(naturalnessResponse);

    patientServiceMock.cnsPatientExistsValidator.mockImplementation(
      (_id: number | null, onFound?: (patient: Patient) => void) => {
        capturedCnsOnFound = onFound;
        return createPassAsyncValidator();
      }
    );

    patientServiceMock.documentPatientExistsValidator.mockImplementation(
      (_id: number | null, onFound?: (patient: Patient) => void) => {
        capturedDocOnFound = onFound;
        return createPassAsyncValidator();
      }
    );

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientCreateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
          {
            provide: DateAdapter,
            useClass: MomentDateAdapter,
            deps: [MAT_DATE_LOCALE],
          },
          { provide: MAT_DATE_FORMATS, useValue: TEST_DATE_FORMATS },
          { provide: ViacepService, useValue: viacepServiceMock },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
        ],
      })
      .overrideComponent(PatientCreateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.useFakeTimers();

    broadcastChannelMock = new MockBroadcastChannel();
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return broadcastChannelMock;
      })
    );

    vi.spyOn(CustomValidators, 'cnsValidator').mockReturnValue(() => null);
    vi.spyOn(CustomValidators, 'cpfOrCnjValidator').mockReturnValue(() => null);
    vi.spyOn(CustomValidators, 'dateValidator').mockReturnValue(() => null);
    vi.spyOn(CustomValidators, 'birthDateValidator').mockReturnValue(() => null);

    viacepServiceMock = {
      getAddress: vi.fn().mockReturnValue(of({ erro: true })),
      getNaturalness: vi.fn(),
    };

    patientServiceMock = {
      createPatient: vi.fn(),
      cnsPatientExistsValidator: vi.fn(),
      documentPatientExistsValidator: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e carregar naturalidades limitadas a 10', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(viacepServiceMock.getNaturalness).toHaveBeenCalledTimes(1);
    expect(component['naturalnessLoading']()).toBe(false);
    expect(component['filteredNaturalnessOptions']()).toHaveLength(10);
    expect(component['filteredNaturalnessOptions']()[0]).toBe('Cidade 1');
    expect(component['isEthnicityDisabled']()).toBe(true);
    expect(component['personalForm'].controls.ethnicity.disabled).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Reatividade de Raça, Etnia e Filtros de Autocomplete', () => {
    it('deve habilitar etnia ao selecionar "Indígena" e desabilitar/resetar ao trocar', () => {
      const ethnicityCtrl = component['personalForm'].controls.ethnicity;
      ethnicityCtrl.enable({ emitEvent: false });
      ethnicityCtrl.setValue('Bororo', { emitEvent: false });

      component['personalForm'].controls.race.setValue('Indígena');
      expect(component['isEthnicityDisabled']()).toBe(false);
      expect(ethnicityCtrl.enabled).toBe(true);
      expect(ethnicityCtrl.value).toBe('Bororo');

      component['personalForm'].controls.race.setValue('Branca');
      expect(component['isEthnicityDisabled']()).toBe(true);
      expect(ethnicityCtrl.disabled).toBe(true);
      expect(ethnicityCtrl.value).toBe('');
    });

    it('deve filtrar opções de naturalidade, profissão e UF', () => {
      component['onNaturalnessSelected']('Cidade 3');
      expect(component['personalForm'].controls.naturalness.value).toBe('Cidade 3');
      expect(component['personalForm'].controls.naturalness.dirty).toBe(true);

      component['personalForm'].controls.naturalness.setValue('Cidade 1');
      expect(component['filteredNaturalnessOptions']()).toContain('Cidade 1');
      expect(component['filteredNaturalnessOptions']()).toContain('Cidade 10');

      component['personalForm'].controls.profession.setValue('Médico');
      expect(
        component['filteredProfessionsOptions']().every((p) =>
          p.toLowerCase().includes('médico')
        )
      ).toBe(true);

      component['addressForm'].controls.state.setValue('MT');
      expect(component['filteredUfsOptions']()).toEqual(['MT']);
    });
  });

  describe('Busca de CEP (ViaCEP)', () => {
    it('deve buscar o endereço após debounce quando CEP tiver 8 dígitos e preencher campos', async () => {
      viacepServiceMock.getAddress.mockReturnValue(
        of({
          logradouro: 'Av. Historiador Rubens de Mendonça',
          bairro: 'Bosque da Saúde',
          localidade: 'Cuiabá',
          uf: 'MT',
        })
      );

      component['addressForm'].controls.cep.setValue('78050-000');
      await vi.advanceTimersByTimeAsync(400);

      expect(viacepServiceMock.getAddress).toHaveBeenCalledWith('78050000');
      expect(component['addressForm'].getRawValue()).toMatchObject({
        address: 'Av. Historiador Rubens de Mendonça',
        neighborhood: 'Bosque da Saúde',
        city: 'Cuiabá',
        state: 'MT',
      });
      expect(component['addressForm'].dirty).toBe(true);
    });

    it('deve tratar erro do ViaCEP sem quebrar o fluxo', async () => {
      viacepServiceMock.getAddress.mockReturnValue(
        throwError(() => new Error('Falha ViaCEP'))
      );

      component['addressForm'].controls.cep.setValue('78050000');
      await vi.advanceTimersByTimeAsync(400);

      expect(viacepServiceMock.getAddress).toHaveBeenCalledWith('78050000');
      expect(component['addressForm'].controls.address.value).toBe('');
    });
  });

  describe('Data de Nascimento, Teclado e Arquivos', () => {
    it('deve lidar com entrada manual vazia, incompleta, válida e inválida em onBirthDateInput', () => {
      const birthCtrl = component['personalForm'].controls.birth_date;

      component['onBirthDateInput']({ target: { value: '   ' } } as unknown as Event);
      expect(birthCtrl.value).toBeNull();

      component['onBirthDateInput']({ target: { value: '1205' } } as unknown as Event);
      expect(birthCtrl.value).toBeNull();

      component['onBirthDateInput']({ target: { value: '32132020' } } as unknown as Event);
      expect(birthCtrl.hasError('invalidDate')).toBe(true);
      expect(birthCtrl.touched).toBe(true);

      component['onBirthDateInput']({ target: { value: '15051990' } } as unknown as Event);
      expect(birthCtrl.hasError('invalidDate')).toBe(false);
      expect(moment.isMoment(birthCtrl.value)).toBe(true);
      expect((birthCtrl.value as Moment).format('YYYY-MM-DD')).toBe('1990-05-15');
    });

    it('deve lidar com setBirthDate via input de texto, ano inválido e valor Moment do datepicker', () => {
      const birthCtrl = component['personalForm'].controls.birth_date;

      component['setBirthDate']({
        value: null,
        targetElement: { value: '20081992' },
      } as unknown as MatDatepickerInputEvent<Moment | null>);
      expect((birthCtrl.value as Moment).format('YYYY-MM-DD')).toBe('1992-08-20');

      component['setBirthDate']({
        value: null,
        targetElement: { value: '01010500' },
      } as unknown as MatDatepickerInputEvent<Moment | null>);
      expect(birthCtrl.hasError('invalidDate')).toBe(true);

      const validMoment = moment('1988-03-10', 'YYYY-MM-DD', true);
      component['setBirthDate']({
        value: validMoment,
        targetElement: null,
      } as unknown as MatDatepickerInputEvent<Moment | null>);
      expect(birthCtrl.hasError('invalidDate')).toBe(false);
      expect(birthCtrl.value).toBe(validMoment);
    });

    it('deve filtrar teclas em onlyNumbersAndSlashes e anexar arquivo em onFileSelected', () => {
      const preventDefault = vi.fn();
      const blocked = component['onlyNumbersAndSlashes']({
        key: 'a',
        preventDefault,
      } as unknown as KeyboardEvent);
      expect(blocked).toBe(false);
      expect(preventDefault).toHaveBeenCalled();

      const allowed = component['onlyNumbersAndSlashes']({
        key: '/',
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent);
      expect(allowed).toBe(true);

      const file = new File(['conteudo'], 'cns.pdf', { type: 'application/pdf' });
      component['onFileSelected'](
        { target: { files: [file] } } as unknown as Event,
        'cns'
      );
      expect(component['files'].cns.file).toBe(file);
      expect(component['files'].cns.label()).toBe('cns.pdf');
      expect(component['files'].cns.hasFile()).toBe(true);
    });

    it('deve popular formulários quando os validadores assíncronos encontrarem paciente existente', () => {
      const foundPatient: Patient = {
        cns: '987654321098765',
        document_type: 'CPF',
        document: '55566677788',
        name: 'Paciente Existente',
        birth_date: '1985-11-20T00:00:00.000Z',
        gender: 'Feminino',
        newborn: true,
        race: 'Indígena',
        ethnicity: 'Terena',
        marital_status: 'Casado',
        mother_name: 'Mãe Teste',
        father_name: 'Pai Teste',
        naturalness: 'Campo Grande',
        phone: '6733001122',
        cell_phone: '67998877665',
        email: 'existente@teste.com',
        profession: 'Enfermeiro',
        deficiency: 'Auditiva',
        cep: '79000000',
        address: 'Rua A',
        number: '50',
        complement: 'Casa',
        neighborhood: 'Centro',
        city: 'Campo Grande',
        state: 'MS',
        sigadoc: 'SIG-999',
        patient_info: {
          control_number: 'CTRL-99',
          observation: 'Obs teste',
        },
      } as unknown as Patient;

      capturedCnsOnFound?.(foundPatient);
      capturedDocOnFound?.(foundPatient);

      expect(component['identificationForm'].controls.cns.value).toBe('987654321098765');
      expect(component['identificationForm'].controls.document.value).toBe('55566677788');
      expect(component['personalForm'].controls.name.value).toBe('Paciente Existente');
      expect(
        (component['personalForm'].controls.birth_date.value as Moment).format('YYYY-MM-DD')
      ).toBe('1985-11-20');
      expect(component['isEthnicityDisabled']()).toBe(false);
      expect(component['infoForm'].controls.control_number.value).toBe('CTRL-99');
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('deve marcar todos os formulários como tocados e não chamar createPatient quando inválido', () => {
      component['onSubmit']();

      expect(patientServiceMock.createPatient).not.toHaveBeenCalled();
      expect(component['identificationForm'].controls.cns.touched).toBe(true);
      expect(component['personalForm'].controls.name.touched).toBe(true);
      expect(component['addressForm'].controls.cep.touched).toBe(true);
      expect(component['infoForm'].controls.sigadoc.touched).toBe(true);
    });

    it('deve enviar payload formatado, desabilitar/reabilitar formulários, notificar canal e fechar dialog no sucesso', () => {
      fillValidForm();
      const file = new File(['doc'], 'doc.pdf', { type: 'application/pdf' });
      component['onFileSelected'](
        { target: { files: [file] } } as unknown as Event,
        'document'
      );

      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.createPatient.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['personalForm'].disabled).toBe(true);

      pending$.next({ message: 'Paciente salvo!' });
      pending$.complete();
      fixture.detectChanges();

      expect(patientServiceMock.createPatient).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Carlos Eduardo',
          birth_date: '1990-05-15',
          file_document: file,
          file_cns: null,
        })
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Paciente salvo!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['personalForm'].enabled).toBe(true);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      fillValidForm();
      patientServiceMock.createPatient.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Paciente cadastrado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro do backend e não fechar o dialog em caso de falha', () => {
      fillValidForm();
      patientServiceMock.createPatient.mockReturnValue(
        throwError(() => ({ error: { message: 'CNS duplicado no servidor.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'CNS duplicado no servidor.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      fillValidForm();
      patientServiceMock.createPatient.mockReturnValue(
        throwError(() => new Error('Erro inesperado'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao salvar paciente.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});