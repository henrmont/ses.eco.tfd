import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, map, startWith } from 'rxjs';

// Angular Material
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
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
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { HospitalUnity } from '../../../models/hospital-unity.model';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export interface PatientCareOption extends PatientCare {
  name: string;
}

interface OptionItem {
  id?: number;
  name?: string;
  code?: string;
  lawsuit?: boolean;
  has_entrance_or_lawsuit?: boolean;
  has_entrance_or_lawsuit_finished?: boolean;
  [key: string]: unknown;
}

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-request-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-create.component.html',
  styleUrl: './patient-request-create.component.scss',
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<PatientRequestCreateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

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

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
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

  // Listas internas de opções e Observables para os Autocompletes
  private patientOptions: PatientCareOption[] = [];
  protected filteredPatientOptions!: Observable<PatientCareOption[]>;

  private cidOptions: OptionItem[] = [];
  protected filteredCidOptions!: Observable<OptionItem[]>;

  private hospitalOptions: HospitalUnity[] = [];
  protected filteredHospitalOptions!: Observable<HospitalUnity[]>;

  // ==========================================
  // Construtor com a lógica do Effect
  // ==========================================
  constructor() {
    effect(() => {
      const submitting = this.isSubmitting();
      const pLoading = this.patientLoading();
      const cLoading = this.cidLoading();
      const hLoading = this.hospitalLoading();
      const pReadOnly = this.patientReadOnly();
      const cReadOnly = this.cidReadOnly();
      const hReadOnly = this.hospitalReadOnly();
      const scheduling = this.isScheduling();

      if (!this.patientRequestForm) return;

      if (submitting) {
        this.patientRequestForm.disable({ emitEvent: false });
        return;
      }

      // Controle do campo Paciente
      const patientCtrl = this.patientRequestForm.get('patient_search');
      if (pLoading || pReadOnly) {
        patientCtrl?.disable({ emitEvent: false });
      } else {
        patientCtrl?.enable({ emitEvent: false });
      }

      // Controle do campo CID/Laudo
      const cidCtrl = this.patientRequestForm.get('cid_search');
      if (cLoading || cReadOnly) {
        cidCtrl?.disable({ emitEvent: false });
      } else {
        cidCtrl?.enable({ emitEvent: false });
      }

      // Controle do campo Hospital
      const hospitalCtrl = this.patientRequestForm.get('hospital_search');
      if (hLoading || hReadOnly) {
        hospitalCtrl?.disable({ emitEvent: false });
      } else {
        hospitalCtrl?.enable({ emitEvent: false });
      }

      // Campos com fluxo de habilitação condicional
      this.patientRequestForm.get('type')?.disable({ emitEvent: false });

      const dateControl = this.patientRequestForm.get('consultation_date');
      if (!scheduling && dateControl) {
        dateControl.disable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupAutocompleteFilters();
    this.registerCleaners();
    this.fetchPatients();
    this.fetchHospitalUnities();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected displayPatient(patient?: PatientCareOption | null): string {
    return patient?.name ?? '';
  }

  protected displayCid(report?: OptionItem | null): string {
    return report?.code && report?.name ? `${report.code} - ${report.name}` : '';
  }

  protected displayHospitalUnity(hospital?: HospitalUnity | null): string {
    return hospital?.name ?? '';
  }

  protected setPatient(patientCare: PatientCareOption): void {
    if (patientCare?.id) {
      this.fetchCidsByPatient(patientCare.id);
    }
  }

  protected setCid(report: OptionItem): void {
    if (!report?.id) return;

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
  }

  protected setHospitalUnity(hospital: HospitalUnity): void {
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
  }

  protected setConsultationDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const dateCtrl = this.patientRequestForm.get('consultation_date');
      dateCtrl?.setValue(event.value, { emitEvent: true });
      dateCtrl?.markAsDirty();
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

  protected onSubmit(): void {
    const rawValue = this.patientRequestForm.getRawValue();

    if (this.patientRequestForm.invalid || !rawValue.type) {
      this.patientRequestForm.markAllAsTouched();
      this.patientRequestForm.get('type')?.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.patientRequestService.createPatientRequest(rawValue)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
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
      patient_search: [{ value: null, disabled: true }, [Validators.required]],
      report_id: [null, [Validators.required]],
      cid_search: [{ value: null, disabled: true }, [Validators.required]],
      type: [{ value: null, disabled: true }, [Validators.required]],
      consultation_date: [{ value: null, disabled: true }],
      hospital_unity_id: [null, [Validators.required]],
      hospital_search: [{ value: null, disabled: true }, [Validators.required]],
      observation: [null, [Validators.required]]
    });
  }

  private setupAutocompleteFilters(): void {
    const patientCtrl = this.patientRequestForm.get('patient_search');
    if (patientCtrl) {
      this.filteredPatientOptions = patientCtrl.valueChanges.pipe(
        startWith(''),
        map((value) => {
          const term = typeof value === 'string' ? value : this.displayPatient(value);
          return term ? this.filterPatient(term) : this.patientOptions;
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }

    const cidCtrl = this.patientRequestForm.get('cid_search');
    if (cidCtrl) {
      this.filteredCidOptions = cidCtrl.valueChanges.pipe(
        startWith(''),
        map((value) => {
          const term = typeof value === 'string' ? value : (value?.code ? `${value.code} - ${value.name}` : '');
          return term ? this.filterCid(term) : this.cidOptions.slice(0, 10);
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }

    const hospitalCtrl = this.patientRequestForm.get('hospital_search');
    if (hospitalCtrl) {
      this.filteredHospitalOptions = hospitalCtrl.valueChanges.pipe(
        startWith(''),
        map((value) => {
          const term = typeof value === 'string' ? value : this.displayHospitalUnity(value);
          return term ? this.filterHospital(term) : this.hospitalOptions;
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private registerCleaners(): void {
    this.patientRequestForm.get('patient_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.patchValue({
            cid_search: '',
            report_id: null
          });
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.cidOptions = [];
          this.cidReadOnly.set(true);
          this.currentReportFlags.set(null);
          this.resetTypeSelection();
        }
      });

    this.patientRequestForm.get('cid_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('report_id')?.setValue(null);
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.currentReportFlags.set(null);
          this.resetTypeSelection();
        }
      });

    this.patientRequestForm.get('hospital_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('hospital_unity_id')?.setValue(null);
          this.patientRequestForm.get('hospital_unity_id')?.markAsDirty();
        }
      });
  }

  private fetchPatients(): void {
    this.patientLoading.set(true);

    this.patientRequestService.getPatients()
      .pipe(
        finalize(() => {
          this.patientLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientCare[]) => {
          this.patientOptions = (response || [])
            .filter((p: any) => p.status && p.is_valid)
            .map((item: any) => ({
              ...item,
              name: item.patient?.name || item.name || ''
            }));
          this.patientReadOnly.set(false);
          this.patientRequestForm.get('patient_search')?.updateValueAndValidity();
        },
        error: () => {
          this.patientReadOnly.set(true);
          this.patientOptions = [];
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

    this.patientRequestService.getReports(patientCareId)
      .pipe(
        finalize(() => {
          this.cidLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientReport[]) => {
          this.cidOptions = (response || []).map((item) => ({
            ...item.cid,
            ...item
          }));
          this.cidReadOnly.set(false);
          this.patientRequestForm.get('cid_search')?.updateValueAndValidity();
        },
        error: () => {
          this.cidReadOnly.set(true);
          this.cidOptions = [];
        }
      });
  }

  private fetchHospitalUnities(): void {
    this.hospitalLoading.set(true);

    this.patientRequestService.getHospitalUnities()
      .pipe(
        finalize(() => {
          this.hospitalLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: HospitalUnity[]) => {
          this.hospitalOptions = response || [];
          this.hospitalReadOnly.set(false);
          this.patientRequestForm.get('hospital_search')?.updateValueAndValidity();
        },
        error: () => {
          this.hospitalReadOnly.set(true);
          this.hospitalOptions = [];
        }
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

  private filterPatient(term: string): PatientCareOption[] {
    const filterValue = term.toLowerCase();
    return this.patientOptions.filter((option) =>
      this.displayPatient(option).toLowerCase().includes(filterValue)
    );
  }

  private filterCid(term: string): OptionItem[] {
    const filterValue = term.toLowerCase();
    return this.cidOptions.filter((option) =>
      option.name?.toLowerCase().includes(filterValue) ||
      option.code?.toLowerCase().includes(filterValue)
    ).slice(0, 10);
  }

  private filterHospital(term: string): HospitalUnity[] {
    const filterValue = term.toLowerCase();
    return this.hospitalOptions.filter((option) =>
      this.displayHospitalUnity(option).toLowerCase().includes(filterValue)
    );
  }
}