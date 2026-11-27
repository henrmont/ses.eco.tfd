// src/app/tfd/components/patients/patient-escort-create/patient-escort-create.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import moment, { Moment } from 'moment';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientEscortCreateComponent,
  PatientEscortCreateDialogData,
} from './patient-escort-create.component';
import { MessageService } from '../../../../core/services/message.service';
import { ViacepService } from '../../../../core/services/viacep.service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';
import { Ufs } from '../../../enums/ufs';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientEscortCreateComponent', () => {
  let component: PatientEscortCreateComponent;
  let fixture: ComponentFixture<PatientEscortCreateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let viacepServiceMock: {
    getAddress: ReturnType<typeof vi.fn>;
  };
  let patientServiceMock: {
    createPatientEscort: ReturnType<typeof vi.fn>;
    cnsEscortExistsValidator: ReturnType<typeof vi.fn>;
    documentEscortExistsValidator: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientEscortCreateDialogData | null;

  let capturedCnsOnFound: ((escort: PatientEscort) => void) | undefined;
  let capturedDocOnFound: ((escort: PatientEscort) => void) | undefined;

  const baseDialogData: PatientEscortCreateDialogData = {
    patient_care: {
      id: 15,
      patient: {
        cep: '78060-100',
        address: 'Rua do Paciente',
        file_address_id: 77,
        number: '250',
        complement: 'Bloco B',
        neighborhood: 'Jardim Glória',
        city: 'Cuiabá',
        state: 'MT',
      },
    } as unknown as PatientCare,
  };

  function createPassAsyncValidator(): AsyncValidatorFn {
    return () => of(null as ValidationErrors | null);
  }

  function fillValidPersonalForm(isSameAddress = false): void {
    component['personalForm'].patchValue({
      cns: '123456789012345',
      file_cns_id: 10,
      document: '12345678901',
      file_document_id: 20,
      name: 'Fernanda Lima',
      relation: 'Filha',
      birth_date: moment('1995-07-10', 'YYYY-MM-DD', true),
      gender: 'Feminino',
      is_same_address: isSameAddress,
    });
  }

  function fillValidAddressForm(): void {
    component['addressForm'].patchValue({
      cep: '78010-000',
      address: 'Av. Getúlio Vargas',
      file_address_id: 30,
      number: '500',
      complement: 'Sala 4',
      neighborhood: 'Centro',
      city: 'Cuiabá',
      state: 'MT',
    });
  }

  async function createComponent(
    dialogData: PatientEscortCreateDialogData | null = baseDialogData
  ): Promise<void> {
    mockDialogData = dialogData;
    capturedCnsOnFound = undefined;
    capturedDocOnFound = undefined;

    patientServiceMock.cnsEscortExistsValidator.mockImplementation(
      (
        _care: PatientCare | undefined,
        _id: number | null,
        onFound?: (escort: PatientEscort) => void
      ) => {
        capturedCnsOnFound = onFound;
        return createPassAsyncValidator();
      }
    );

    patientServiceMock.documentEscortExistsValidator.mockImplementation(
      (
        _care: PatientCare | undefined,
        _id: number | null,
        onFound?: (escort: PatientEscort) => void
      ) => {
        capturedDocOnFound = onFound;
        return createPassAsyncValidator();
      }
    );

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientEscortCreateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: ViacepService, useValue: viacepServiceMock },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientEscortCreateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientEscortCreateComponent);
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
    vi.spyOn(CustomValidators, 'cpfValidator').mockReturnValue(() => null);
    vi.spyOn(CustomValidators, 'dateValidator').mockReturnValue(() => null);
    vi.spyOn(CustomValidators, 'birthDateValidator').mockReturnValue(() => null);

    viacepServiceMock = {
      getAddress: vi.fn().mockReturnValue(of({ erro: true })),
    };

    patientServiceMock = {
      createPatientEscort: vi.fn(),
      cnsEscortExistsValidator: vi.fn(),
      documentEscortExistsValidator: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e inicializar os formulários', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isSameAddress']()).toBe(false);
    expect(component['personalForm']).toBeDefined();
    expect(component['addressForm']).toBeDefined();
    expect(component['isFormInvalidOrPending']).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Endereço do Paciente (is_same_address) e Filtro de UF', () => {
    it('deve copiar endereço do paciente e desabilitar addressForm quando is_same_address for true, e reabilitar/resetar quando false', () => {
      fillValidPersonalForm(true);

      expect(component['isSameAddress']()).toBe(true);
      expect(component['addressForm'].disabled).toBe(true);
      expect(component['addressForm'].getRawValue()).toEqual({
        cep: '78060-100',
        address: 'Rua do Paciente',
        file_address_id: 77,
        number: '250',
        complement: 'Bloco B',
        neighborhood: 'Jardim Glória',
        city: 'Cuiabá',
        state: 'MT',
      });
      expect(component['isFormInvalidOrPending']).toBe(false);

      component['personalForm'].controls.is_same_address.setValue(false);
      expect(component['isSameAddress']()).toBe(false);
      expect(component['addressForm'].enabled).toBe(true);
      expect(component['addressForm'].controls.cep.value).toBe('');
      expect(component['isFormInvalidOrPending']).toBe(true);
    });

    it('deve filtrar opções de UF conforme o valor de state', () => {
      component['addressForm'].controls.state.setValue('MT');
      expect(component['filteredUfsOptions']()).toEqual(['MT']);

      component['addressForm'].controls.state.setValue('');
      expect(component['filteredUfsOptions']()).toEqual(Object.keys(Ufs));
    });
  });

  describe('Busca de CEP (ViaCEP)', () => {
    it('deve buscar endereço após debounce quando CEP tiver 8 dígitos e preencher campos', async () => {
      viacepServiceMock.getAddress.mockReturnValue(
        of({
          logradouro: 'Rua das Flores',
          bairro: 'Popular',
          localidade: 'Cuiabá',
          uf: 'MT',
        })
      );

      component['addressForm'].controls.cep.setValue('78045-000');
      await vi.advanceTimersByTimeAsync(400);

      expect(viacepServiceMock.getAddress).toHaveBeenCalledWith('78045000');
      expect(component['addressForm'].getRawValue()).toMatchObject({
        address: 'Rua das Flores',
        neighborhood: 'Popular',
        city: 'Cuiabá',
        state: 'MT',
      });
      expect(component['addressForm'].dirty).toBe(true);
    });

    it('deve tratar erro do ViaCEP sem quebrar o fluxo', async () => {
      viacepServiceMock.getAddress.mockReturnValue(
        throwError(() => new Error('Erro de rede ViaCEP'))
      );

      component['addressForm'].controls.cep.setValue('78045-000');
      await vi.advanceTimersByTimeAsync(400);

      expect(viacepServiceMock.getAddress).toHaveBeenCalledWith('78045000');
      expect(component['addressForm'].controls.address.value).toBe('');
    });
  });

  describe('Data de Nascimento, Teclado, Arquivos e Preenchimento Automático', () => {
    it('deve validar entradas em onBirthDateInput e setBirthDate', () => {
      const birthCtrl = component['personalForm'].controls.birth_date;

      component['onBirthDateInput']({ target: { value: '' } } as unknown as Event);
      expect(birthCtrl.value).toBeNull();

      component['onBirthDateInput']({ target: { value: '1007' } } as unknown as Event);
      expect(birthCtrl.value).toBeNull();

      component['onBirthDateInput']({ target: { value: '99999999' } } as unknown as Event);
      expect(birthCtrl.hasError('invalidDate')).toBe(true);
      expect(birthCtrl.touched).toBe(true);

      component['onBirthDateInput']({ target: { value: '10071995' } } as unknown as Event);
      expect(birthCtrl.hasError('invalidDate')).toBe(false);
      expect((birthCtrl.value as Moment).format('YYYY-MM-DD')).toBe('1995-07-10');

      component['setBirthDate']({
        value: null,
        targetElement: null,
      } as unknown as MatDatepickerInputEvent<Moment | null>);
      expect(birthCtrl.value).toBeNull();

      const inputEl = { value: '15/08/1991' };
      component['setBirthDate']({
        value: null,
        targetElement: inputEl,
      } as unknown as MatDatepickerInputEvent<Moment | null>);
      expect((birthCtrl.value as Moment).format('YYYY-MM-DD')).toBe('1991-08-15');

      const invalidInputEl = { value: '15-08-1991' };
      component['setBirthDate']({
        value: null,
        targetElement: invalidInputEl,
      } as unknown as MatDatepickerInputEvent<Moment | null>);
      expect(birthCtrl.hasError('invalidDate')).toBe(true);
      expect(invalidInputEl.value).toBe('15-08-1991');
    });

    it('deve filtrar teclas em onlyNumbersAndSlashes e anexar arquivos em onFileSelected', () => {
      const preventDefault = vi.fn();
      expect(
        component['onlyNumbersAndSlashes']({
          key: 'x',
          preventDefault,
        } as unknown as KeyboardEvent)
      ).toBe(false);
      expect(preventDefault).toHaveBeenCalled();

      expect(
        component['onlyNumbersAndSlashes']({
          key: '5',
          preventDefault: vi.fn(),
        } as unknown as KeyboardEvent)
      ).toBe(true);

      const file = new File(['rg'], 'rg.pdf', { type: 'application/pdf' });
      component['onFileSelected'](
        { target: { files: [file] } } as unknown as Event,
        'document'
      );
      expect(component['files'].document.file).toBe(file);
      expect(component['files'].document.label()).toBe('rg.pdf');
      expect(component['files'].document.hasFile()).toBe(true);
    });

    it('deve popular dados ao encontrar acompanhante existente via validadores assíncronos', () => {
      const foundEscort: PatientEscort = {
        cns: '111222333444555',
        file_cns_id: 5,
        document: '99988877766',
        file_document_id: 6,
        name: 'Acompanhante Existente',
        relation: 'Esposa',
        birth_date: '1980-02-14',
        gender: 'Feminino',
        is_same_address: false,
        cep: '78020-000',
        address: 'Rua Própria',
        file_address_id: 7,
        number: '12',
        complement: 'Fundos',
        neighborhood: 'Bandeirantes',
        city: 'Cuiabá',
        state: 'MT',
      } as unknown as PatientEscort;

      capturedCnsOnFound?.(foundEscort);
      capturedDocOnFound?.(foundEscort);

      expect(component['personalForm'].controls.cns.value).toBe('111222333444555');
      expect(component['personalForm'].controls.document.value).toBe('99988877766');
      expect(component['personalForm'].controls.name.value).toBe('Acompanhante Existente');
      expect(
        (component['personalForm'].controls.birth_date.value as Moment).format('YYYY-MM-DD')
      ).toBe('1980-02-14');
      expect(component['addressForm'].controls.address.value).toBe('Rua Própria');
      expect(component['personalForm'].dirty).toBe(true);
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('deve exibir mensagem e não chamar createPatientEscort quando patientCareId estiver ausente', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do atendimento do paciente inválido.'
      );
      expect(patientServiceMock.createPatientEscort).not.toHaveBeenCalled();
    });

    it('deve marcar formulários como tocados e não submeter quando inválido', () => {
      component['onSubmit']();

      expect(patientServiceMock.createPatientEscort).not.toHaveBeenCalled();
      expect(component['personalForm'].controls.name.touched).toBe(true);
      expect(component['addressForm'].controls.cep.touched).toBe(true);
    });

    it('deve enviar payload, desabilitar/reabilitar formulários respeitando isSameAddress, notificar canal e fechar dialog no sucesso', () => {
      fillValidPersonalForm(true);
      const cnsFile = new File(['cns'], 'cns.png', { type: 'image/png' });
      component['onFileSelected'](
        { target: { files: [cnsFile] } } as unknown as Event,
        'cns'
      );

      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.createPatientEscort.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['personalForm'].disabled).toBe(true);
      expect(component['addressForm'].disabled).toBe(true);

      pending$.next({ message: 'Acompanhante salvo!' });
      pending$.complete();
      fixture.detectChanges();

      expect(patientServiceMock.createPatientEscort).toHaveBeenCalledWith(
        15,
        expect.objectContaining({
          name: 'Fernanda Lima',
          birth_date: '1995-07-10',
          is_same_address: true,
          cep: '78060-100',
          file_cns: cnsFile,
          file_document: null,
          file_address: null,
        })
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Acompanhante salvo!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['personalForm'].enabled).toBe(true);
      expect(component['addressForm'].disabled).toBe(true);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      fillValidPersonalForm(false);
      fillValidAddressForm();
      patientServiceMock.createPatientEscort.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Acompanhante cadastrado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API e não fechar o dialog em caso de falha', () => {
      fillValidPersonalForm(false);
      fillValidAddressForm();
      patientServiceMock.createPatientEscort.mockReturnValue(
        throwError(() => ({ error: { message: 'CPF já cadastrado.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('CPF já cadastrado.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['addressForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      fillValidPersonalForm(false);
      fillValidAddressForm();
      patientServiceMock.createPatientEscort.mockReturnValue(
        throwError(() => new Error('Falha inesperada'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao salvar acompanhante.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});