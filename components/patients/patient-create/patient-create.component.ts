import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  EMPTY,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  startWith,
  switchMap,
} from 'rxjs';
import moment, { Moment } from 'moment';
import { NgxMaskDirective } from 'ngx-mask';

// Angular Material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';
import { ViacepService } from '../../../../core/services/viacep.service';
import { CustomValidators } from '../../../../core/validators/custom.validator';

// Services, Enums & Models
import { Deficiency } from '../../../enums/deficiency';
import { Ethnicity } from '../../../enums/ethnicity';
import { Gender } from '../../../enums/gender';
import { MaritalStatus } from '../../../enums/marital-status';
import { Profession } from '../../../enums/profession';
import { Race } from '../../../enums/race';
import { Ufs } from '../../../enums/ufs';
import { Patient } from '../../../models/patient.model';
import { PatientService } from '../../../services/patient.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
} as const;

type FileType = 'cns' | 'document' | 'deficiency' | 'address' | 'sigadoc';

interface IdentificationForm {
  cns: FormControl<string>;
  document_type: FormControl<string>;
  document: FormControl<string>;
}

interface PersonalForm {
  name: FormControl<string>;
  birth_date: FormControl<Moment | null>;
  gender: FormControl<string>;
  newborn: FormControl<boolean>;
  race: FormControl<string>;
  ethnicity: FormControl<string>;
  marital_status: FormControl<string>;
  mother_name: FormControl<string>;
  father_name: FormControl<string>;
  naturalness: FormControl<string>;
  phone: FormControl<string>;
  cell_phone: FormControl<string>;
  email: FormControl<string>;
  profession: FormControl<string>;
  deficiency: FormControl<string>;
}

interface AddressForm {
  cep: FormControl<string>;
  address: FormControl<string>;
  number: FormControl<string>;
  complement: FormControl<string>;
  neighborhood: FormControl<string>;
  city: FormControl<string>;
  state: FormControl<string>;
}

interface InfoForm {
  control_number: FormControl<string>;
  sigadoc: FormControl<string>;
  observation: FormControl<string>;
}

interface NaturalnessOption {
  nome: string;
}

interface AttachedFileState {
  file: File | null;
  label: ReturnType<typeof signal<string>>;
  hasFile: ReturnType<typeof signal<boolean>>;
}

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-create',
  standalone: true,
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMomentDateModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatTooltipModule,
    NgxMaskDirective,
    ReactiveFormsModule,
  ],
  providers: [
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } },
  ],
  templateUrl: './patient-create.component.html',
  styleUrl: './patient-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientCreateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly viacepService = inject(ViacepService);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientCreateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected identificationForm!: FormGroup<IdentificationForm>;
  protected personalForm!: FormGroup<PersonalForm>;
  protected addressForm!: FormGroup<AddressForm>;
  protected infoForm!: FormGroup<InfoForm>;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isEthnicityDisabled = signal<boolean>(true);
  protected readonly naturalnessLoading = signal<boolean>(false);

  protected readonly filteredNaturalnessOptions = signal<string[]>([]);
  protected readonly filteredProfessionsOptions = signal<string[]>(Object.values(Profession));
  protected readonly filteredUfsOptions = signal<string[]>(Object.keys(Ufs));

  private naturalnessOptions: string[] = [];

  protected readonly options = {
    races: Object.values(Race),
    deficiencies: Object.values(Deficiency),
    maritalStatuses: Object.values(MaritalStatus),
    genders: Object.values(Gender),
    ethnicities: Object.values(Ethnicity),
    professions: Object.values(Profession),
    ufs: Object.keys(Ufs),
  } as const;

  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    cns: [
      { type: 'required', message: 'O número do CNS é obrigatório.' },
      { type: 'cnsInvalid', message: 'Número de CNS inválido.' },
      { type: 'cnsExists', message: 'Este CNS já está cadastrado.' },
    ],
    document_type: [
      { type: 'required', message: 'Selecione o tipo de documento.' },
    ],
    document: [
      { type: 'required', message: 'O documento é obrigatório.' },
      { type: 'cpfInvalid', message: 'Formato de CPF inválido.' },
      { type: 'cnjInvalid', message: 'Formato de CNJ inválido.' },
      { type: 'documentExists', message: 'Este documento já está cadastrado.' },
    ],
    sigadoc: [
      { type: 'required', message: 'O número do SigaDoc é obrigatório.' },
    ],
    name: [
      { type: 'required', message: 'O nome do paciente é obrigatório.' },
    ],
    birth_date: [
      { type: 'required', message: 'A data de nascimento é obrigatória.' },
      { type: 'invalidDate', message: 'Digite uma data válida.' },
      { type: 'futureDate', message: 'A data de nascimento está no futuro.' },
    ],
    gender: [
      { type: 'required', message: 'Selecione o gênero.' },
    ],
    race: [
      { type: 'required', message: 'A raça/cor é obrigatória.' },
    ],
    naturalness: [
      { type: 'required', message: 'A naturalidade é obrigatória.' },
    ],
    cep: [
      { type: 'required', message: 'O CEP é obrigatório.' },
      { type: 'pattern', message: 'Formato de CEP inválido (Ex: 00000-000).' },
    ],
    address: [
      { type: 'required', message: 'O endereço é obrigatório.' },
    ],
    number: [
      { type: 'required', message: 'O número residencial é obrigatório.' },
    ],
    neighborhood: [
      { type: 'required', message: 'O bairro é obrigatório.' },
    ],
  };

  protected readonly files: Record<FileType, AttachedFileState> = {
    cns: { file: null, label: signal('Nenhum arquivo selecionado'), hasFile: signal(false) },
    document: { file: null, label: signal('Nenhum arquivo selecionado'), hasFile: signal(false) },
    deficiency: { file: null, label: signal('Nenhum arquivo selecionado'), hasFile: signal(false) },
    address: { file: null, label: signal('Nenhum arquivo selecionado'), hasFile: signal(false) },
    sigadoc: { file: null, label: signal('Nenhum arquivo selecionado'), hasFile: signal(false) },
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForms();
    this.setupRaceListener();
    this.setupAutocompleteFilters();
    this.setupCepListener();
    this.fetchNaturalness();
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected get isFormInvalidOrPending(): boolean {
    return (
      this.identificationForm.invalid ||
      this.identificationForm.pending ||
      this.personalForm.invalid ||
      this.personalForm.pending ||
      this.addressForm.invalid ||
      this.addressForm.pending ||
      this.infoForm.invalid ||
      this.infoForm.pending
    );
  }

  protected onBirthDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.trim();
    const control = this.personalForm.controls.birth_date;

    if (!rawValue) {
      control.setValue(null, { emitEvent: false });
      control.updateValueAndValidity();
      return;
    }

    const digitsOnly = rawValue.replace(/\D/g, '');
    if (digitsOnly.length < 8) {
      return;
    }

    const formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
    const parsed = moment(formatted, 'DD/MM/YYYY', true);

    if (!parsed.isValid() || parsed.year() < 1000) {
      control.setErrors({ ...(control.errors ?? {}), invalidDate: true });
      control.markAsTouched();
      return;
    }

    this.clearBirthDateError('invalidDate');
    control.setValue(parsed, { emitEvent: false });
    control.updateValueAndValidity();
    this.personalForm.markAsDirty();
  }

  protected setBirthDate(event: MatDatepickerInputEvent<Moment | null>): void {
    const control = this.personalForm.controls.birth_date;
    const inputEl = event.targetElement as HTMLInputElement | null;
    const rawValue = inputEl?.value.trim() ?? '';

    if (rawValue) {
      const digitsOnly = rawValue.replace(/\D/g, '');
      const formatted =
        digitsOnly.length === 8
          ? `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`
          : rawValue;
      const parsed = moment(formatted, 'DD/MM/YYYY', true);

      if (!parsed.isValid() || parsed.year() < 1000) {
        control.setErrors({ ...(control.errors ?? {}), invalidDate: true });
        control.markAsTouched();
        return;
      }

      this.clearBirthDateError('invalidDate');
      control.setValue(parsed, { emitEvent: false });
      control.updateValueAndValidity();
      this.personalForm.markAsDirty();
      return;
    }

    if (event.value && moment.isMoment(event.value) && event.value.isValid()) {
      if (event.value.year() < 1000) {
        control.setErrors({ ...(control.errors ?? {}), invalidDate: true });
        control.markAsTouched();
        return;
      }

      this.clearBirthDateError('invalidDate');
      control.setValue(event.value, { emitEvent: false });
      control.updateValueAndValidity();
      this.personalForm.markAsDirty();
    }
  }

  protected onlyNumbersAndSlashes(event: KeyboardEvent): boolean {
    const allowedCharacters = /^[0-9/]$/;
    if (!allowedCharacters.test(event.key)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  protected onFileSelected(event: Event, type: FileType): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      this.files[type].file = file;
      this.files[type].label.set(file.name);
      this.files[type].hasFile.set(true);
    }
  }

  protected onNaturalnessSelected(option: string): void {
    this.personalForm.controls.naturalness.setValue(option);
    this.personalForm.controls.naturalness.markAsDirty();
  }

  protected onSubmit(): void {
    if (this.isFormInvalidOrPending) {
      this.identificationForm.markAllAsTouched();
      this.personalForm.markAllAsTouched();
      this.addressForm.markAllAsTouched();
      this.infoForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.setFormsState(false);

    const payload = this.getCreatePayload();

    this.patientService
      .createPatient(payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.setFormsState(true);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.patientsChannel.postMessage('update');
          this.messageService.showMessage(
            response?.message || 'Paciente cadastrado com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao salvar paciente.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private clearBirthDateError(errorKey: string): void {
    const control = this.personalForm.controls.birth_date;
    const currentErrors = control.errors;
    if (!currentErrors || !(errorKey in currentErrors)) {
      return;
    }

    const { [errorKey]: _, ...remainingErrors } = currentErrors;
    control.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
  }

  private getCreatePayload(): Patient {
    const identification = this.identificationForm.getRawValue();
    const personal = this.personalForm.getRawValue();
    const address = this.addressForm.getRawValue();
    const info = this.infoForm.getRawValue();

    const payload: Record<string, unknown> = {
      ...identification,
      ...personal,
      birth_date: this.formatDateToIso(personal.birth_date),
      ...address,
      ...info,
      file_cns: this.files.cns.file,
      file_document: this.files.document.file,
      file_deficiency: this.files.deficiency.file,
      file_address: this.files.address.file,
      file_sigadoc: this.files.sigadoc.file,
    };

    return payload as unknown as Patient;
  }

  private initForms(): void {
    const handleFound = (patient: Patient) => this.populateFromResponse(patient);

    this.identificationForm = this.fb.group<IdentificationForm>({
      cns: this.fb.control(
        '',
        [Validators.required, CustomValidators.cnsValidator()],
        [this.patientService.cnsPatientExistsValidator(null, handleFound)]
      ),
      document_type: this.fb.control('', [Validators.required]),
      document: this.fb.control(
        '',
        [Validators.required, CustomValidators.cpfOrCnjValidator()],
        [this.patientService.documentPatientExistsValidator(null, handleFound)]
      ),
    });

    this.personalForm = this.fb.group<PersonalForm>({
      name: this.fb.control('', [Validators.required]),
      birth_date: new FormControl<Moment | null>(null, [
        Validators.required,
        CustomValidators.dateValidator(),
        CustomValidators.birthDateValidator(),
      ]),
      gender: this.fb.control('', [Validators.required]),
      newborn: this.fb.control(false),
      race: this.fb.control('', [Validators.required]),
      ethnicity: this.fb.control({ value: '', disabled: true }),
      marital_status: this.fb.control(''),
      mother_name: this.fb.control(''),
      father_name: this.fb.control(''),
      naturalness: this.fb.control('', [Validators.required]),
      phone: this.fb.control(''),
      cell_phone: this.fb.control(''),
      email: this.fb.control('', [Validators.email]),
      profession: this.fb.control(''),
      deficiency: this.fb.control(''),
    });

    this.addressForm = this.fb.group<AddressForm>({
      cep: this.fb.control('', [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]),
      address: this.fb.control('', [Validators.required]),
      number: this.fb.control('', [Validators.required]),
      complement: this.fb.control(''),
      neighborhood: this.fb.control('', [Validators.required]),
      city: this.fb.control(''),
      state: this.fb.control(''),
    });

    this.infoForm = this.fb.group<InfoForm>({
      control_number: this.fb.control(''),
      sigadoc: this.fb.control('', [Validators.required]),
      observation: this.fb.control(''),
    });
  }

  private setupRaceListener(): void {
    this.personalForm.controls.race.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedRace) => {
        this.evaluateEthnicityControl(selectedRace);
      });
  }

  private evaluateEthnicityControl(selectedRace: string): void {
    const ethnicityCtrl = this.personalForm.controls.ethnicity;
    const isIndigena = selectedRace === 'Indígena';

    this.isEthnicityDisabled.set(!isIndigena);

    if (isIndigena) {
      ethnicityCtrl.enable({ emitEvent: false });
    } else {
      ethnicityCtrl.disable({ emitEvent: false });
      ethnicityCtrl.reset('', { emitEvent: false });
    }
  }

  private setupCepListener(): void {
    this.addressForm.controls.cep.valueChanges
      .pipe(
        map((val) => (val ? String(val).replace(/\D/g, '') : '')),
        filter((val) => val.length === 8),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((cleanCep) =>
          this.viacepService.getAddress(cleanCep).pipe(catchError(() => EMPTY))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        if (response && !('erro' in response)) {
          this.addressForm.patchValue({
            address: response.logradouro || '',
            neighborhood: response.bairro || '',
            city: response.localidade || '',
            state: response.uf || '',
          });
          this.addressForm.markAsDirty();
        }
      });
  }

  private setupAutocompleteFilters(): void {
    this.personalForm.controls.naturalness.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.filteredNaturalnessOptions.set(
          this.filterOptions(this.naturalnessOptions, value ?? '').slice(0, 10)
        );
      });

    this.personalForm.controls.profession.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.filteredProfessionsOptions.set(
          this.filterOptions(this.options.professions, value ?? '')
        );
      });

    this.addressForm.controls.state.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.filteredUfsOptions.set(this.filterOptions(this.options.ufs, value ?? ''));
      });
  }

  private fetchNaturalness(): void {
    this.naturalnessLoading.set(true);

    this.viacepService
      .getNaturalness()
      .pipe(
        finalize(() => this.naturalnessLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response: NaturalnessOption[]) => {
        this.naturalnessOptions = (response || []).map((item) => item.nome);
        const currentVal = this.personalForm.controls.naturalness.value || '';
        this.filteredNaturalnessOptions.set(
          this.filterOptions(this.naturalnessOptions, currentVal).slice(0, 10)
        );
      });
  }

  private filterOptions(options: readonly string[], value: string): string[] {
    const filterValue = value.toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(filterValue));
  }

  private populateFromResponse(response: Patient): void {
    if (!response) return;

    const cnsCtrl = this.identificationForm.controls.cns;
    const docTypeCtrl = this.identificationForm.controls.document_type;
    const docCtrl = this.identificationForm.controls.document;

    if (!cnsCtrl.dirty && response.cns) {
      cnsCtrl.setValue(response.cns, { emitEvent: false });
    }

    if (!docTypeCtrl.dirty && response.document_type) {
      docTypeCtrl.setValue(response.document_type, { emitEvent: false });
    }

    if (!docCtrl.dirty && response.document) {
      docCtrl.setValue(response.document, { emitEvent: false });
    }

    this.personalForm.patchValue(
      {
        name: response.name || '',
        gender: response.gender || '',
        newborn: Boolean(response.newborn),
        race: response.race || '',
        ethnicity: response.ethnicity || '',
        marital_status: response.marital_status || '',
        mother_name: response.mother_name || '',
        father_name: response.father_name || '',
        naturalness: response.naturalness || '',
        phone: response.phone || '',
        cell_phone: response.cell_phone || '',
        email: response.email || '',
        profession: response.profession || '',
        deficiency: response.deficiency || '',
      },
      { emitEvent: false }
    );

    this.addressForm.patchValue(
      {
        cep: response.cep || '',
        address: response.address || '',
        number: response.number || '',
        complement: response.complement || '',
        neighborhood: response.neighborhood || '',
        city: response.city || '',
        state: response.state || '',
      },
      { emitEvent: false }
    );

    this.infoForm.patchValue(
      {
        sigadoc: response.sigadoc || '',
        control_number: response.patient_info?.control_number || '',
        observation: response.patient_info?.observation || '',
      },
      { emitEvent: false }
    );

    if (response.birth_date) {
      const parsedDate = this.parseIsoDate(String(response.birth_date));
      this.personalForm.controls.birth_date.setValue(parsedDate, { emitEvent: false });
    }

    this.evaluateEthnicityControl(response.race || '');
  }

  private parseIsoDate(rawDate: string): Moment | null {
    const cleanDate = rawDate.split(' ')[0].split('T')[0];
    const parsed = moment(cleanDate, 'YYYY-MM-DD', true);

    return parsed.isValid() ? parsed : null;
  }

  private formatDateToIso(value: unknown): string | null {
    if (!value) return null;

    if (moment.isMoment(value) && value.isValid()) {
      return value.format('YYYY-MM-DD');
    }

    const fallback = moment(value as string);
    return fallback.isValid() ? fallback.format('YYYY-MM-DD') : null;
  }

  private setFormsState(enable: boolean): void {
    const forms = [
      this.identificationForm,
      this.personalForm,
      this.addressForm,
      this.infoForm,
    ];

    for (const form of forms) {
      if (enable) {
        form.enable({ emitEvent: false });
      } else {
        form.disable({ emitEvent: false });
      }
    }

    if (enable) {
      this.evaluateEthnicityControl(this.personalForm.controls.race.value);
    }
  }
}