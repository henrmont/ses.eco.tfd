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
import { saveAs } from 'file-saver';

// Angular Material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';

// Bibliotecas de Terceiros
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';

// Core, Services & Validators
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';
import { ViacepService } from '../../../../core/services/viacep-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';

// Enums & Models
import { Gender } from '../../../enums/gender';
import { Ufs } from '../../../enums/ufs';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
} as const;

type FileType = 'cns' | 'document' | 'address';

interface PersonalForm {
  cns: FormControl<string>;
  file_cns_id: FormControl<number | null>;
  document: FormControl<string>;
  file_document_id: FormControl<number | null>;
  name: FormControl<string>;
  relation: FormControl<string>;
  birth_date: FormControl<unknown>;
  gender: FormControl<string>;
  is_same_address: FormControl<boolean>;
}

interface AddressForm {
  cep: FormControl<string>;
  address: FormControl<string>;
  file_address_id: FormControl<number | null>;
  number: FormControl<string>;
  complement: FormControl<string>;
  neighborhood: FormControl<string>;
  city: FormControl<string>;
  state: FormControl<string>;
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

interface PatientEscortUpdateDialogData {
  patient_care: PatientCare;
  patient_escort: PatientEscort;
}

@Component({
  selector: 'app-patient-escort-update',
  standalone: true,
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatTooltipModule,
    NgxMaskDirective,
    ReactiveFormsModule,
  ],
  providers: [
    provideNgxMask(),
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } },
  ],
  templateUrl: './patient-escort-update.component.html',
  styleUrl: './patient-escort-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientEscortUpdateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientEscortUpdateDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly dateAdapter = inject(DateAdapter<unknown>);
  private readonly viacepService = inject(ViacepService);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly storageService = inject(StorageService);
  private readonly dialogRef = inject(MatDialogRef<PatientEscortUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected personalForm!: FormGroup<PersonalForm>;
  protected addressForm!: FormGroup<AddressForm>;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isSameAddress = signal<boolean>(false);
  protected readonly hasAttachedFiles = signal<boolean>(false);
  protected readonly filteredUfsOptions = signal<string[]>(Object.keys(Ufs));

  // Opções dos Enums Centralizadas
  protected readonly options = {
    genders: Object.values(Gender),
    ufs: Object.keys(Ufs),
  } as const;

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    cns: [
      { type: 'required', message: 'O número do CNS é obrigatório.' },
      { type: 'cnsInvalid', message: 'Número de CNS inválido.' },
      { type: 'cnsPatientExists', message: 'CNS já está vinculado ao paciente.' },
      { type: 'cnsExists', message: 'CNS já está vinculado a um acompanhante.' },
    ],
    document: [
      { type: 'required', message: 'O CPF é obrigatório.' },
      { type: 'cpfInvalid', message: 'Formato de CPF inválido.' },
      { type: 'documentPatientExists', message: 'CPF já está vinculado ao paciente.' },
      { type: 'documentExists', message: 'CPF já está vinculado a um acompanhante.' },
    ],
    name: [
      { type: 'required', message: 'O nome do acompanhante é obrigatório.' },
    ],
    gender: [
      { type: 'required', message: 'Selecione o gênero.' },
    ],
    birth_date: [
      { type: 'required', message: 'A data de nascimento é obrigatória.' },
      { type: 'invalidDate', message: 'Digite uma data válida.' },
      { type: 'futureDate', message: 'A data de nascimento está no futuro.' },
    ],
    is_same_address: [
      { type: 'required', message: 'Informe se reside no mesmo endereço.' },
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

  // Gerenciamento de Anexos/Arquivos com Signals
  protected readonly files: Record<FileType, AttachedFileState> = {
    cns: { file: null, label: signal('Nenhum arquivo selecionado'), hasFile: signal(false) },
    document: { file: null, label: signal('Nenhum arquivo selecionado'), hasFile: signal(false) },
    address: { file: null, label: signal('Nenhum arquivo selecionado'), hasFile: signal(false) },
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForms();
    this.registerAddressDependency();
    this.registerCepListener();
    this.setupAutocompleteFilters();
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected get isFormInvalidOrPending(): boolean {
    return (
      this.personalForm.invalid ||
      this.personalForm.pending ||
      (this.addressForm.invalid && !this.isSameAddress()) ||
      this.addressForm.pending
    );
  }

  protected isFormsPristine(): boolean {
    return this.personalForm.pristine && this.addressForm.pristine && !this.hasAttachedFiles();
  }

  protected onBirthDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.trim();
    const control = this.personalForm.controls.birth_date;

    if (!rawValue) {
      control.setValue(null, { emitEvent: false });
      control.setErrors({ required: true });
      control.markAsTouched();
      return;
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(rawValue)) {
      control.setErrors({ invalidDate: true });
      control.markAsTouched();
      return;
    }

    const [day, month, year] = rawValue.split('/').map(Number);
    const candidate = new Date(year, month - 1, day);
    const isRealCalendarDate =
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day;

    if (!isRealCalendarDate) {
      control.setErrors({ invalidDate: true });
      control.markAsTouched();
      return;
    }

    const parsed = this.dateAdapter.createDate(year, month - 1, day);
    control.setValue(parsed);
    control.updateValueAndValidity();
    this.personalForm.markAsDirty();
  }

  protected setBirthDate(event: MatDatepickerInputEvent<unknown>): void {
    const inputEl = event.targetElement as HTMLInputElement | null;
    const rawValue = inputEl?.value.trim() ?? '';

    if (rawValue && !/^\d{2}\/\d{2}\/\d{4}$/.test(rawValue)) {
      const control = this.personalForm.controls.birth_date;
      control.setErrors({ invalidDate: true });
      control.markAsTouched();
      if (inputEl) {
        inputEl.value = rawValue;
      }
      return;
    }

    if (event.value && this.dateAdapter.isDateInstance(event.value)) {
      const year = this.dateAdapter.getYear(event.value);
      if (year < 1000) {
        const control = this.personalForm.controls.birth_date;
        control.setErrors({ invalidDate: true });
        control.markAsTouched();
        return;
      }

      this.personalForm.controls.birth_date.setValue(event.value);
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
      this.hasAttachedFiles.set(true);

      switch (type) {
        case 'cns':
        case 'document':
          this.personalForm.markAsDirty();
          break;
        case 'address':
          this.addressForm.markAsDirty();
          break;
      }
    }
  }

  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService
      .download('tfd', archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        },
      });
  }

  protected onSubmit(): void {
    const patientCareId = this.data?.patient_care?.id;
    const patientEscortId = this.data?.patient_escort?.id;

    if (!patientCareId || !patientEscortId) {
      this.messageService.showMessage(
        'Identificadores do atendimento ou acompanhante não encontrados.'
      );
      return;
    }

    if (this.isFormInvalidOrPending) {
      this.personalForm.markAllAsTouched();
      if (!this.isSameAddress()) {
        this.addressForm.markAllAsTouched();
      }
      return;
    }

    this.isSubmitting.set(true);
    this.setFormsState(false);

    const rawPersonal = this.personalForm.getRawValue();
    const formattedBirthDate = this.formatDateToIso(rawPersonal.birth_date);

    const payload = {
      ...rawPersonal,
      birth_date: formattedBirthDate,
      ...this.addressForm.getRawValue(),
      file_cns: this.files.cns.file,
      file_document: this.files.document.file,
      file_address: this.files.address.file,
    } as unknown as PatientEscort;

    this.patientService
      .updatePatientEscort(patientCareId, patientEscortId, payload)
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
            response?.message || 'Acompanhante atualizado com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar acompanhante.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForms(): void {
    const patientCare = this.data?.patient_care;
    const patientEscort = this.data?.patient_escort;
    const handleFound = (escort: PatientEscort) => this.populateFromResponse(escort);

    const initialBirthDate = patientEscort?.birth_date
      ? this.parseIsoDate(String(patientEscort.birth_date))
      : null;

    this.personalForm = this.fb.group<PersonalForm>({
      cns: this.fb.control(
        patientEscort?.cns ?? '',
        [Validators.required, CustomValidators.cnsValidator()],
        [
          this.patientService.cnsEscortExistsValidator(
            patientCare,
            patientEscort?.cns ?? null,
            handleFound
          ),
        ]
      ),
      file_cns_id: new FormControl<number | null>(patientEscort?.file_cns_id ?? null),
      document: this.fb.control(
        patientEscort?.document ?? '',
        [Validators.required, CustomValidators.cpfValidator()],
        [
          this.patientService.documentEscortExistsValidator(
            patientCare,
            patientEscort?.document ?? null,
            handleFound
          ),
        ]
      ),
      file_document_id: new FormControl<number | null>(patientEscort?.file_document_id ?? null),
      name: this.fb.control(patientEscort?.name ?? '', [Validators.required]),
      relation: this.fb.control(patientEscort?.relation ?? ''),
      birth_date: new FormControl<unknown>(initialBirthDate, [
        Validators.required,
        CustomValidators.dateValidator(),
        CustomValidators.birthDateValidator(),
      ]),
      gender: this.fb.control(patientEscort?.gender ?? '', [Validators.required]),
      is_same_address: this.fb.control(Boolean(patientEscort?.is_same_address), [
        Validators.required,
      ]),
    });

    this.addressForm = this.fb.group<AddressForm>({
      cep: this.fb.control(patientEscort?.cep ?? '', [
        Validators.required,
        Validators.pattern(/^\d{5}-?\d{3}$/),
      ]),
      address: this.fb.control(patientEscort?.address ?? '', [Validators.required]),
      file_address_id: new FormControl<number | null>(patientEscort?.file_address_id ?? null),
      number: this.fb.control(patientEscort?.number ?? '', [Validators.required]),
      complement: this.fb.control(patientEscort?.complement ?? ''),
      neighborhood: this.fb.control(patientEscort?.neighborhood ?? '', [Validators.required]),
      city: this.fb.control(patientEscort?.city ?? ''),
      state: this.fb.control(patientEscort?.state ?? ''),
    });

    if (patientEscort?.is_same_address) {
      this.isSameAddress.set(true);
      this.addressForm.disable({ emitEvent: false });
    }
  }

  private registerAddressDependency(): void {
    this.personalForm.controls.is_same_address.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isSame) => {
        this.isSameAddress.set(isSame);

        if (isSame) {
          this.addressForm.disable({ emitEvent: false });
          this.applyPatientAddress();
        } else {
          this.addressForm.enable({ emitEvent: false });
          if (this.personalForm.controls.is_same_address.dirty) {
            this.addressForm.reset(undefined, { emitEvent: false });
          }
        }
        this.personalForm.markAsDirty();
      });
  }

  private registerCepListener(): void {
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
    this.addressForm.controls.state.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.filteredUfsOptions.set(this.filterOptions(this.options.ufs, value ?? ''));
      });
  }

  private filterOptions(options: readonly string[], value: string): string[] {
    const filterValue = value.toLowerCase();
    return options.filter((option) => option.toLowerCase().includes(filterValue));
  }

  private applyPatientAddress(): void {
    const patientAddress = this.data?.patient_care?.patient;
    if (!patientAddress) return;

    this.addressForm.patchValue(
      {
        cep: patientAddress.cep || '',
        address: patientAddress.address || '',
        number: patientAddress.number || '',
        complement: patientAddress.complement || '',
        neighborhood: patientAddress.neighborhood || '',
        city: patientAddress.city || '',
        state: patientAddress.state || '',
        file_address_id: patientAddress.file_address_id ?? null,
      },
      { emitEvent: false }
    );
  }

  private populateFromResponse(response: PatientEscort): void {
    if (!response) return;

    const cnsCtrl = this.personalForm.controls.cns;
    const docCtrl = this.personalForm.controls.document;

    if (!cnsCtrl.dirty && response.cns) {
      cnsCtrl.setValue(response.cns, { emitEvent: false });
    }

    if (!docCtrl.dirty && response.document) {
      docCtrl.setValue(response.document, { emitEvent: false });
    }

    const isSame = Boolean(response.is_same_address);
    this.isSameAddress.set(isSame);

    this.personalForm.patchValue(
      {
        name: response.name || '',
        file_cns_id: response.file_cns_id ?? null,
        file_document_id: response.file_document_id ?? null,
        gender: response.gender || '',
        relation: response.relation || '',
        is_same_address: isSame,
      },
      { emitEvent: false }
    );

    if (isSame) {
      this.addressForm.disable({ emitEvent: false });
      this.applyPatientAddress();
    } else {
      this.addressForm.enable({ emitEvent: false });
      this.addressForm.patchValue(
        {
          cep: response.cep || '',
          address: response.address || '',
          file_address_id: response.file_address_id ?? null,
          number: response.number || '',
          complement: response.complement || '',
          neighborhood: response.neighborhood || '',
          city: response.city || '',
          state: response.state || '',
        },
        { emitEvent: false }
      );
    }

    if (response.birth_date) {
      const parsedDate = this.parseIsoDate(String(response.birth_date));
      this.personalForm.controls.birth_date.setValue(parsedDate, { emitEvent: false });
    }

    this.personalForm.markAsDirty();
    this.addressForm.markAsDirty();
  }

  private parseIsoDate(rawDate: string): unknown {
    const cleanDate = rawDate.split(' ')[0].split('T')[0];
    const [year, month, day] = cleanDate.split('-').map(Number);

    if (!year || !month || !day) return null;
    return this.dateAdapter.createDate(year, month - 1, day);
  }

  private formatDateToIso(value: unknown): string | null {
    if (!value) return null;

    if (this.dateAdapter.isDateInstance(value) && this.dateAdapter.isValid(value)) {
      const year = this.dateAdapter.getYear(value);
      const month = String(this.dateAdapter.getMonth(value) + 1).padStart(2, '0');
      const day = String(this.dateAdapter.getDate(value)).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  private setFormsState(enable: boolean): void {
    if (enable) {
      this.personalForm.enable({ emitEvent: false });
      if (this.isSameAddress()) {
        this.addressForm.disable({ emitEvent: false });
      } else {
        this.addressForm.enable({ emitEvent: false });
      }
    } else {
      this.personalForm.disable({ emitEvent: false });
      this.addressForm.disable({ emitEvent: false });
    }
  }
}