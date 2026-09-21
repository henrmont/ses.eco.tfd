import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { CommonModule } from '@angular/common';
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
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Observable, debounceTime, distinctUntilChanged, filter, finalize, map, startWith } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

// Material Modules
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
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
import { NgxMaskDirective } from 'ngx-mask';

import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { ViacepService } from '../../../../core/services/viacep-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { Gender } from '../../../enums/gender';
import { Ufs } from '../../../enums/ufs';
import { PatientService } from '../../../services/patient.service';

type EscortFileType = 'cns' | 'document' | 'address';

interface AttachedFileState {
  file: File | null;
  label: ReturnType<typeof signal<string>>;
}

@Component({
  selector: 'app-patient-escort-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatStepperModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    NgxMaskDirective,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-escort-create.component.html',
  styleUrl: './patient-escort-create.component.scss',
  providers: [
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientEscortCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly viacepService = inject(ViacepService);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientEscortCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Opções dos Enums Centralizadas no Controle
  // ==========================================
  protected readonly options = {
    genders: Object.values(Gender),
    ufs: Object.keys(Ufs)
  };

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    cns: [
      { type: 'required', message: 'O número do CNS é obrigatório.' },
      { type: 'cnsInvalid', message: 'Número de CNS inválido.' },
      { type: 'cnsPatientExists', message: 'CNS já está vinculado ao paciente.' },
      { type: 'cnsExists', message: 'CNS já está vinculado a um acompanhante.' }
    ],
    document: [
      { type: 'required', message: 'O CPF é obrigatório.' },
      { type: 'cpfInvalid', message: 'Formato de CPF inválido.' },
      { type: 'documentPatientExists', message: 'CPF já está vinculado ao paciente.' },
      { type: 'documentExists', message: 'CPF já está vinculado a um acompanhante.' }
    ],
    name: [
      { type: 'required', message: 'O nome do acompanhante é obrigatório.' }
    ],
    gender: [
      { type: 'required', message: 'Selecione o gênero.' }
    ],
    birth_date: [
      { type: 'required', message: 'A data de nascimento é obrigatória.' },
      { type: 'invalidDate', message: 'Digite uma data válida.' },
      { type: 'futureDate', message: 'A data de nascimento está no futuro.' }
    ],
    is_same_address: [
      { type: 'required', message: 'Informe se reside no mesmo endereço.' }
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
  protected readonly files: Record<EscortFileType, AttachedFileState> = {
    cns: { file: null, label: signal('Nenhum arquivo selecionado') },
    document: { file: null, label: signal('Nenhum arquivo selecionado') },
    address: { file: null, label: signal('Nenhum arquivo selecionado') }
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isSameAddressSignal = signal<boolean>(false);

  // ==========================================
  // FormGroups e Controles Expostos
  // ==========================================
  protected personalForm!: FormGroup;
  protected addressForm!: FormGroup;

  // ==========================================
  // Autocomplete e Observables
  // ==========================================
  protected filteredUfsOptions!: Observable<string[]>;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForms();
    this.registerAddressDependency();
    this.registerCepListener();
    this.setupAutocompleteFilters();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Inicialização de Formulários
  // ==========================================
  private initForms(): void {
    const patientCare = this.data?.patient_care;
    const handleFound = (escort: any) => this.populateFromResponse(escort);

    this.personalForm = this.fb.group({
      cns: [
        null,
        [Validators.required, CustomValidators.cnsValidator()],
        [this.patientService.cnsEscortExistsValidator(patientCare, null, handleFound)]
      ],
      file_cns_id: [null],
      document: [
        null,
        [Validators.required, CustomValidators.cpfValidator()],
        [this.patientService.documentEscortExistsValidator(patientCare, null, handleFound)]
      ],
      file_document_id: [null],
      name: [null, [Validators.required]],
      relation: [null],
      birth_date: [null, [Validators.required, CustomValidators.dateValidator(), CustomValidators.birthDateValidator()]],
      gender: [null, [Validators.required]],
      is_same_address: [false, [Validators.required]]
    });

    this.addressForm = this.fb.group({
      cep: [null, [Validators.required, Validators.pattern(/^\d{5}-?\d{3}$/)]],
      address: [null, [Validators.required]],
      file_address_id: [null],
      number: [null, [Validators.required]],
      complement: [null],
      neighborhood: [null, [Validators.required]],
      city: [null],
      state: [null]
    });
  }

  // ==========================================
  // Listeners Reativos
  // ==========================================
  private registerAddressDependency(): void {
    this.personalForm.get('is_same_address')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isSame: boolean) => {
        this.isSameAddressSignal.set(isSame);

        if (isSame) {
          this.addressForm.disable();
          this.applyPatientAddress();
        } else {
          this.addressForm.enable();
          this.addressForm.reset();
        }
        this.cdr.markForCheck();
      });
  }

  private registerCepListener(): void {
    this.addressForm.get('cep')?.valueChanges
      .pipe(
        map(val => (val ? String(val).replace(/\D/g, '') : '')),
        filter(val => val.length === 8),
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(cleanCep => {
        this.viacepService.getAddress(cleanCep)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: response => {
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
            }
          });
      });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        const forms = [this.personalForm, this.addressForm];

        forms.forEach(form => {
          if (isSubmitting) {
            form.disable({ emitEvent: false });
          } else {
            form.enable({ emitEvent: false });
          }
        });

        // Caso especial: reabilita o formulário de endereço apenas se a opção de mesmo endereço não estiver marcada
        if (!isSubmitting && this.isSameAddressSignal()) {
          this.addressForm.disable({ emitEvent: false });
        }

        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Métodos de Interação
  // ==========================================
  protected setBirthDate(event: MatDatepickerInputEvent<any>): void {
    if (event.value) {
      const momentDate = moment(event.value);
      this.personalForm.get('birth_date')?.setValue(momentDate, { emitEvent: true });
      this.personalForm.markAsDirty();
      this.cdr.markForCheck();
    }
  }

  protected onlyNumbersAndSlashes(event: KeyboardEvent): boolean {
    const charCode = event.key;
    const allowedCharacters = /^[0-9\/]$/;

    if (!allowedCharacters.test(charCode)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  protected onFileSelected(event: Event, type: EscortFileType): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      this.files[type].file = file;
      this.files[type].label.set(file.name);
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // Autocomplete e Filtros Auxiliares
  // ==========================================
  private setupAutocompleteFilters(): void {
    const stateCtrl = this.addressForm.get('state');
    if (stateCtrl) {
      this.filteredUfsOptions = stateCtrl.valueChanges.pipe(
        startWith(''),
        map(value => this.filterOptions(this.options.ufs, value || ''))
      );
    }
  }

  private filterOptions(options: string[], value: string): string[] {
    const filterValue = value.toLowerCase();
    return options.filter(option => option.toLowerCase().includes(filterValue));
  }

  // ==========================================
  // Preenchimento Automático
  // ==========================================
  private applyPatientAddress(): void {
    const patientAddress = this.data?.patient_care?.patient;
    if (!patientAddress) return;

    this.addressForm.patchValue({
      cep: patientAddress.cep,
      address: patientAddress.address,
      number: patientAddress.number,
      complement: patientAddress.complement,
      neighborhood: patientAddress.neighborhood,
      city: patientAddress.city,
      state: patientAddress.state,
      file_address_id: patientAddress.file_address_id
    }, { emitEvent: false });
  }

  private populateFromResponse(response: any): void {
    if (!response) return;

    const cnsCtrl = this.personalForm.get('cns');
    const docCtrl = this.personalForm.get('document');

    if (!cnsCtrl?.dirty && response.cns) {
      cnsCtrl?.setValue(response.cns, { emitEvent: false });
    }

    if (!docCtrl?.dirty && response.document) {
      docCtrl?.setValue(response.document, { emitEvent: false });
    }

    this.personalForm.patchValue({
      name: response.name,
      file_cns_id: response.file_cns_id,
      file_document_id: response.file_document_id,
      gender: response.gender,
      relation: response.relation,
      is_same_address: !!response.is_same_address
    }, { emitEvent: false });

    const isSame = !!response.is_same_address;
    this.isSameAddressSignal.set(isSame);

    if (isSame) {
      this.addressForm.disable();
      this.applyPatientAddress();
    } else {
      this.addressForm.enable();
      this.addressForm.patchValue({
        cep: response.cep,
        address: response.address,
        file_address_id: response.file_address_id,
        number: response.number,
        complement: response.complement,
        neighborhood: response.neighborhood,
        city: response.city,
        state: response.state
      }, { emitEvent: false });
    }

    const birthDateControl = this.personalForm.get('birth_date');
    if (birthDateControl && response.birth_date) {
      const cleanDateStr = String(response.birth_date).split(' ')[0].split('T')[0];
      const parsedBirthDate = moment(cleanDateStr, 'YYYY-MM-DD');

      birthDateControl.setValue(parsedBirthDate, { emitEvent: false });
      birthDateControl.markAsDirty();
    }

    this.personalForm.markAsDirty();
    this.cdr.markForCheck();
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const patientCareId = this.data?.patient_care?.id;
    if (!patientCareId) {
      this.messageService.showMessage('Identificador do atendimento do paciente inválido.');
      return;
    }

    if (this.personalForm.invalid || (this.addressForm.invalid && !this.isSameAddressSignal())) {
      this.personalForm.markAllAsTouched();
      this.addressForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const rawPersonal = this.personalForm.getRawValue();
    const formattedBirthDate = rawPersonal.birth_date
      ? moment(rawPersonal.birth_date).format('YYYY-MM-DD')
      : null;

    const payload = {
      ...rawPersonal,
      birth_date: formattedBirthDate,
      ...this.addressForm.getRawValue(),
      file_cns: this.files.cns.file,
      file_document: this.files.document.file,
      file_address: this.files.address.file
    };

    this.patientService.createPatientEscort(patientCareId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Acompanhante cadastrado com sucesso!');
          this.dialogRef.close(true);
        },
        error: err => {
          const fallbackError = 'Erro ao salvar acompanhante.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}