// src/app/tfd/components/patients/patient-escort-update/patient-escort-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { saveAs } from 'file-saver';
import moment, { Moment } from 'moment';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientEscortUpdateComponent,
  PatientEscortUpdateDialogData,
} from './patient-escort-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ViacepService } from '../../../../core/services/viacep.service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { Ufs } from '../../../enums/ufs';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('PatientEscortUpdateComponent', () => {
  let component: PatientEscortUpdateComponent;
  let fixture: ComponentFixture<PatientEscortUpdateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let viacepServiceMock: {
    getAddress: ReturnType<typeof vi.fn>;
  };
  let patientServiceMock: {
    updatePatientEscort: ReturnType<typeof vi.fn>;
    cnsEscortExistsValidator: ReturnType<typeof vi.fn>;
    documentEscortExistsValidator: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let storageServiceMock: {
    download: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: PatientEscortUpdateDialogData | null;

  let capturedCnsOnFound: ((escort: PatientEscort) => void) | undefined;
  let capturedDocOnFound: ((escort: PatientEscort) => void) | undefined;

  const baseDialogData: PatientEscortUpdateDialogData = {
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
    patient_escort: {
      id: 42,
      cns: '123456789012345',
      file_cns_id: 11,
      document: '12345678901',
      file_document_id: 22,
      name: 'Fernanda Lima',
      relation: 'Filha',
      birth_date: '1995-07-10',
      gender: 'Feminino',
      is_same_address: false,
      cep: '78010-000',
      address: 'Av. Getúlio Vargas',
      file_address_id: 33,
      number: '500',
      complement: 'Sala 4',
      neighborhood: 'Centro',
      city: 'Cuiabá',
      state: 'MT',
    } as unknown as PatientEscort,
  };

  function createPassAsyncValidator(): AsyncValidatorFn {
    return () => of(null as ValidationErrors | null);
  }

  function fillValidPersonalForm(isSameAddress = false): void {
    component['personalForm'].patchValue({
      cns: '123456789012345',
      file_cns_id: 11,
      document: '12345678901',
      file_document_id: 22,
      name: 'Fernanda Lima Atualizada',
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
      file_address_id: 33,
      number: '500',
      complement: 'Sala 4',
      neighborhood: 'Centro',
      city: 'Cuiabá',
      state: 'MT',
    });
  }

  async function createComponent(
    dialogData: PatientEscortUpdateDialogData | null = {
      patient_care: baseDialogData.patient_care,
      patient_escort: { ...baseDialogData.patient_escort },
    }
  ): Promise<void> {
    mockDialogData = dialogData;
    capturedCnsOnFound = undefined;
    capturedDocOnFound = undefined;

    patientServiceMock.cnsEscortExistsValidator.mockImplementation(
      (
        _care: PatientCare | undefined,
        _current: string | null,
        onFound?: (escort: PatientEscort) => void
      ) => {
        capturedCnsOnFound = onFound;
        return createPassAsyncValidator();
      }
    );

    patientServiceMock.documentEscortExistsValidator.mockImplementation(
      (
        _care: PatientCare | undefined,
        _current: string | null,
        onFound?: (escort: PatientEscort) => void
      ) => {
        capturedDocOnFound = onFound;
        return createPassAsyncValidator();
      }
    );

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientEscortUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: ViacepService, useValue: viacepServiceMock },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(PatientEscortUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientEscortUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.mocked(saveAs).mockClear();

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
      updatePatientEscort: vi.fn(),
      cnsEscortExistsValidator: vi.fn(),
      documentEscortExistsValidator: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    storageServiceMock = {
      download: vi.fn(),
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

  it('deve criar o componente, abrir o BroadcastChannel e preencher formulários com dados iniciais', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['isSubmitting']()).toBe(false);
    expect(component['isSameAddress']()).toBe(false);
    expect(component['isFormsPristine']()).toBe(true);
    expect(component['isFormInvalidOrPending']).toBe(false);
    expect(component['personalForm'].controls.name.value).toBe('Fernanda Lima');
    expect(component['addressForm'].controls.address.value).toBe('Av. Getúlio Vargas');
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve iniciar com addressForm desabilitado quando patient_escort tiver is_same_address true', async () => {
    await createComponent({
      patient_care: baseDialogData.patient_care,
      patient_escort: {
        ...baseDialogData.patient_escort,
        is_same_address: true,
      } as unknown as PatientEscort,
    });

    expect(component['isSameAddress']()).toBe(true);
    expect(component['addressForm'].disabled).toBe(true);
    expect(component['isFormInvalidOrPending']).toBe(false);
  });

  describe('Endereço do Paciente (is_same_address), CEP e Filtro de UF', () => {
    it('deve copiar endereço do paciente quando is_same_address for true e resetar addressForm quando marcado como false de forma dirty', () => {
      component['personalForm'].controls.is_same_address.setValue(true);
      expect(component['isSameAddress']()).toBe(true);
      expect(component['addressForm'].disabled).toBe(true);
      expect(component['addressForm'].getRawValue()).toMatchObject({
        cep: '78060-100',
        address: 'Rua do Paciente',
        file_address_id: 77,
        number: '250',
        neighborhood: 'Jardim Glória',
      });

      const sameAddrCtrl = component['personalForm'].controls.is_same_address;
      sameAddrCtrl.markAsDirty();
      sameAddrCtrl.setValue(false);

      expect(component['isSameAddress']()).toBe(false);
      expect(component['addressForm'].enabled).toBe(true);
      expect(component['addressForm'].controls.cep.value).toBe('78010-000');
      expect(component['personalForm'].dirty).toBe(true);
    });

    it('deve filtrar opções de UF conforme o valor de state', () => {
      component['addressForm'].controls.state.setValue('MT');
      expect(component['filteredUfsOptions']()).toEqual(['MT']);

      component['addressForm'].controls.state.setValue('');
      expect(component['filteredUfsOptions']()).toEqual(Object.keys(Ufs));
    });

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
    });
  });

  describe('Data de Nascimento, Teclado, Arquivos, Download e Preenchimento Automático', () => {
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

      component['onBirthDateInput']({ target: { value: '' } } as unknown as Event);
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

    it('deve filtrar teclas em onlyNumbersAndSlashes e anexar arquivos atualizando isFormsPristine', () => {
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

      const cnsFile = new File(['cns'], 'cns.pdf', { type: 'application/pdf' });
      component['onFileSelected'](
        { target: { files: [cnsFile] } } as unknown as Event,
        'cns'
      );
      expect(component['files'].cns.file).toBe(cnsFile);
      expect(component['files'].cns.label()).toBe('cns.pdf');
      expect(component['files'].cns.hasFile()).toBe(true);
      expect(component['hasAttachedFiles']()).toBe(true);
      expect(component['isFormsPristine']()).toBe(false);

      const addrFile = new File(['addr'], 'comprovante.pdf', { type: 'application/pdf' });
      component['onFileSelected'](
        { target: { files: [addrFile] } } as unknown as Event,
        'address'
      );
      expect(component['files'].address.file).toBe(addrFile);
      expect(component['addressForm'].dirty).toBe(true);
    });

    it('deve realizar download de anexo quando archiveId for válido e response contiver archive', () => {
      component['download'](null, 'doc.pdf');
      component['download'](undefined, 'doc.pdf');
      expect(storageServiceMock.download).not.toHaveBeenCalled();

      storageServiceMock.download.mockReturnValueOnce(of({}));
      component['download'](10, 'doc.pdf');
      expect(saveAs).not.toHaveBeenCalled();

      const blob = new Blob(['conteudo'], { type: 'application/pdf' });
      storageServiceMock.download.mockReturnValueOnce(of({ archive: blob }));
      component['download'](10, 'doc.pdf');
      expect(storageServiceMock.download).toHaveBeenCalledWith('tfd', 10);
      expect(saveAs).toHaveBeenCalledWith(blob, 'doc.pdf');
    });

    it('deve popular dados ao encontrar acompanhante existente via validadores assíncronos', () => {
      const foundEscort: PatientEscort = {
        cns: '111222333444555',
        file_cns_id: 5,
        document: '99988877766',
        file_document_id: 6,
        name: 'Acompanhante Encontrado',
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
      expect(component['personalForm'].controls.name.value).toBe('Acompanhante Encontrado');
      expect(
        (component['personalForm'].controls.birth_date.value as Moment).format('YYYY-MM-DD')
      ).toBe('1980-02-14');
      expect(component['addressForm'].controls.address.value).toBe('Rua Própria');
      expect(component['personalForm'].dirty).toBe(true);
      expect(component['addressForm'].dirty).toBe(true);
    });
  });

  describe('Atualização do Acompanhante (onSubmit)', () => {
    it('deve exibir mensagem e não chamar updatePatientEscort quando IDs estiverem ausentes', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificadores do atendimento ou acompanhante não encontrados.'
      );
      expect(patientServiceMock.updatePatientEscort).not.toHaveBeenCalled();
    });

    it('deve marcar formulários como tocados e não submeter quando inválido', () => {
      component['personalForm'].controls.name.setValue('');
      component['addressForm'].controls.cep.setValue('');

      component['onSubmit']();

      expect(patientServiceMock.updatePatientEscort).not.toHaveBeenCalled();
      expect(component['personalForm'].controls.name.touched).toBe(true);
      expect(component['addressForm'].controls.cep.touched).toBe(true);
    });

    it('deve enviar payload, desabilitar/reabilitar formulários respeitando isSameAddress, notificar canal e fechar dialog no sucesso', () => {
      fillValidPersonalForm(true);
      const docFile = new File(['doc'], 'doc.pdf', { type: 'application/pdf' });
      component['onFileSelected'](
        { target: { files: [docFile] } } as unknown as Event,
        'document'
      );

      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.updatePatientEscort.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['personalForm'].disabled).toBe(true);
      expect(component['addressForm'].disabled).toBe(true);

      pending$.next({ message: 'Acompanhante atualizado!' });
      pending$.complete();
      fixture.detectChanges();

      expect(patientServiceMock.updatePatientEscort).toHaveBeenCalledWith(
        15,
        42,
        expect.objectContaining({
          name: 'Fernanda Lima Atualizada',
          birth_date: '1995-07-10',
          is_same_address: true,
          file_document: docFile,
          file_cns: null,
          file_address: null,
        })
      );
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Acompanhante atualizado!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['personalForm'].enabled).toBe(true);
      expect(component['addressForm'].disabled).toBe(true);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      fillValidPersonalForm(false);
      fillValidAddressForm();
      patientServiceMock.updatePatientEscort.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Acompanhante atualizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve exibir mensagem de erro da API e não fechar o dialog em caso de falha', () => {
      fillValidPersonalForm(false);
      fillValidAddressForm();
      patientServiceMock.updatePatientEscort.mockReturnValue(
        throwError(() => ({ error: { message: 'Falha de validação no servidor.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Falha de validação no servidor.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['addressForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      fillValidPersonalForm(false);
      fillValidAddressForm();
      patientServiceMock.updatePatientEscort.mockReturnValue(
        throwError(() => new Error('Erro inesperado'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao atualizar acompanhante.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});