import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
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
import { finalize, startWith } from 'rxjs';

// Angular Material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';
import { Specialty } from '../../../enums/specialties';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientService } from '../../../services/patient.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
  maxAutocompleteOptions: 10,
} as const;

export interface PatientReportUpdateDialogData {
  patient_care?: PatientCare;
  patient_report?: PatientReport;
}

interface SpecialtyOption {
  key: string;
  label: string;
}

interface CidOption {
  id?: number;
  code?: string;
  name?: string;
}

interface ReportForm {
  protocol: FormControl<string>;
  specialty: FormControl<string | null>;
  specialty_search: FormControl<string | SpecialtyOption | null>;
  cid_id: FormControl<number | null>;
  cid_search: FormControl<string | CidOption | null>;
  lawsuit: FormControl<boolean>;
  diagnosis: FormControl<string>;
}

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-report-update',
  standalone: true,
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
  ],
  templateUrl: './patient-report-update.component.html',
  styleUrl: './patient-report-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientReportUpdateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientReportUpdateDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientReportUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected reportForm!: FormGroup<ReportForm>;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly cidLoading = signal<boolean>(false);

  protected readonly filteredCidOptions = signal<CidOption[]>([]);
  protected readonly filteredSpecialtyOptions = signal<SpecialtyOption[]>([]);

  private readonly patientCareId = computed(() => this.data?.patient_care?.id ?? null);
  private readonly patientReportId = computed(() => this.data?.patient_report?.id ?? null);

  private cidOptions: CidOption[] = [];
  private readonly specialtyOptions: SpecialtyOption[] = Object.entries(Specialty).map(
    ([key, value]) => ({
      key,
      label: value,
    })
  );

  // Mapeamento de Mensagens de Erro
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    protocol: [
      { type: 'required', message: 'O número do protocolo é obrigatório.' },
    ],
    specialty_search: [
      { type: 'required', message: 'A seleção da especialidade é obrigatória.' },
      { type: 'invalidSelection', message: 'Selecione uma especialidade válida da lista.' },
    ],
    cid_search: [
      { type: 'required', message: 'A seleção do CID é obrigatória para o laudo.' },
      { type: 'invalidSelection', message: 'Selecione um CID válido da lista.' },
    ],
    diagnosis: [
      { type: 'required', message: 'A descrição do diagnóstico é obrigatória.' },
    ],
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupAutocompleteFilters();
    this.registerCleaners();
    this.populateForm();
    this.fetchCidsAndPopulate();
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get isFormInvalidOrPending(): boolean {
    return this.reportForm.invalid || this.reportForm.pending;
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected isFormPristine(): boolean {
    return this.reportForm.pristine;
  }

  protected readonly displayCid = (cid?: CidOption | string | null): string => {
    if (!cid) return '';
    if (typeof cid === 'string') return cid;
    return this.formatCidLabel(cid);
  };

  protected readonly displaySpecialty = (specialty?: SpecialtyOption | string | null): string => {
    if (!specialty) return '';
    if (typeof specialty === 'string') return specialty;
    return specialty.label || '';
  };

  protected onCidSelected(cid: CidOption): void {
    this.reportForm.controls.cid_id.setValue(cid.id ?? null);
    this.reportForm.controls.cid_id.markAsDirty();
    this.clearControlError(this.reportForm.controls.cid_search, 'invalidSelection');
  }

  protected onSpecialtySelected(option: SpecialtyOption): void {
    this.reportForm.controls.specialty.setValue(option.key);
    this.reportForm.controls.specialty.markAsDirty();
    this.clearControlError(this.reportForm.controls.specialty_search, 'invalidSelection');
  }

  protected onSubmit(): void {
    const careId = this.patientCareId();
    const reportId = this.patientReportId();

    if (!careId || !reportId) {
      this.messageService.showMessage('Identificadores do atendimento ou laudo inválidos.');
      return;
    }

    if (this.isFormInvalidOrPending) {
      this.reportForm.markAllAsTouched();
      return;
    }

    const rawValue = this.reportForm.getRawValue();
    if (!rawValue.specialty || rawValue.cid_id == null) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.reportForm.disable({ emitEvent: false });

    const payload = this.getUpdatePayload();

    this.patientService
      .updatePatientReport(careId, reportId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.reportForm.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.patientsChannel.postMessage('update');
          this.messageService.showMessage(response?.message || 'Laudo atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar o laudo médico.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    this.reportForm = this.fb.group<ReportForm>({
      protocol: this.fb.control('', [Validators.required]),
      specialty: new FormControl<string | null>(null, [Validators.required]),
      specialty_search: new FormControl<string | SpecialtyOption | null>(null, [
        Validators.required,
      ]),
      cid_id: new FormControl<number | null>(null, [Validators.required]),
      cid_search: new FormControl<string | CidOption | null>(null, [Validators.required]),
      lawsuit: this.fb.control(false, [Validators.required]),
      diagnosis: this.fb.control('', [Validators.required]),
    });
  }

  private getUpdatePayload(): PatientReport {
    const rawValue = this.reportForm.getRawValue();

    return {
      protocol: rawValue.protocol.trim(),
      specialty: rawValue.specialty,
      cid_id: rawValue.cid_id,
      lawsuit: rawValue.lawsuit,
      diagnosis: rawValue.diagnosis.trim(),
    } as PatientReport;
  }

  private setupAutocompleteFilters(): void {
    this.reportForm.controls.specialty_search.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const term = this.extractSpecialtyTerm(value);
        this.filteredSpecialtyOptions.set(
          term
            ? this.filterSpecialty(term)
            : this.specialtyOptions.slice(0, COMPONENT_CONFIG.maxAutocompleteOptions)
        );
      });

    this.reportForm.controls.cid_search.valueChanges
      .pipe(startWith(''), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const term = this.extractCidTerm(value);
        this.filteredCidOptions.set(
          term
            ? this.filterCid(term)
            : this.cidOptions.slice(0, COMPONENT_CONFIG.maxAutocompleteOptions)
        );
      });
  }

  private registerCleaners(): void {
    this.reportForm.controls.cid_search.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.reportForm.controls.cid_id.setValue(null, { emitEvent: false });
          this.clearControlError(this.reportForm.controls.cid_search, 'invalidSelection');

          if (typeof value === 'string' && value.trim().length > 0) {
            this.reportForm.controls.cid_search.setErrors({
              ...(this.reportForm.controls.cid_search.errors ?? {}),
              invalidSelection: true,
            });
          }
        }
      });

    this.reportForm.controls.specialty_search.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.reportForm.controls.specialty.setValue(null, { emitEvent: false });
          this.clearControlError(this.reportForm.controls.specialty_search, 'invalidSelection');

          if (typeof value === 'string' && value.trim().length > 0) {
            this.reportForm.controls.specialty_search.setErrors({
              ...(this.reportForm.controls.specialty_search.errors ?? {}),
              invalidSelection: true,
            });
          }
        }
      });
  }

  private fetchCidsAndPopulate(): void {
    const careId = this.patientCareId();
    if (!careId) return;

    this.cidLoading.set(true);
    this.reportForm.controls.cid_search.disable({ emitEvent: false });

    this.patientService
      .getCids(careId)
      .pipe(
        finalize(() => {
          this.cidLoading.set(false);
          this.reportForm.controls.cid_search.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: CidOption[]) => {
          this.cidOptions = response || [];
          this.syncCidSelection();
        },
        error: () => {
          this.cidOptions = [];
          this.filteredCidOptions.set([]);
        },
      });
  }

  private populateForm(): void {
    const report = this.data?.patient_report;
    if (!report) return;

    const matchedSpecialty =
      this.specialtyOptions.find((opt) => opt.key === report.specialty) ?? null;

    this.reportForm.patchValue(
      {
        protocol: report.protocol ?? '',
        specialty: report.specialty ?? null,
        specialty_search: matchedSpecialty,
        cid_id: report.cid_id ?? report.cid?.id ?? null,
        cid_search: report.cid ?? null,
        lawsuit: Boolean(report.lawsuit),
        diagnosis: report.diagnosis ?? '',
      },
      { emitEvent: false }
    );

    const specialtyTerm = this.extractSpecialtyTerm(matchedSpecialty);
    this.filteredSpecialtyOptions.set(
      specialtyTerm
        ? this.filterSpecialty(specialtyTerm)
        : this.specialtyOptions.slice(0, COMPONENT_CONFIG.maxAutocompleteOptions)
    );
  }

  private syncCidSelection(): void {
    const report = this.data?.patient_report;
    if (!report) {
      this.filteredCidOptions.set(
        this.cidOptions.slice(0, COMPONENT_CONFIG.maxAutocompleteOptions)
      );
      return;
    }

    const currentCidId = this.reportForm.controls.cid_id.value ?? report.cid_id ?? report.cid?.id;
    const matchedCid =
      this.cidOptions.find((opt) => opt.id === currentCidId) ?? report.cid ?? null;

    if (!this.reportForm.controls.cid_search.dirty) {
      this.reportForm.patchValue(
        {
          cid_id: matchedCid?.id ?? currentCidId ?? null,
          cid_search: matchedCid,
        },
        { emitEvent: false }
      );
    }

    const cidTerm = this.extractCidTerm(matchedCid);
    this.filteredCidOptions.set(
      cidTerm
        ? this.filterCid(cidTerm)
        : this.cidOptions.slice(0, COMPONENT_CONFIG.maxAutocompleteOptions)
    );
  }

  private formatCidLabel(cid: CidOption): string {
    if (cid.code && cid.name) return `${cid.code} - ${cid.name}`;
    return cid.code || cid.name || '';
  }

  private extractCidTerm(value: string | CidOption | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return this.formatCidLabel(value);
  }

  private extractSpecialtyTerm(value: string | SpecialtyOption | null): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.label || '';
  }

  private clearControlError(control: FormControl, errorKey: string): void {
    if (!control.errors || !(errorKey in control.errors)) {
      return;
    }

    const { [errorKey]: _, ...remainingErrors } = control.errors;
    control.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
  }

  private filterCid(term: string): CidOption[] {
    const filterValue = term.toLowerCase();
    return this.cidOptions
      .filter(
        (option) =>
          option.name?.toLowerCase().includes(filterValue) ||
          option.code?.toLowerCase().includes(filterValue)
      )
      .slice(0, COMPONENT_CONFIG.maxAutocompleteOptions);
  }

  private filterSpecialty(label: string): SpecialtyOption[] {
    const filterValue = label.toLowerCase();
    return this.specialtyOptions
      .filter((option) => option.label.toLowerCase().includes(filterValue))
      .slice(0, COMPONENT_CONFIG.maxAutocompleteOptions);
  }
}