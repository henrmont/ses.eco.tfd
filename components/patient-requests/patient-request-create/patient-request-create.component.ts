import { CommonModule } from '@angular/common';
import { 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  Component, 
  DestroyRef, 
  Injector,
  OnInit, 
  Signal,
  computed, 
  inject, 
  signal 
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { finalize } from 'rxjs';

// Material Modules
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Importação segura do Moment
import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

// Services, Models e Validators
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { PatientRequestService } from '../../../services/patient-request.service';

export interface OptionItem {
  id?: number;
  name?: string;
  code?: string;
  lawsuit?: boolean;
  has_entrance_or_lawsuit?: boolean;
  has_entrance_or_lawsuit_finished?: boolean;
  [key: string]: unknown;
}

@Component({
  selector: 'app-patient-request-create',
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
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatIconModule
  ],
  templateUrl: './patient-request-create.component.html',
  styleUrl: './patient-request-create.component.scss',
  providers: [
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    patient_search: [{ type: 'required', message: 'A seleção do paciente é obrigatória.' }],
    cid_search: [{ type: 'required', message: 'A seleção de um CID/Laudo é obrigatória.' }],
    hospital_search: [{ type: 'required', message: 'A unidade hospitalar é obrigatória.' }],
    type: [{ type: 'required', message: 'Sem solicitação de entrada aprovada.' }],
    consultation_date: [
      { type: 'required', message: 'A data do agendamento é obrigatória.' },
      { type: 'invalidDate', message: 'Digite uma data válida.' }
    ],
    observation: [{ type: 'required', message: 'Insira uma observação para a solicitação.' }]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isScheduling = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly patientLoading = signal<boolean>(false);
  protected readonly patientReadOnly = signal<boolean>(true);

  protected readonly cidLoading = signal<boolean>(false);
  protected readonly cidReadOnly = signal<boolean>(true);

  protected readonly hospitalLoading = signal<boolean>(false);
  protected readonly hospitalReadOnly = signal<boolean>(true);

  protected readonly currentReportFlags = signal<{ lawsuit: boolean; hasEntranceOrLawsuit: boolean } | null>(null);

  // Opções em Signals (Writable)
  private readonly patientOptions = signal<OptionItem[]>([]);
  private readonly cidOptions = signal<OptionItem[]>([]);
  private readonly hospitalOptions = signal<OptionItem[]>([]);

  // ==========================================
  // Formularização e Inputs em Signals
  // ==========================================
  protected patientRequestForm!: FormGroup;

  // Signals (Read-only) conectados aos valores dos controles do formulário
  private patientSearchValue!: Signal<string | OptionItem>;
  private cidSearchValue!: Signal<string | OptionItem>;
  private hospitalSearchValue!: Signal<string | OptionItem>;

  // Listas Filtradas Reativas (Computed Signals)
  protected readonly filteredPatientOptions = computed(() => {
    const val = this.patientSearchValue ? this.patientSearchValue() : '';
    const query = typeof val === 'string' ? val.toLowerCase() : val?.name?.toLowerCase() || '';
    return query 
      ? this.patientOptions().filter(opt => opt.name?.toLowerCase().includes(query)) 
      : this.patientOptions();
  });

  protected readonly filteredCidOptions = computed(() => {
    const val = this.cidSearchValue ? this.cidSearchValue() : '';
    const query = typeof val === 'string' ? val.toLowerCase() : (val?.code ? `${val.code} - ${val.name}`.toLowerCase() : '');
    return query 
      ? this.cidOptions().filter(opt => opt.name?.toLowerCase().includes(query) || opt.code?.toLowerCase().includes(query)).slice(0, 10) 
      : this.cidOptions().slice(0, 10);
  });

  protected readonly filteredHospitalOptions = computed(() => {
    const val = this.hospitalSearchValue ? this.hospitalSearchValue() : '';
    const query = typeof val === 'string' ? val.toLowerCase() : val?.name?.toLowerCase() || '';
    return query 
      ? this.hospitalOptions().filter(opt => opt.name?.toLowerCase().includes(query)) 
      : this.hospitalOptions();
  });

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
    this.fetchPatients();
    this.fetchHospitalUnities();
    this.registerCleaners();
  }

  // ==========================================
  // Inicialização do Formulário e Reatividade
  // ==========================================
  private initForm(): void {
    this.patientRequestForm = this.fb.group({
      patient_search: [null, [Validators.required]],
      report_id: [null, [Validators.required]],
      cid_search: [null, [Validators.required]],
      type: [null, [Validators.required]],
      consultation_date: [{ value: null, disabled: true }],
      hospital_unity_id: [null, [Validators.required]],
      hospital_search: [null, [Validators.required]],
      observation: [null, [Validators.required]]
    });

    // Conexão direta dos controles aos Readonly Signals através do toSignal
    const patientCtrl = this.patientRequestForm.get('patient_search')!;
    const cidCtrl = this.patientRequestForm.get('cid_search')!;
    const hospitalCtrl = this.patientRequestForm.get('hospital_search')!;

    this.patientSearchValue = toSignal(patientCtrl.valueChanges, { initialValue: '', injector: this.injector });
    this.cidSearchValue = toSignal(cidCtrl.valueChanges, { initialValue: '', injector: this.injector });
    this.hospitalSearchValue = toSignal(hospitalCtrl.valueChanges, { initialValue: '', injector: this.injector });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        const form = this.patientRequestForm;

        if (isSubmitting) {
          form.disable({ emitEvent: false });
        } else {
          form.enable({ emitEvent: false });

          // Regra específica para o controle da data do agendamento
          if (!this.isScheduling()) {
            form.get('consultation_date')?.disable({ emitEvent: false });
          }
        }

        this.cdr.markForCheck();
      });
  }

  private registerCleaners(): void {
    this.patientRequestForm.get('patient_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('cid_search')?.setValue('');
          this.patientRequestForm.get('report_id')?.setValue(null);
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.cidOptions.set([]);
          this.cidReadOnly.set(true);
          this.currentReportFlags.set(null);
          this.resetTypeSelection();
          this.cdr.markForCheck();
        }
      });

    this.patientRequestForm.get('cid_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('report_id')?.setValue(null);
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.currentReportFlags.set(null);
          this.resetTypeSelection();
          this.cdr.markForCheck();
        }
      });

    this.patientRequestForm.get('hospital_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('hospital_unity_id')?.setValue(null);
          this.patientRequestForm.get('hospital_unity_id')?.markAsDirty();
        }
      });
  }

  // ==========================================
  // Carregamento de Dados (HTTP)
  // ==========================================
  protected fetchPatients(): void {
    this.patientLoading.set(true);
    this.cdr.markForCheck();

    this.patientRequestService.getPatients()
      .pipe(
        finalize(() => {
          this.patientLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          const mapped = (response || [])
            .filter((p: any) => p.status && p.is_valid)
            .map((item: any) => ({
              name: item.patient?.name || '',
              ...item
            }));
          this.patientOptions.set(mapped);
          this.patientReadOnly.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.patientReadOnly.set(true);
          this.patientOptions.set([]);
          this.cdr.markForCheck();
        }
      });
  }

  private fetchCidsByPatient(patientCareId: number): void {
    this.patientRequestForm.patchValue({
      report_id: null,
      cid_search: ''
    });
    this.currentReportFlags.set(null);
    this.resetTypeSelection();

    this.cidLoading.set(true);
    this.cdr.markForCheck();

    this.patientRequestService.getReports(patientCareId)
      .pipe(
        finalize(() => {
          this.cidLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          const mapped = (response || []).map((item: any) => ({
            ...item.cid,
            ...item
          }));
          this.cidOptions.set(mapped);
          this.cidReadOnly.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.cidReadOnly.set(true);
          this.cidOptions.set([]);
          this.cdr.markForCheck();
        }
      });
  }

  protected fetchHospitalUnities(): void {
    this.hospitalLoading.set(true);
    this.cdr.markForCheck();

    this.patientRequestService.getHospitalUnities()
      .pipe(
        finalize(() => {
          this.hospitalLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any[]) => {
          const mapped: OptionItem[] = (response || []).map(item => ({ ...item }));
          this.hospitalOptions.set(mapped);
          this.hospitalReadOnly.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.hospitalReadOnly.set(true);
          this.hospitalOptions.set([]);
          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // Helpers de Exibição e Atribuição
  // ==========================================
  protected displayPatient(patient: OptionItem): string {
    return patient?.name || '';
  }

  protected displayCid(report: OptionItem): string {
    return report?.code && report?.name ? `${report.code} - ${report.name}` : '';
  }

  protected displayHospitalUnity(hospital: OptionItem): string {
    return hospital?.name || '';
  }

  protected setPatient(patientCare: OptionItem): void {
    if (patientCare?.id) {
      this.fetchCidsByPatient(patientCare.id);
    }
  }

  protected setCid(report: OptionItem): void {
    if (report?.id) {
      this.patientRequestForm.get('report_id')?.setValue(report.id);
      this.patientRequestForm.get('report_id')?.markAsDirty();

      const lawsuit = !!report.lawsuit;
      const hasEntranceOrLawsuit = !!report.has_entrance_or_lawsuit;
      const hasEntranceOrLawsuitFinished = !!report.has_entrance_or_lawsuit_finished;

      this.currentReportFlags.set({ lawsuit, hasEntranceOrLawsuit });

      let autoValue: string | null = null;

      if (hasEntranceOrLawsuitFinished) {
        autoValue = 'Agendamento';
      } else if (!hasEntranceOrLawsuit) {
        autoValue = lawsuit ? 'Ação Judicial' : 'Entrada';
      }

      if (autoValue) {
        const typeCtrl = this.patientRequestForm.get('type');
        typeCtrl?.setValue(autoValue);
        typeCtrl?.markAsDirty();

        this.setType(autoValue);
      }

      this.cdr.markForCheck();
    }
  }

  protected setHospitalUnity(hospital: OptionItem): void {
    if (hospital?.id) {
      this.patientRequestForm.get('hospital_unity_id')?.setValue(hospital.id);
      this.patientRequestForm.get('hospital_unity_id')?.markAsDirty();
    }
  }

  protected setType(value: string): void {
    const isSched = value === 'Agendamento' || value === 'Ação Judicial';
    this.isScheduling.set(isSched);

    const dateControl = this.patientRequestForm.get('consultation_date');
    if (dateControl) {
      if (isSched) {
        dateControl.enable();
        dateControl.setValidators([Validators.required, CustomValidators.dateValidator()]);
      } else {
        dateControl.disable();
        dateControl.setValue(null);
        dateControl.clearValidators();
      }
      dateControl.updateValueAndValidity();
    }
    this.cdr.markForCheck();
  }

  protected setConsultationDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      this.patientRequestForm.get('consultation_date')?.setValue(parsedDate, { emitEvent: true });
      this.patientRequestForm.get('consultation_date')?.markAsDirty();
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

  private resetTypeSelection(): void {
    const typeControl = this.patientRequestForm.get('type');
    const dateControl = this.patientRequestForm.get('consultation_date');

    if (typeControl) {
      typeControl.setValue(null);
      typeControl.markAsUntouched();
    }

    if (dateControl) {
      dateControl.setValue(null);
      dateControl.disable();
      dateControl.clearValidators();
      dateControl.updateValueAndValidity();
    }

    this.isScheduling.set(false);
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    if (this.patientRequestForm.invalid) {
      this.patientRequestForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    const payload = this.patientRequestForm.getRawValue();

    this.patientRequestService.createPatientRequest(payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          this.messageService.showMessage(response?.message || 'Solicitação criada com sucesso!');
          this.dialogRef.close(true);
        },
        error: err => {
          const fallbackError = 'Houve um erro operacional ao criar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}