import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize, map, startWith } from 'rxjs';
import { CommonModule } from '@angular/common';

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
import { MessageService } from '../../../../core/services/message-service';
import { Specialty } from '../../../enums/specialties';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientService } from '../../../services/patient.service';

type PatientReportCreateDialogData = {
  patient_care?: PatientCare;
};

interface SpecialtyOption {
  key: string;
  label: string;
}

interface CidOption {
  id?: number;
  code?: string;
  name?: string;
}

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-report-create',
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
    MatSlideToggleModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-report-create.component.html',
  styleUrl: './patient-report-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientReportCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientReportCreateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<PatientReportCreateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected reportForm!: FormGroup;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly cidLoading = signal<boolean>(false);

  private readonly patientCareId = computed(() => this.data?.patient_care?.id ?? null);

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    protocol: [
      { type: 'required', message: 'O número do protocolo é obrigatório.' }
    ],
    specialty_search: [
      { type: 'required', message: 'A seleção da especialidade é obrigatória.' }
    ],
    cid_search: [
      { type: 'required', message: 'A seleção do CID é obrigatória para o laudo.' }
    ],
    diagnosis: [
      { type: 'required', message: 'A descrição do diagnóstico é obrigatória.' }
    ]
  };

  // Autocomplete e Observables
  private cidOptions: CidOption[] = [];
  protected filteredCidOptions!: Observable<CidOption[]>;

  private specialtyOptions: SpecialtyOption[] = [];
  protected filteredSpecialtyOptions!: Observable<SpecialtyOption[]>;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupAutocompleteFilters();
    this.fetchCids();
    this.registerCleaners();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected displayCid(cid?: CidOption | null): string {
    return cid?.code && cid?.name ? `${cid.code} - ${cid.name}` : '';
  }

  protected displaySpecialty(specialty?: SpecialtyOption | null): string {
    return specialty?.label || '';
  }

  protected setCid(cid: CidOption): void {
    this.reportForm.patchValue({ cid_id: cid.id });
    this.reportForm.get('cid_id')?.markAsDirty();
  }

  protected setSpecialty(option: SpecialtyOption): void {
    this.reportForm.patchValue({ specialty: option.key });
    this.reportForm.get('specialty')?.markAsDirty();
  }

  protected onSubmit(): void {
    const careId = this.patientCareId();
    if (!careId) {
      this.messageService.showMessage('Identificador do atendimento do paciente inválido.');
      return;
    }

    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.reportForm.disable({ emitEvent: false });

    const rawValue = this.reportForm.getRawValue();
    const payload = {
      protocol: rawValue.protocol,
      specialty: rawValue.specialty,
      cid_id: rawValue.cid_id,
      lawsuit: rawValue.lawsuit,
      diagnosis: rawValue.diagnosis
    };

    this.patientService.createPatientReport(careId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.reportForm.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Laudo criado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao salvar o laudo médico.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    this.reportForm = this.fb.group({
      protocol: [null, [Validators.required]],
      specialty: [null, [Validators.required]],
      specialty_search: [null, [Validators.required]],
      cid_id: [null, [Validators.required]],
      cid_search: [null, [Validators.required]],
      lawsuit: [false, [Validators.required]],
      diagnosis: [null, [Validators.required]]
    });
  }

  private setupAutocompleteFilters(): void {
    this.specialtyOptions = Object.entries(Specialty).map(([key, value]) => ({
      key,
      label: value
    }));

    const specialtySearchCtrl = this.reportForm.get('specialty_search');
    if (specialtySearchCtrl) {
      this.filteredSpecialtyOptions = specialtySearchCtrl.valueChanges.pipe(
        startWith(''),
        map((value) => {
          const term = typeof value === 'string' ? value : value?.label || '';
          return term ? this.filterSpecialty(term) : this.specialtyOptions.slice(0, 10);
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private configureCidFilter(): void {
    const cidSearchCtrl = this.reportForm.get('cid_search');
    if (cidSearchCtrl) {
      this.filteredCidOptions = cidSearchCtrl.valueChanges.pipe(
        startWith(''),
        map((value) => {
          const term = typeof value === 'string' ? value : (value?.code ? `${value.code} - ${value.name}` : '');
          return term ? this.filterCid(term) : this.cidOptions.slice(0, 10);
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private registerCleaners(): void {
    this.reportForm.get('cid_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.reportForm.patchValue({ cid_id: null });
          this.reportForm.get('cid_id')?.markAsDirty();
        }
      });

    this.reportForm.get('specialty_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (!value || typeof value !== 'object') {
          this.reportForm.patchValue({ specialty: null });
          this.reportForm.get('specialty')?.markAsDirty();
        }
      });
  }

  private fetchCids(): void {
    const careId = this.patientCareId();
    if (!careId) return;

    this.cidLoading.set(true);
    this.reportForm.get('cid_search')?.disable({ emitEvent: false });

    this.patientService.getCids(careId)
      .pipe(
        finalize(() => {
          this.cidLoading.set(false);
          this.reportForm.get('cid_search')?.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: CidOption[]) => {
          this.cidOptions = response || [];
          this.configureCidFilter();
        },
        error: () => {
          this.cidOptions = [];
        }
      });
  }

  private filterCid(term: string): CidOption[] {
    const filterValue = term.toLowerCase();
    return this.cidOptions
      .filter((option) =>
        option.name?.toLowerCase().includes(filterValue) ||
        option.code?.toLowerCase().includes(filterValue)
      )
      .slice(0, 10);
  }

  private filterSpecialty(label: string): SpecialtyOption[] {
    const filterValue = label.toLowerCase();
    return this.specialtyOptions
      .filter((option) => option.label.toLowerCase().includes(filterValue))
      .slice(0, 10);
  }
}