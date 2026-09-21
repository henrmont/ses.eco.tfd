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
import { Observable, finalize, map, startWith } from 'rxjs';

// Material Modules
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Core, Models e Enums
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { Specialty } from '../../../enums/specialties';
import { PatientService } from '../../../services/patient.service';

interface SpecialtyOption {
  key: string;
  label: string;
}

interface CidOption {
  id?: number;
  code?: string;
  name?: string;
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
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientReportCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
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

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly cidReadOnly = signal<boolean>(true);
  protected readonly cidLoading = signal<boolean>(false);

  // ==========================================
  // FormGroups
  // ==========================================
  protected reportForm!: FormGroup;

  // ==========================================
  // Autocomplete e Observables
  // ==========================================
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
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Inicialização de Formulário
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

  // ==========================================
  // Autocomplete e Filtros
  // ==========================================
  private setupAutocompleteFilters(): void {
    this.specialtyOptions = Object.entries(Specialty).map(([key, value]) => ({
      key,
      label: value
    }));

    const specialtySearchCtrl = this.reportForm.get('specialty_search');
    if (specialtySearchCtrl) {
      this.filteredSpecialtyOptions = specialtySearchCtrl.valueChanges.pipe(
        startWith(''),
        map(value => {
          const term = typeof value === 'string' ? value : value?.label || '';
          return term ? this._filterSpecialty(term) : this.specialtyOptions.slice(0, 10);
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
        map(value => {
          const term = typeof value === 'string' ? value : (value?.code ? `${value.code} - ${value.name}` : '');
          return term ? this._filterCid(term) : this.cidOptions.slice(0, 10);
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private registerCleaners(): void {
    this.reportForm.get('cid_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.reportForm.get('cid_id')?.setValue(null);
          this.reportForm.get('cid_id')?.markAsDirty();
        }
      });

    this.reportForm.get('specialty_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.reportForm.get('specialty')?.setValue(null);
          this.reportForm.get('specialty')?.markAsDirty();
        }
      });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.reportForm.disable({ emitEvent: false });
        } else {
          this.reportForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  private _filterCid(term: string): CidOption[] {
    const filterValue = term.toLowerCase();
    return this.cidOptions.filter(option =>
      option.name?.toLowerCase().includes(filterValue) ||
      option.code?.toLowerCase().includes(filterValue)
    ).slice(0, 10);
  }

  private _filterSpecialty(label: string): SpecialtyOption[] {
    const filterValue = label.toLowerCase();
    return this.specialtyOptions.filter(option =>
      option.label.toLowerCase().includes(filterValue)
    ).slice(0, 10);
  }

  // ==========================================
  // Carregamento de Dados
  // ==========================================
  private fetchCids(): void {
    const patientCareId = this.data?.patient_care?.id;
    if (!patientCareId) return;

    this.cidLoading.set(true);
    this.cdr.markForCheck();

    this.patientService.getCids(patientCareId)
      .pipe(
        finalize(() => {
          this.cidLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: CidOption[]) => {
          this.cidOptions = response || [];
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

  // ==========================================
  // Helpers de Exibição e Seleção
  // ==========================================
  protected displayCid(cid: CidOption): string {
    return cid && cid.name && cid.code ? `${cid.code} - ${cid.name}` : '';
  }

  protected displaySpecialty(specialty: SpecialtyOption): string {
    return specialty?.label || '';
  }

  protected setCid(cid: CidOption): void {
    this.reportForm.get('cid_id')?.setValue(cid.id);
    this.reportForm.get('cid_id')?.markAsDirty();
  }

  protected setSpecialty(option: SpecialtyOption): void {
    this.reportForm.get('specialty')?.setValue(option.key);
    this.reportForm.get('specialty')?.markAsDirty();
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

    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const rawValue = this.reportForm.getRawValue();
    const payload = {
      protocol: rawValue.protocol,
      specialty: rawValue.specialty,
      cid_id: rawValue.cid_id,
      lawsuit: rawValue.lawsuit,
      diagnosis: rawValue.diagnosis
    };

    this.patientService.createPatientReport(patientCareId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Laudo criado com sucesso!');
          this.dialogRef.close(true);
        },
        error: err => {
          const fallbackError = 'Erro ao salvar o laudo médico.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}