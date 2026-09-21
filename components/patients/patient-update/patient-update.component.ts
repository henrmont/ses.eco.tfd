import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { CommonModule, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  inject,
  signal
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, finalize, map, Observable, startWith } from 'rxjs';
import { saveAs } from 'file-saver';

// Angular Material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
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
import { NgxMaskDirective } from 'ngx-mask';
import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

// Core, Services & Validators
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';
import { ViacepService } from '../../../../core/services/viacep-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';

// Enums & Models
import { Deficiency } from '../../../enums/deficiency';
import { Ethnicity } from '../../../enums/ethnicity';
import { Gender } from '../../../enums/gender';
import { MaritalStatus } from '../../../enums/marital-status';
import { Profession } from '../../../enums/profession';
import { Race } from '../../../enums/race';
import { Ufs } from '../../../enums/ufs';
import { Patient } from '../../../models/patient.model';
import { PatientService } from '../../../services/patient.service';

// Types & Interfaces
export type FileType = 'cns' | 'document' | 'deficiency' | 'address' | 'protocol';

interface NaturalnessOption {
  nome: string;
  [key: string]: unknown;
}

interface AttachedFileState {
  file: File | null;
  label: ReturnType<typeof signal<string>>;
}

@Component({
  selector: 'app-patient-update',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    ReactiveFormsModule
  ],
  templateUrl: './patient-update.component.html',
  styleUrl: './patient-update.component.scss',
  providers: [{ provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } }],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly viacepService = inject(ViacepService);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly storageService = inject(StorageService);
  private readonly dialogRef = inject(MatDialogRef<PatientUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Opções dos Enums Centralizadas no Controle
  // ==========================================
  protected readonly options = {
    races: Object.values(Race),
    deficiencies: Object.values(Deficiency),
    maritalStatuses: Object.values(MaritalStatus),
    genders: Object.values(Gender),
    ethnicities: Object.values(Ethnicity),
    professions: Object.values(Profession),
    ufs: Object.keys(Ufs)
  };

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    cns: [
      { type: 'required', message: 'O número do CNS é obrigatório.' },
      { type: 'cnsInvalid', message: 'Número de CNS inválido.' },
      { type: 'cnsExists', message: 'Este CNS já está cadastrado.' }
    ],
    document_type: [
      { type: 'required', message: 'Selecione o tipo de documento.' }
    ],
    document: [
      { type: 'required', message: 'O documento é obrigatório.' },
      { type: 'cpfInvalid', message: 'Formato de CPF inválido.' },
      { type: 'cnjInvalid', message: 'Formato de CNJ inválido.' },
      { type: 'documentExists', message: 'Este documento já está cadastrado.' }
    ],
    sigadoc: [
      { type: 'required', message: 'O número do SigaDoc é obrigatório.' }
    ],
    name: [
      { type: 'required', message: 'O nome do paciente é obrigatório.' }
    ],
    birth_date: [
      { type: 'required', message: 'A data de nascimento é obrigatória.' },
      { type: 'invalidDate', message: 'Digite uma data válida.' },
      { type: 'futureDate', message: 'A data de nascimento está no futuro.' }
    ],
    gender: [
      { type: 'required', message: 'Selecione o gênero.' }
    ],
    race: [
      { type: 'required', message: 'A raça/cor é obrigatória.' }
    ],
    naturalness: [
      { type: 'required', message: 'A naturalidade é obrigatória.' }
    ],
    cep: [
      { type: 'required', message: 'O CEP é obrigatório.' },
      { type: 'pattern', message: 'Formato de CEP inválido (Ex: 00000-000).' }
    ],
    address: [
      { type: 'required', message: 'O endereço é obrigatório.' }
    ],
    number: [
      { type: 'required', message: 'O número residencial é obrigatório.' }
    ],
    neighborhood: [
      { type: 'required', message: 'O bairro é obrigatório.' }
    ]
  };

  // ==========================================
  // Gerenciamento de Anexos/Arquivos
  // ==========================================
  protected readonly files: Record<FileType, AttachedFileState> = {
    cns: { file: null, label: signal('Nenhum arquivo selecionado') },
    document: { file: null, label: signal('Nenhum arquivo selecionado') },
    deficiency: { file: null, label: signal('Nenhum arquivo selecionado') },
    address: { file: null, label: signal('Nenhum arquivo selecionado') },
    protocol: { file: null, label: signal('Nenhum arquivo selecionado') }
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isEthnicityDisabled = signal<boolean>(true);
  protected readonly naturalnessReadOnly = signal<boolean>(true);
  protected readonly naturalnessLoading = signal<boolean>(false);

  // ==========================================
  // FormGroups e Controles Expostos
  // ==========================================
  protected identificationForm!: FormGroup;
  protected personalForm!: FormGroup;
  protected addressForm!: FormGroup;
  protected infoForm!: FormGroup;

  protected readonly naturalnessControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required]
  });

  // ==========================================
  // Autocomplete e Observables
  // ==========================================
  protected naturalnessOptions: string[] = [];
  protected filteredNaturalnessOptions!: Observable<string[]>;
  protected filteredProfessionsOptions!: Observable<string[]>;
  protected filteredUfsOptions!: Observable<string[]>;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForms();
    this.registerRaceDependency();
    this.setupAutocompleteFilters();
    this.fetchNaturalness();
    this.registerCepListener();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template
  // ==========================================
  protected setBirthDate(event: MatDatepickerInputEvent<any>): void {
    if (event.value) {
      const momentDate = moment(event.value);
      this.personalForm.get('birth_date')?.setValue(momentDate, { emitEvent: true });
      this.personalForm.markAsDirty();
      this.cdr.markForCheck();
    }
  }

  protected onFileSelected(event: Event, type: FileType): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      this.files[type].file = file;
      this.files[type].label.set(file.name);

      switch (type) {
        case 'cns':
        case 'document':
          this.identificationForm.markAsDirty();
          break;
        case 'deficiency':
          this.personalForm.markAsDirty();
          break;
        case 'address':
          this.addressForm.markAsDirty();
          break;
        case 'protocol':
          this.infoForm.markAsDirty();
          break;
      }

      this.cdr.markForCheck();
    }
  }

  protected onNaturalnessSelected(option: string): void {
    this.personalForm.patchValue({ naturalness: option });
    this.personalForm.get('naturalness')?.markAsDirty();
  }

  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd',archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(response => {
        if (response?.archive) {
          saveAs(response.archive, name);
        }
      });
  }

  protected isFormsPristine(): boolean {
    return (
      this.identificationForm.pristine &&
      this.personalForm.pristine &&
      this.addressForm.pristine &&
      this.infoForm.pristine &&
      this.naturalnessControl.pristine
    );
  }

  protected onSubmit(): void {
    const patientCareId = this.data?.patient_care?.id;
    if (!patientCareId) {
      this.messageService.showMessage('Identificador do paciente inválido.');
      return;
    }

    if (
      this.identificationForm.invalid ||
      this.personalForm.invalid ||
      this.addressForm.invalid ||
      this.infoForm.invalid
    ) {
      this.identificationForm.markAllAsTouched();
      this.personalForm.markAllAsTouched();
      this.addressForm.markAllAsTouched();
      this.infoForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const rawPersonal = this.personalForm.getRawValue();
    let formattedBirthDate: string | null = null;

    if (rawPersonal.birth_date) {
      if (moment.isMoment(rawPersonal.birth_date)) {
        formattedBirthDate = rawPersonal.birth_date.format('YYYY-MM-DD');
      } else {
        formattedBirthDate = formatDate(rawPersonal.birth_date, 'yyyy-MM-dd', 'en');
      }
    }

    const payload = {
      ...this.identificationForm.getRawValue(),
      ...rawPersonal,
      birth_date: formattedBirthDate,
      ...this.addressForm.getRawValue(),
      ...this.infoForm.getRawValue(),
      file_cns: this.files.cns.file,
      file_document: this.files.document.file,
      file_deficiency: this.files.deficiency.file,
      file_address: this.files.address.file,
      file_protocol: this.files.protocol.file
    };

    this.patientService.updatePatient(patientCareId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Paciente atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar paciente.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados de Inicialização e Lógica
  // ==========================================
  private initForms(): void {
    const patient = this.data?.patient_care?.patient;

    let initialBirthDate: any = null;
    if (patient?.birth_date) {
      const cleanDate = String(patient.birth_date).split(' ')[0].split('T')[0];
      initialBirthDate = moment(cleanDate, 'YYYY-MM-DD');
    }

    const handleFound = (foundPatient: Patient) => this.populateFromResponse(foundPatient);

    this.identificationForm = this.fb.group({
      cns: [
        patient?.cns ?? null,
        [Validators.required, CustomValidators.cnsValidator()],
        [this.patientService.cnsPatientExistsValidator(patient?.cns ?? null, handleFound)]
      ],
      document_type: [patient?.document_type ?? 'CPF', [Validators.required]],
      document: [
        patient?.document ?? null,
        [Validators.required, CustomValidators.cpfOrCnjValidator()],
        [this.patientService.documentPatientExistsValidator(patient?.document ?? null, handleFound)]
      ],
      sigadoc: [patient?.sigadoc ?? null, [Validators.required]]
    });

    this.personalForm = this.fb.group({
      name: [patient?.name ?? null, [Validators.required]],
      birth_date: [
        initialBirthDate,
        [Validators.required, CustomValidators.dateValidator(), CustomValidators.birthDateValidator()]
      ],
      gender: [patient?.gender ?? null, [Validators.required]],
      newborn: [patient?.newborn ?? false],
      race: [patient?.race ?? null, [Validators.required]],
      ethnicity: [{ value: patient?.ethnicity ?? null, disabled: patient?.race !== 'Indígena' }],
      marital_status: [patient?.marital_status ?? null],
      mother_name: [patient?.mother_name ?? null],
      father_name: [patient?.father_name ?? null],
      naturalness: [patient?.naturalness ?? null, [Validators.required]],
      phone: [patient?.phone ?? null],
      cell_phone: [patient?.cell_phone ?? null],
      email: [patient?.email ?? null],
      profession: [patient?.profession ?? null],
      deficiency: [patient?.deficiency ?? null]
    });

    this.addressForm = this.fb.group({
      cep: [patient?.cep ?? null, [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]],
      address: [patient?.address ?? null, [Validators.required]],
      number: [patient?.number ?? null, [Validators.required]],
      complement: [patient?.complement ?? null],
      neighborhood: [patient?.neighborhood ?? null, [Validators.required]],
      city: [patient?.city ?? null],
      state: [patient?.state ?? null]
    });

    this.infoForm = this.fb.group({
      control_number: [patient?.patient_info?.control_number ?? null],
      observation: [patient?.patient_info?.observation ?? null]
    });
  }

  private registerCepListener(): void {
    this.addressForm.get('cep')?.valueChanges.pipe(
      map(val => (val ? String(val).replace(/\D/g, '') : '')),
      filter(val => val.length === 8),
      debounceTime(400),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(cleanCep => {
      this.viacepService.getAddress(cleanCep)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(response => {
          if (response) {
            this.addressForm.patchValue({
              address: response.logradouro,
              neighborhood: response.bairro,
              city: response.localidade,
              state: response.uf
            });
            this.addressForm.markAsDirty();
            this.cdr.markForCheck();
          }
        });
    });
  }

  private registerRaceDependency(): void {
    const isInitialIndigena = this.data?.patient_care?.patient?.race === 'Indígena';
    this.isEthnicityDisabled.set(!isInitialIndigena);

    this.personalForm.get('race')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedRace: string) => {
        const ethnicityCtrl = this.personalForm.get('ethnicity');
        const isIndigena = selectedRace === 'Indígena';

        this.isEthnicityDisabled.set(!isIndigena);

        if (isIndigena) {
          ethnicityCtrl?.enable();
        } else {
          ethnicityCtrl?.disable();
          ethnicityCtrl?.reset();
        }
        this.cdr.markForCheck();
      });
  }

  private fetchNaturalness(): void {
    this.naturalnessLoading.set(true);

    this.viacepService.getNaturalness()
      .pipe(
        finalize(() => {
          this.naturalnessLoading.set(false);
          this.naturalnessReadOnly.set(false);
          if (this.data?.patient_care?.patient?.naturalness) {
            this.naturalnessControl.setValue(this.data.patient_care.patient.naturalness, { emitEvent: false });
          }
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response: NaturalnessOption[]) => {
        this.naturalnessOptions = (response || []).map(item => item.nome);
        this.setupNaturalnessFilter();
      });
  }

  private setupAutocompleteFilters(): void {
    const professionCtrl = this.personalForm.get('profession');
    if (professionCtrl) {
      this.filteredProfessionsOptions = professionCtrl.valueChanges.pipe(
        startWith(''),
        map(value => this.filterOptions(this.options.professions, value || ''))
      );
    }

    const stateCtrl = this.addressForm.get('state');
    if (stateCtrl) {
      this.filteredUfsOptions = stateCtrl.valueChanges.pipe(
        startWith(''),
        map(value => this.filterOptions(this.options.ufs, value || ''))
      );
    }
  }

  private setupNaturalnessFilter(): void {
    this.filteredNaturalnessOptions = this.naturalnessControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const currentStr = typeof value === 'string' ? value : '';
        return currentStr
          ? this.filterOptions(this.naturalnessOptions, currentStr).slice(0, 10)
          : this.naturalnessOptions.slice(0, 10);
      })
    );
  }

  private filterOptions(options: string[], value: string): string[] {
    const filterValue = value.toLowerCase();
    return options.filter(option => option.toLowerCase().includes(filterValue));
  }

  private populateFromResponse(response: Patient): void {
    if (!response) return;

    const cnsCtrl = this.identificationForm.get('cns');
    const docCtrl = this.identificationForm.get('document');

    if (!cnsCtrl?.dirty && response.cns) {
      cnsCtrl?.setValue(response.cns, { emitEvent: false });
    }

    if (!docCtrl?.dirty && response.document) {
      docCtrl?.setValue(response.document, { emitEvent: false });
    }

    this.identificationForm.patchValue({
      document_type: response.document_type,
      sigadoc: response.sigadoc
    }, { emitEvent: false });

    this.personalForm.patchValue({
      name: response.name,
      gender: response.gender,
      newborn: !!response.newborn,
      race: response.race,
      ethnicity: response.ethnicity,
      marital_status: response.marital_status,
      mother_name: response.mother_name,
      father_name: response.father_name,
      naturalness: response.naturalness,
      phone: response.phone,
      cell_phone: response.cell_phone,
      email: response.email,
      profession: response.profession,
      deficiency: response.deficiency
    }, { emitEvent: false });

    if (response.naturalness) {
      this.naturalnessControl.setValue(response.naturalness, { emitEvent: false });
    }

    this.addressForm.patchValue({
      cep: response.cep,
      address: response.address,
      number: response.number,
      complement: response.complement,
      neighborhood: response.neighborhood,
      city: response.city,
      state: response.state
    }, { emitEvent: false });

    this.infoForm.patchValue({
      control_number: response.patient_info?.control_number ?? null,
      observation: response.patient_info?.observation ?? null
    }, { emitEvent: false });

    const birthDateControl = this.personalForm.get('birth_date');
    if (birthDateControl && response.birth_date) {
      const cleanDateStr = String(response.birth_date).split(' ')[0].split('T')[0];
      const parsedBirthDate = moment(cleanDateStr, 'YYYY-MM-DD');

      birthDateControl.setValue(parsedBirthDate, { emitEvent: false });
      birthDateControl.markAsDirty();
    }

    const isIndigena = response.race === 'Indígena';
    this.isEthnicityDisabled.set(!isIndigena);
    const ethnicityCtrl = this.personalForm.get('ethnicity');

    if (isIndigena) {
      ethnicityCtrl?.enable({ emitEvent: false });
    } else {
      ethnicityCtrl?.disable({ emitEvent: false });
    }

    this.identificationForm.markAsDirty();
    this.personalForm.markAsDirty();
    this.addressForm.markAsDirty();
    this.infoForm.markAsDirty();

    this.cdr.markForCheck();
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        const forms = [
          this.identificationForm,
          this.personalForm,
          this.addressForm,
          this.infoForm
        ];

        forms.forEach(form => {
          if (isSubmitting) {
            form.disable({ emitEvent: false });
          } else {
            form.enable({ emitEvent: false });
          }
        });

        // Garante que o campo de etnia permaneça desabilitado caso a raça não seja Indígena ao reativar os formulários
        if (!isSubmitting && this.personalForm.get('race')?.value !== 'Indígena') {
          this.personalForm.get('ethnicity')?.disable({ emitEvent: false });
        }

        this.cdr.markForCheck();
      });
  }
}