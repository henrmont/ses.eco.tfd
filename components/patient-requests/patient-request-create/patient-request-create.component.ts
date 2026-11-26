import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize, startWith } from 'rxjs';
import moment, { Moment } from 'moment';

// Angular Material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { HospitalUnity } from '../../../models/hospital-unity.model';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
  autocompleteLimit: 10,
} as const;

export interface PatientCareOption extends PatientCare {
  name: string;
  status?: boolean;
  is_valid?: boolean;
  patient?: {
    name?: string;
  };
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

interface ReportFlags {
  lawsuit: boolean;
  hasEntranceOrLawsuit: boolean;
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
    MatMomentDateModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-request-create.component.html',
  styleUrl: './patient-request-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestCreateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

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

  protected readonly currentReportFlags = signal<ReportFlags | null>(null);

  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    patient_search: [
      { type: 'required', message: 'A seleção do paciente é obrigatória.' },
    ],
    cid_search: [
      { type: 'required', message: 'A seleção de um CID/Laudo é obrigatória.' },
    ],
    hospital_search: [
      { type: 'required', message: 'A unidade hospitalar é obrigatória.' },
    ],
    type: [
      { type: 'required', message: 'Sem solicitação de entrada aprovada.' },
    ],
    consultation_date: [
      { type: 'required', message: 'A data do agendamento é obrigatória.' },
      { type: 'invalidDate', message: 'Digite uma data válida.' },
    ],
    observation: [
      { type: 'required', message: 'Insira uma observação para a solicitação.' },
    ],
  };

  private readonly patientOptions = signal<PatientCareOption[]>([]);
  protected readonly filteredPatientOptions = signal<PatientCareOption[]>([]);

  private readonly cidOptions = signal<OptionItem[]>([]);
  protected readonly filteredCidOptions = signal<OptionItem[]>([]);

  private readonly hospitalOptions = signal<HospitalUnity[]>([]);
  protected readonly filteredHospitalOptions = signal<HospitalUnity[]>([]);

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

  ngOnDestroy(): void {
    this.requestsChannel.close();
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

    const reportIdCtrl = this.patientRequestForm.get('report_id');
    reportIdCtrl?.setValue(report.id);
    reportIdCtrl?.markAsDirty();

    const lawsuit = Boolean(report.lawsuit);
    const hasEntranceOrLawsuit = Boolean(report.has_entrance_or_lawsuit);
    const hasEntranceOrLawsuitFinished = Boolean(report.has_entrance_or_lawsuit_finished);

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
      const hospitalIdCtrl = this.patientRequestForm.get('hospital_unity_id');
      hospitalIdCtrl?.setValue(hospital.id);
      hospitalIdCtrl?.markAsDirty();
    }
  }

  protected setType(value: string): void {
    const isSched = value === 'Agendamento' || value === 'Ação Judicial';
    this.isScheduling.set(isSched);

    const dateControl = this.patientRequestForm.get('consultation_date');
    if (!dateControl) return;

    if (isSched && !this.isSubmitting()) {
      dateControl.enable();
      dateControl.setValidators([Validators.required, CustomValidators.dateValidator()]);
    } else {
      dateControl.disable();
      dateControl.setValue(null);
      dateControl.clearValidators();
    }
    dateControl.updateValueAndValidity();
  }

  protected onConsultationDateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawValue = input.value.trim();
    const control = this.patientRequestForm.get('consultation_date');
    if (!control) return;

    if (!rawValue) {
      control.setValue(null, { emitEvent: false });
      control.updateValueAndValidity();
      return;
    }

    const digitsOnly = rawValue.replace(/\D/g, '');
    if (digitsOnly.length < 8) return;

    const formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
    const parsed = moment(formatted, 'DD/MM/YYYY', true);

    if (!parsed.isValid() || parsed.year() < 1000) {
      control.setErrors({ ...(control.errors ?? {}), invalidDate: true });
      control.markAsTouched();
      return;
    }

    this.clearDateError(control, 'invalidDate');
    control.setValue(parsed, { emitEvent: false });
    control.updateValueAndValidity();
    this.patientRequestForm.markAsDirty();
  }

  protected setConsultationDate(event: MatDatepickerInputEvent<Moment | null>): void {
    const control = this.patientRequestForm.get('consultation_date');
    if (!control) return;

    if (event.value && moment.isMoment(event.value) && event.value.isValid()) {
      if (event.value.year() < 1000) {
        control.setErrors({ ...(control.errors ?? {}), invalidDate: true });
        control.markAsTouched();
        return;
      }

      this.clearDateError(control, 'invalidDate');
      control.setValue(event.value, { emitEvent: true });
      control.markAsDirty();
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

  protected onSubmit(): void {
    const rawValue = this.patientRequestForm.getRawValue() as PatientRequest;

    if (this.patientRequestForm.invalid || !rawValue.type) {
      this.patientRequestForm.markAllAsTouched();
      this.patientRequestForm.get('type')?.markAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.patientRequestForm.disable({ emitEvent: false });

    this.patientRequestService
      .createPatientRequest(rawValue)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.restoreFormStateAfterSubmit();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Solicitação criada com sucesso!');
          this.requestsChannel.postMessage('update');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Houve um erro operacional ao criar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
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
      observation: [null, [Validators.required]],
    });
  }

  private setupAutocompleteFilters(): void {
    const patientCtrl = this.patientRequestForm.get('patient_search');
    if (patientCtrl) {
      patientCtrl.valueChanges
        .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
        .subscribe((value) => {
          const term = typeof value === 'string' ? value : this.displayPatient(value);
          this.filteredPatientOptions.set(this.filterPatient(term));
        });
    }

    const cidCtrl = this.patientRequestForm.get('cid_search');
    if (cidCtrl) {
      cidCtrl.valueChanges
        .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
        .subscribe((value) => {
          const term = typeof value === 'string' ? value : this.displayCid(value);
          this.filteredCidOptions.set(this.filterCid(term));
        });
    }

    const hospitalCtrl = this.patientRequestForm.get('hospital_search');
    if (hospitalCtrl) {
      hospitalCtrl.valueChanges
        .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
        .subscribe((value) => {
          const term = typeof value === 'string' ? value : this.displayHospitalUnity(value);
          this.filteredHospitalOptions.set(this.filterHospital(term));
        });
    }
  }

  private registerCleaners(): void {
    this.patientRequestForm
      .get('patient_search')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.patchValue({
            cid_search: '',
            report_id: null,
          });
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.cidOptions.set([]);
          this.filteredCidOptions.set([]);
          this.setControlDisabled('cid_search', true);
          this.cidReadOnly.set(true);
          this.currentReportFlags.set(null);
          this.resetTypeSelection();
        }
      });

    this.patientRequestForm
      .get('cid_search')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('report_id')?.setValue(null);
          this.patientRequestForm.get('report_id')?.markAsDirty();

          this.currentReportFlags.set(null);
          this.resetTypeSelection();
        }
      });

    this.patientRequestForm
      .get('hospital_search')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('hospital_unity_id')?.setValue(null);
          this.patientRequestForm.get('hospital_unity_id')?.markAsDirty();
        }
      });
  }

  private fetchPatients(): void {
    this.patientLoading.set(true);
    this.setControlDisabled('patient_search', true);

    this.patientRequestService
      .getPatients()
      .pipe(
        finalize(() => {
          this.patientLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientCare[]) => {
          const rawList = (response || []) as PatientCareOption[];
          const mapped = rawList
            .filter((p) => {
              const hasStatusFlag = 'status' in p ? Boolean(p.status) : true;
              const hasValidFlag = 'is_valid' in p ? Boolean(p.is_valid) : true;
              return hasStatusFlag && hasValidFlag;
            })
            .map((item) => ({
              ...item,
              name: item.patient?.name || item.name || '',
            }));

          this.patientOptions.set(mapped);

          const currentValue = this.patientRequestForm.get('patient_search')?.value;
          const term =
            typeof currentValue === 'string'
              ? currentValue
              : this.displayPatient(currentValue);
          this.filteredPatientOptions.set(this.filterPatient(term));

          this.patientReadOnly.set(false);
          this.setControlDisabled('patient_search', false);
        },
        error: () => {
          this.patientReadOnly.set(true);
          this.patientOptions.set([]);
          this.filteredPatientOptions.set([]);
        },
      });
  }

  private fetchCidsByPatient(patientCareId: number): void {
    this.patientRequestForm.patchValue({
      report_id: null,
      cid_search: '',
    });
    this.currentReportFlags.set(null);
    this.resetTypeSelection();

    this.cidLoading.set(true);
    this.setControlDisabled('cid_search', true);

    this.patientRequestService
      .getReports(patientCareId)
      .pipe(
        finalize(() => {
          this.cidLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientReport[]) => {
          const mapped = (response || []).map((item) => ({
            ...item.cid,
            ...item,
          }));

          this.cidOptions.set(mapped);

          const currentValue = this.patientRequestForm.get('cid_search')?.value;
          const term =
            typeof currentValue === 'string' ? currentValue : this.displayCid(currentValue);
          this.filteredCidOptions.set(this.filterCid(term));

          this.cidReadOnly.set(false);
          this.setControlDisabled('cid_search', false);
        },
        error: () => {
          this.cidReadOnly.set(true);
          this.cidOptions.set([]);
          this.filteredCidOptions.set([]);
        },
      });
  }

  private fetchHospitalUnities(): void {
    this.hospitalLoading.set(true);
    this.setControlDisabled('hospital_search', true);

    this.patientRequestService
      .getHospitalUnities()
      .pipe(
        finalize(() => {
          this.hospitalLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: HospitalUnity[]) => {
          const mapped = response || [];
          this.hospitalOptions.set(mapped);

          const currentValue = this.patientRequestForm.get('hospital_search')?.value;
          const term =
            typeof currentValue === 'string'
              ? currentValue
              : this.displayHospitalUnity(currentValue);
          this.filteredHospitalOptions.set(this.filterHospital(term));

          this.hospitalReadOnly.set(false);
          this.setControlDisabled('hospital_search', false);
        },
        error: () => {
          this.hospitalReadOnly.set(true);
          this.hospitalOptions.set([]);
          this.filteredHospitalOptions.set([]);
        },
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

  private restoreFormStateAfterSubmit(): void {
    this.patientRequestForm.enable({ emitEvent: false });
    this.setControlDisabled('patient_search', this.patientReadOnly() || this.patientLoading());
    this.setControlDisabled('cid_search', this.cidReadOnly() || this.cidLoading());
    this.setControlDisabled('hospital_search', this.hospitalReadOnly() || this.hospitalLoading());
    this.patientRequestForm.get('type')?.disable({ emitEvent: false });

    const dateControl = this.patientRequestForm.get('consultation_date');
    if (dateControl && !this.isScheduling()) {
      dateControl.disable({ emitEvent: false });
    }
  }

  private setControlDisabled(controlName: string, disabled: boolean): void {
    const ctrl = this.patientRequestForm.get(controlName);
    if (!ctrl) return;
    if (disabled) {
      ctrl.disable({ emitEvent: false });
    } else {
      ctrl.enable({ emitEvent: false });
    }
  }

  private clearDateError(control: ReturnType<FormGroup['get']>, errorKey: string): void {
    if (!control?.errors || !(errorKey in control.errors)) return;
    const { [errorKey]: _, ...remainingErrors } = control.errors;
    control.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
  }

  private filterPatient(term: string): PatientCareOption[] {
    const filterValue = term.trim().toLowerCase();
    const list = this.patientOptions();
    if (!filterValue) return list.slice(0, COMPONENT_CONFIG.autocompleteLimit);

    return list
      .filter((option) => this.displayPatient(option).toLowerCase().includes(filterValue))
      .slice(0, COMPONENT_CONFIG.autocompleteLimit);
  }

  private filterCid(term: string): OptionItem[] {
    const filterValue = term.trim().toLowerCase();
    const list = this.cidOptions();
    if (!filterValue) return list.slice(0, COMPONENT_CONFIG.autocompleteLimit);

    return list
      .filter(
        (option) =>
          option.name?.toLowerCase().includes(filterValue) ||
          option.code?.toLowerCase().includes(filterValue)
      )
      .slice(0, COMPONENT_CONFIG.autocompleteLimit);
  }

  private filterHospital(term: string): HospitalUnity[] {
    const filterValue = term.trim().toLowerCase();
    const list = this.hospitalOptions();
    if (!filterValue) return list.slice(0, COMPONENT_CONFIG.autocompleteLimit);

    return list
      .filter((option) => this.displayHospitalUnity(option).toLowerCase().includes(filterValue))
      .slice(0, COMPONENT_CONFIG.autocompleteLimit);
  }
}