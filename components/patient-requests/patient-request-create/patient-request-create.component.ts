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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { Observable, finalize, map, startWith } from 'rxjs';

// Angular Material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services, Models & Validators
import { ApiResponse } from '../../../../core/models/api-response.model';
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
  // Propriedades e Estado Reativo
  // ==========================================
  protected patientRequestForm!: FormGroup;

  protected readonly isScheduling = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly patientLoading = signal<boolean>(false);
  protected readonly patientReadOnly = signal<boolean>(true);

  protected readonly cidLoading = signal<boolean>(false);
  protected readonly cidReadOnly = signal<boolean>(true);

  protected readonly hospitalLoading = signal<boolean>(false);
  protected readonly hospitalReadOnly = signal<boolean>(true);

  protected readonly currentReportFlags = signal<{ lawsuit: boolean; hasEntranceOrLawsuit: boolean } | null>(null);

  // Mensagens de Erro por Controle
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    patient_search: [
      { type: 'required', message: 'A seleção do paciente é obrigatória.' }
    ],
    cid_search: [
      { type: 'required', message: 'A seleção de um CID/Laudo é obrigatória.' }
    ],
    hospital_search: [
      { type: 'required', message: 'A unidade hospitalar é obrigatória.' }
    ],
    type: [
      { type: 'required', message: 'Sem solicitação de entrada aprovada.' }
    ],
    consultation_date: [
      { type: 'required', message: 'A data do agendamento é obrigatória.' },
      { type: 'invalidDate', message: 'Digite uma data válida.' }
    ],
    observation: [
      { type: 'required', message: 'Insira uma observação para a solicitação.' }
    ]
  };

  // Autocomplete e Observables
  private patientOptions: OptionItem[] = [];
  protected filteredPatientOptions!: Observable<OptionItem[]>;

  private cidOptions: OptionItem[] = [];
  protected filteredCidOptions!: Observable<OptionItem[]>;

  private hospitalOptions: OptionItem[] = [];
  protected filteredHospitalOptions!: Observable<OptionItem[]>;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.fetchPatients();
    this.fetchHospitalUnities();
    this.registerCleaners();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
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
      } else {
        this.resetTypeSelection();
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
      this.patientRequestForm.get('consultation_date')?.setValue(event.value, { emitEvent: true });
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

  protected isFormInvalid(): boolean {
    const rawValue = this.patientRequestForm.getRawValue();
    const isTypeMissing = !rawValue.type;
    return this.patientRequestForm.invalid || isTypeMissing || this.patientRequestForm.pending || this.isSubmitting();
  }

  protected onSubmit(): void {
    const rawValue = this.patientRequestForm.getRawValue();

    if (this.patientRequestForm.invalid || !rawValue.type) {
      this.patientRequestForm.markAllAsTouched();
      this.patientRequestForm.get('type')?.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.patientRequestService.createPatientRequest(rawValue)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Solicitação criada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Houve um erro operacional ao criar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    this.patientRequestForm = this.fb.group({
      patient_search: [null, [Validators.required]],
      report_id: [null, [Validators.required]],
      cid_search: [null, [Validators.required]],
      type: [{ value: null, disabled: true }, [Validators.required]],
      consultation_date: [{ value: null, disabled: true }],
      hospital_unity_id: [null, [Validators.required]],
      hospital_search: [null, [Validators.required]],
      observation: [null, [Validators.required]]
    });
  }

  private configurePatientFilter(): void {
    const patientSearchCtrl = this.patientRequestForm.get('patient_search');
    if (patientSearchCtrl) {
      this.filteredPatientOptions = patientSearchCtrl.valueChanges.pipe(
        startWith(''),
        map(value => {
          const term = typeof value === 'string' ? value : value?.name || '';
          return term ? this._filterPatient(term) : this.patientOptions;
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private configureCidFilter(): void {
    const cidSearchCtrl = this.patientRequestForm.get('cid_search');
    if (cidSearchCtrl) {
      this.filteredCidOptions = cidSearchCtrl.valueChanges.pipe(
        startWith(''),
        map(value => {
          const term = typeof value === 'string' ? value : (value?.code ? `${value.code} - ${value.name}` : '');
          return term ? this._filterCid(term) : this.cidOptions.slice(0, 10);
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private configureHospitalFilter(): void {
    const hospitalSearchCtrl = this.patientRequestForm.get('hospital_search');
    if (hospitalSearchCtrl) {
      this.filteredHospitalOptions = hospitalSearchCtrl.valueChanges.pipe(
        startWith(''),
        map(value => {
          const term = typeof value === 'string' ? value : value?.name || '';
          return term ? this._filterHospital(term) : this.hospitalOptions;
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private registerCleaners(): void {
    this.patientRequestForm.get('patient_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('cid_search')?.setValue('');
          this.patientRequestForm.get('report_id')?.setValue(null);
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.cidOptions = [];
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

  private fetchPatients(): void {
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
        next: (response: any[]) => {
          const mapped = (response || [])
            .filter((p: any) => p.status && p.is_valid)
            .map((item: any) => ({
              name: item.patient?.name || '',
              ...item
            }));
          this.patientOptions = mapped;
          this.configurePatientFilter();
          this.patientReadOnly.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.patientReadOnly.set(true);
          this.patientOptions = [];
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
        next: (response: any[]) => {
          const mapped = (response || []).map((item: any) => ({
            ...item.cid,
            ...item
          }));
          this.cidOptions = mapped;
          this.configureCidFilter();
          this.cidReadOnly.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.cidReadOnly.set(true);
          this.cidOptions = [];
          this.cdr.markForCheck();
        }
      });
  }

  private fetchHospitalUnities(): void {
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
          this.hospitalOptions = mapped;
          this.configureHospitalFilter();
          this.hospitalReadOnly.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.hospitalReadOnly.set(true);
          this.hospitalOptions = [];
          this.cdr.markForCheck();
        }
      });
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

          // O tipo permanece disabled/bloqueado via controle
          form.get('type')?.disable({ emitEvent: false });

          if (!this.isScheduling()) {
            form.get('consultation_date')?.disable({ emitEvent: false });
          }
        }

        this.cdr.markForCheck();
      });
  }

  private resetTypeSelection(): void {
    const typeControl = this.patientRequestForm.get('type');
    const dateControl = this.patientRequestForm.get('consultation_date');

    if (typeControl) {
      typeControl.setValue(null);
      typeControl.disable({ emitEvent: false });
      typeControl.markAsUntouched();
    }

    if (dateControl) {
      dateControl.setValue(null);
      dateControl.disable({ emitEvent: false });
      dateControl.clearValidators();
      dateControl.updateValueAndValidity();
    }

    this.isScheduling.set(false);
  }

  private _filterPatient(term: string): OptionItem[] {
    const filterValue = term.toLowerCase();
    return this.patientOptions.filter(option =>
      option.name?.toLowerCase().includes(filterValue)
    );
  }

  private _filterCid(term: string): OptionItem[] {
    const filterValue = term.toLowerCase();
    return this.cidOptions.filter(option =>
      option.name?.toLowerCase().includes(filterValue) ||
      option.code?.toLowerCase().includes(filterValue)
    ).slice(0, 10);
  }

  private _filterHospital(term: string): OptionItem[] {
    const filterValue = term.toLowerCase();
    return this.hospitalOptions.filter(option =>
      option.name?.toLowerCase().includes(filterValue)
    );
  }
}