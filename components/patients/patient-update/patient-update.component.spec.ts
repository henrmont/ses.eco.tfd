// src/app/tfd/components/patients/patient-update/patient-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import moment from 'moment';
import { saveAs } from 'file-saver';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientUpdateComponent } from './patient-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ViacepService } from '../../../../core/services/viacep.service';
import { PatientCare } from '../../../models/patient-care.model';
import { Patient } from '../../../models/patient.model';
import { PatientService } from '../../../services/patient.service';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

function makeValidCpf(): string {
  const n = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const d1Calc = (n.reduce((acc, digit, idx) => acc + digit * (10 - idx), 0) * 10) % 11;
  const d1 = d1Calc === 10 ? 0 : d1Calc;
  const d2Calc =
    ([...n, d1].reduce((acc, digit, idx) => acc + digit * (11 - idx), 0) * 10) % 11;
  const d2 = d2Calc === 10 ? 0 : d2Calc;
  return [...n, d1, d2].join('');
}

function makeValidCns(): string {
  const prefix = [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const sum = prefix.reduce((acc, digit, idx) => acc + digit * (15 - idx), 0);
  const remainder = sum % 11;
  const dv = remainder === 0 ? 0 : 11 - remainder;
  if (dv === 10) {
    const altSum = sum + 2;
    const altRem = altSum % 11;
    const altDv = altRem === 0 ? 0 : 11 - altRem;
    return `${prefix.join('')}001${altDv}`;
  }
  return `${prefix.join('')}000${dv}`;
}

describe('PatientUpdateComponent', () => {
  let component: PatientUpdateComponent;
  let fixture: ComponentFixture<PatientUpdateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let patientServiceMock: {
    updatePatient: ReturnType<typeof vi.fn>;
    cnsPatientExistsValidator: ReturnType<typeof vi.fn>;
    documentPatientExistsValidator: ReturnType<typeof vi.fn>;
  };
  let viacepServiceMock: {
    getAddress: ReturnType<typeof vi.fn>;
    getNaturalness: ReturnType<typeof vi.fn>;
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

  let capturedCnsFoundCallback: ((patient: Patient) => void) | undefined;
  let capturedDocFoundCallback: ((patient: Patient) => void) | undefined;

  const validCns = makeValidCns();
  const validCpf = makeValidCpf();

  const sampleCities = Array.from({ length: 15 }, (_, idx) => ({
    nome: idx === 0 ? 'Cuiabá' : `Cidade ${idx}`,
  }));

  const basePatientCare: PatientCare = {
    id: 55,
    patient: {
      cns: validCns,
      document_type: 'CPF',
      document: validCpf,
      name: 'Maria Silva',
      birth_date: '1990-05-15',
      gender: 'Feminino',
      newborn: false,
      race: 'Parda',
      ethnicity: '',
      marital_status: 'Solteiro(a)',
      mother_name: 'Joana Silva',
      father_name: 'Pedro Silva',
      naturalness: 'Cuiabá',
      phone: '6533221100',
      cell_phone: '65999887766',
      email: 'maria@exemplo.com',
      profession: 'Enfermeiro(a)',
      deficiency: 'Nenhuma',
      cep: '78000-000',
      address: 'Rua das Flores',
      number: '100',
      complement: 'Apto 12',
      neighborhood: 'Centro',
      city: 'Cuiabá',
      state: 'MT',
      patient_info: {
        control_number: 'CTL-10',
        sigadoc: 'SIG-2026-1',
        observation: 'Observação inicial',
      },
    },
  } as unknown as PatientCare;

  async function createComponent(
    dialogData: { patient_care: PatientCare } | null = { patient_care: basePatientCare }
  ): Promise<void> {
    capturedCnsFoundCallback = undefined;
    capturedDocFoundCallback = undefined;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientService, useValue: patientServiceMock },
          { provide: ViacepService, useValue: viacepServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PatientUpdateComponent);
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

    patientServiceMock = {
      updatePatient: vi.fn().mockReturnValue(of({ message: 'Atualizado com sucesso!' })),
      cnsPatientExistsValidator: vi.fn((_current, onFound) => {
        capturedCnsFoundCallback = onFound;
        return () => of(null);
      }),
      documentPatientExistsValidator: vi.fn((_current, onFound) => {
        capturedDocFoundCallback = onFound;
        return () => of(null);
      }),
    };

    viacepServiceMock = {
      getAddress: vi.fn().mockReturnValue(
        of({
          logradouro: 'Av. Historiador Rubens de Mendonça',
          bairro: 'Bosque da Saúde',
          localidade: 'Cuiabá',
          uf: 'MT',
        })
      ),
      getNaturalness: vi.fn().mockReturnValue(of(sampleCities)),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    storageServiceMock = {
      download: vi.fn().mockReturnValue(of({ archive: new Blob(['conteudo']) })),
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

  it('deve criar o componente, abrir o BroadcastChannel, preencher formulários e carregar naturalidades', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-patients-channel');
    expect(component['personalForm'].controls.name.value).toBe('Maria Silva');
    expect(component['infoForm'].controls.sigadoc.value).toBe('SIG-2026-1');
    expect(component['isEthnicityDisabled']()).toBe(true);
    expect(component['personalForm'].controls.ethnicity.disabled).toBe(true);
    expect(component['naturalnessLoading']()).toBe(false);
    expect(component['filteredNaturalnessOptions']()).toEqual(['Cuiabá']);
    expect(component['isFormsPristine']()).toBe(true);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();
    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve habilitar etnia quando race inicial for Indígena e lidar com data inválida ou ausente', async () => {
    await createComponent({
      patient_care: {
        id: 56,
        patient: {
          cns: validCns,
          document: validCpf,
          name: 'Curumim',
          birth_date: 'data-invalida',
          race: 'Indígena',
          ethnicity: 'Bororo',
          naturalness: 'Cuiabá',
          cep: '78000-000',
          address: 'Rua A',
          number: '10',
          neighborhood: 'Centro',
          sigadoc: 'SIG-2',
        },
      } as unknown as PatientCare,
    });

    expect(component['isEthnicityDisabled']()).toBe(false);
    expect(component['personalForm'].controls.ethnicity.enabled).toBe(true);
    expect(component['personalForm'].controls.ethnicity.value).toBe('Bororo');
    expect(component['personalForm'].controls.birth_date.value).toBeNull();
    expect(component['infoForm'].controls.sigadoc.value).toBe('SIG-2');
  });

  describe('Etnia, Autocompletes e CEP', () => {
    it('deve habilitar e desabilitar ethnicity conforme mudança de race', () => {
      component['personalForm'].controls.race.setValue('Indígena');
      expect(component['isEthnicityDisabled']()).toBe(false);
      expect(component['personalForm'].controls.ethnicity.enabled).toBe(true);

      component['personalForm'].controls.race.setValue('Parda');
      expect(component['isEthnicityDisabled']()).toBe(true);
      expect(component['personalForm'].controls.ethnicity.disabled).toBe(true);
      expect(component['personalForm'].controls.ethnicity.value).toBe('');
    });

    it('deve filtrar opções de naturalidade, profissão e UF, e selecionar naturalidade', () => {
      component['personalForm'].controls.naturalness.setValue('Cidade 1');
      expect(component['filteredNaturalnessOptions']()).toContain('Cidade 1');

      const targetProfession = component['options'].professions[0];
      component['personalForm'].controls.profession.setValue(targetProfession);
      expect(component['filteredProfessionsOptions']()).toContain(targetProfession);

      component['addressForm'].controls.state.setValue('MT');
      expect(component['filteredUfsOptions']()).toEqual(['MT']);

      component['onNaturalnessSelected']('Cuiabá');
      expect(component['personalForm'].controls.naturalness.value).toBe('Cuiabá');
      expect(component['personalForm'].controls.naturalness.dirty).toBe(true);
    });

    it('deve buscar endereço via ViaCEP após debounce e ignorar resposta com erro ou exceção', () => {
      component['addressForm'].controls.cep.setValue('78050000');
      vi.advanceTimersByTime(400);

      expect(viacepServiceMock.getAddress).toHaveBeenCalledWith('78050000');
      expect(component['addressForm'].controls.address.value).toBe(
        'Av. Historiador Rubens de Mendonça'
      );
      expect(component['addressForm'].controls.neighborhood.value).toBe('Bosque da Saúde');
      expect(component['addressForm'].dirty).toBe(true);

      viacepServiceMock.getAddress.mockReturnValueOnce(of({ erro: true }));
      component['addressForm'].controls.cep.setValue('78050001');
      vi.advanceTimersByTime(400);
      expect(component['addressForm'].controls.address.value).toBe(
        'Av. Historiador Rubens de Mendonça'
      );

      viacepServiceMock.getAddress.mockReturnValueOnce(throwError(() => new Error('ViaCEP offline')));
      component['addressForm'].controls.cep.setValue('78050002');
      vi.advanceTimersByTime(400);
      expect(component['addressForm'].controls.address.value).toBe(
        'Av. Historiador Rubens de Mendonça'
      );
    });
  });

  describe('Data de Nascimento e Teclado', () => {
    it('deve tratar entrada manual em onBirthDateInput (vazio, incompleto, inválida e válida)', () => {
      const ctrl = component['personalForm'].controls.birth_date;

      const emptyInput = { value: '   ' } as HTMLInputElement;
      component['onBirthDateInput']({ target: emptyInput } as unknown as Event);
      expect(ctrl.value).toBeNull();

      const shortInput = { value: '1505' } as HTMLInputElement;
      component['onBirthDateInput']({ target: shortInput } as unknown as Event);
      expect(component['personalForm'].dirty).toBe(false);

      const invalidYearInput = { value: '15050500' } as HTMLInputElement;
      component['onBirthDateInput']({ target: invalidYearInput } as unknown as Event);
      expect(ctrl.errors?.['invalidDate']).toBe(true);

      const validInput = { value: '20/10/1995' } as HTMLInputElement;
      component['onBirthDateInput']({ target: validInput } as unknown as Event);
      expect(ctrl.errors).toBeNull();
      expect(moment.isMoment(ctrl.value)).toBe(true);
      expect(ctrl.value?.format('YYYY-MM-DD')).toBe('1995-10-20');
      expect(component['personalForm'].dirty).toBe(true);
    });

    it('deve tratar setBirthDate via inputElement e via event.value do datepicker', () => {
      const ctrl = component['personalForm'].controls.birth_date;

      component['setBirthDate']({
        target: {},
        targetElement: { value: '0000' } as HTMLInputElement,
        value: null,
      } as unknown as MatDatepickerInputEvent<moment.Moment | null>);
      expect(ctrl.errors?.['invalidDate']).toBe(true);

      component['setBirthDate']({
        target: {},
        targetElement: { value: '01/01/1992' } as HTMLInputElement,
        value: null,
      } as unknown as MatDatepickerInputEvent<moment.Moment | null>);
      expect(ctrl.errors).toBeNull();
      expect(ctrl.value?.format('YYYY-MM-DD')).toBe('1992-01-01');

      component['setBirthDate']({
        target: {},
        targetElement: { value: '' } as HTMLInputElement,
        value: moment('0500-01-01', 'YYYY-MM-DD'),
      } as unknown as MatDatepickerInputEvent<moment.Moment | null>);
      expect(ctrl.errors?.['invalidDate']).toBe(true);

      component['setBirthDate']({
        target: {},
        targetElement: { value: '' } as HTMLInputElement,
        value: moment('1998-07-10', 'YYYY-MM-DD'),
      } as unknown as MatDatepickerInputEvent<moment.Moment | null>);
      expect(ctrl.errors).toBeNull();
      expect(ctrl.value?.format('YYYY-MM-DD')).toBe('1998-07-10');
    });

    it('deve filtrar caracteres em onlyNumbersAndSlashes', () => {
      const preventDefault = vi.fn();
      expect(
        component['onlyNumbersAndSlashes']({ key: 'a', preventDefault } as unknown as KeyboardEvent)
      ).toBe(false);
      expect(preventDefault).toHaveBeenCalledTimes(1);

      expect(
        component['onlyNumbersAndSlashes']({ key: '1', preventDefault } as unknown as KeyboardEvent)
      ).toBe(true);
      expect(
        component['onlyNumbersAndSlashes']({ key: '/', preventDefault } as unknown as KeyboardEvent)
      ).toBe(true);
    });
  });

  describe('Arquivos e Download', () => {
    it('deve anexar arquivos nos diferentes grupos e atualizar isFormsPristine()', () => {
      const makeFileEvent = (name: string) =>
        ({
          target: {
            files: [new File(['abc'], name, { type: 'application/pdf' })],
          },
        }) as unknown as Event;

      component['onFileSelected'](makeFileEvent('cns.pdf'), 'cns');
      expect(component['files'].cns.label()).toBe('cns.pdf');
      expect(component['files'].cns.hasFile()).toBe(true);
      expect(component['hasAttachedFiles']()).toBe(true);
      expect(component['identificationForm'].dirty).toBe(true);
      expect(component['isFormsPristine']()).toBe(false);

      component['onFileSelected'](makeFileEvent('laudo.pdf'), 'deficiency');
      expect(component['personalForm'].dirty).toBe(true);

      component['onFileSelected'](makeFileEvent('residencia.pdf'), 'address');
      expect(component['addressForm'].dirty).toBe(true);

      component['onFileSelected'](makeFileEvent('sigadoc.pdf'), 'sigadoc');
      expect(component['infoForm'].dirty).toBe(true);

      component['onFileSelected']({ target: { files: [] } } as unknown as Event, 'document');
      expect(component['files'].document.hasFile()).toBe(false);
    });

    it('deve baixar arquivo quando archiveId e response.archive existirem', () => {
      component['download'](null, 'arq.pdf');
      expect(storageServiceMock.download).not.toHaveBeenCalled();

      const blob = new Blob(['pdf-bytes']);
      storageServiceMock.download.mockReturnValueOnce(of({ archive: blob }));
      component['download'](77, 'exame.pdf');

      expect(storageServiceMock.download).toHaveBeenCalledWith('tfd', 77);
      expect(saveAs).toHaveBeenCalledWith(blob, 'exame.pdf');

      storageServiceMock.download.mockReturnValueOnce(of({}));
      component['download'](78, 'vazio.pdf');
      expect(saveAs).toHaveBeenCalledTimes(1);
    });
  });

  describe('Envio (onSubmit) e Preenchimento por Retorno', () => {
    it('deve exibir erro quando patient_care.id não existir', async () => {
      await createComponent(null);

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do paciente inválido.'
      );
      expect(patientServiceMock.updatePatient).not.toHaveBeenCalled();
    });

    it('deve marcar formulários como touched e não enviar quando inválido', () => {
      component['personalForm'].controls.name.setValue('');

      component['onSubmit']();

      expect(patientServiceMock.updatePatient).not.toHaveBeenCalled();
      expect(component['personalForm'].controls.name.touched).toBe(true);
      expect(component['isFormInvalidOrPending']).toBe(true);
    });

    it('deve enviar payload, gerenciar isSubmitting, notificar canal e fechar dialog no sucesso', () => {
      const pending$ = new Subject<{ message?: string }>();
      patientServiceMock.updatePatient.mockReturnValueOnce(pending$.asObservable());

      component['onSubmit']();
      expect(component['isSubmitting']()).toBe(true);
      expect(component['personalForm'].disabled).toBe(true);
      expect(patientServiceMock.updatePatient).toHaveBeenCalledWith(
        55,
        expect.objectContaining({
          name: 'Maria Silva',
          birth_date: '1990-05-15',
          sigadoc: 'SIG-2026-1',
        })
      );

      pending$.next({ message: 'Cadastro atualizado!' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['personalForm'].enabled).toBe(true);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Cadastro atualizado!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso e tratar erros com mensagem da API ou fallback', () => {
      patientServiceMock.updatePatient.mockReturnValueOnce(of({}));
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Paciente atualizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);

      patientServiceMock.updatePatient.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'CNS duplicado no servidor.' } }))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('CNS duplicado no servidor.');

      patientServiceMock.updatePatient.mockReturnValueOnce(
        throwError(() => new Error('Erro genérico'))
      );
      component['onSubmit']();
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao atualizar paciente.');
    });

    it('deve preencher campos via callbacks de existência de CNS e documento', () => {
      capturedCnsFoundCallback?.({
        cns: validCns,
        document_type: 'CPF',
        document: validCpf,
        name: 'Paciente Encontrado',
        birth_date: '1988-03-10T00:00:00Z',
        gender: 'Masculino',
        newborn: true,
        race: 'Indígena',
        ethnicity: 'Terena',
        naturalness: 'Cuiabá',
        cep: '78000-000',
        address: 'Rua Nova',
        number: '200',
        neighborhood: 'Centro',
        sigadoc: 'SIG-999',
      } as unknown as Patient);

      expect(component['identificationForm'].controls.cns.value).toBe(validCns);
      expect(component['personalForm'].controls.name.value).toBe('Paciente Encontrado');
      expect(component['personalForm'].controls.birth_date.value?.format('YYYY-MM-DD')).toBe(
        '1988-03-10'
      );
      expect(component['isEthnicityDisabled']()).toBe(false);

      capturedDocFoundCallback?.(null as unknown as Patient);
      expect(component['personalForm'].controls.name.value).toBe('Paciente Encontrado');
    });
  });
});