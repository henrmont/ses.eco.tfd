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
import { finalize } from 'rxjs';

// Material Modules
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services, Models e Interfaces
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestService } from '../../../services/patient-request.service';

interface MedicalProfessional {
  id: number | string;
  name: string;
  patient_medical_requests_count?: number;
  [key: string]: any;
}

@Component({
  selector: 'app-patient-request-process-to-medical',
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
    MatChipsModule
  ],
  templateUrl: './patient-request-process-to-medical.component.html',
  styleUrl: './patient-request-process-to-medical.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestProcessToMedicalComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestProcessToMedicalComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    medical_professional_search: [
      { type: 'required', message: 'A escolha de um profissional médico é obrigatória.' }
    ]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly medicalProfessionalLoading = signal<boolean>(false);
  protected readonly medicalProfessionalReadOnly = signal<boolean>(true);

  private readonly medicalProfessionalOptions = signal<MedicalProfessional[]>([]);

  // ==========================================
  // FormGroups e Signal Controls
  // ==========================================
  protected patientRequestForm!: FormGroup;
  private medicalSearchValue!: Signal<string | MedicalProfessional>;

  // Autocomplete Filtrado Reativo (Computed)
  protected readonly filteredMedicalProfessionalOptions = computed(() => {
    const val = this.medicalSearchValue ? this.medicalSearchValue() : '';
    const query = typeof val === 'string' ? val.toLowerCase().trim() : val?.name?.toLowerCase().trim() || '';
    
    return query
      ? this.medicalProfessionalOptions().filter(opt => opt.name && opt.name.toLowerCase().includes(query)).slice(0, 10)
      : this.medicalProfessionalOptions().slice(0, 10);
  });

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
    this.fetchMedicalProfessionals();
    this.registerCleaners();
  }

  // ==========================================
  // Inicialização de Formulário
  // ==========================================
  private initForm(): void {
    this.patientRequestForm = this.fb.group({
      medical_professional_id: [null, [Validators.required]],
      medical_professional_search: [null, [Validators.required]]
    });

    const medicalCtrl = this.patientRequestForm.get('medical_professional_search')!;
    this.medicalSearchValue = toSignal(medicalCtrl.valueChanges, {
      initialValue: '',
      injector: this.injector
    });
  }

  // ==========================================
  // Handler de Estado de Submissão
  // ==========================================
  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.patientRequestForm.disable({ emitEvent: false });
        } else {
          this.patientRequestForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  private registerCleaners(): void {
    this.patientRequestForm.get('medical_professional_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.patientRequestForm.get('medical_professional_id')?.setValue(null);
          this.patientRequestForm.get('medical_professional_id')?.markAsDirty();
          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // Carregamento de Dados
  // ==========================================
  protected fetchMedicalProfessionals(): void {
    this.medicalProfessionalLoading.set(true);
    this.cdr.markForCheck();

    this.patientRequestService.getMedicalProfessionals()
      .pipe(
        finalize(() => {
          this.medicalProfessionalLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          if (response) {
            this.medicalProfessionalOptions.set(response);
            this.medicalProfessionalReadOnly.set(false);
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.medicalProfessionalReadOnly.set(true);
          this.medicalProfessionalOptions.set([]);
          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // Helpers de Exibição e Seleção
  // ==========================================
  protected displayMedicalProfessional(medicalProfessional: MedicalProfessional): string {
    return medicalProfessional?.name || '';
  }

  protected setMedicalProfessional(option: MedicalProfessional): void {
    if (option?.id) {
      this.patientRequestForm.get('medical_professional_id')?.setValue(option.id);
      this.patientRequestForm.get('medical_professional_id')?.markAsDirty();
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    if (this.patientRequestForm.invalid) {
      this.patientRequestForm.markAllAsTouched();
      return;
    }

    const patientRequestId = this.data?.patient_request?.id;
    if (!patientRequestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    const payload = this.patientRequestForm.getRawValue();

    this.patientRequestService.processPatientRequestToMedical(patientRequestId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          this.messageService.showMessage(response?.message || 'Solicitação encaminhada com sucesso!');
          this.dialogRef.close(true);
        },
        error: err => {
          const fallbackError = 'Erro ao tentar encaminhar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}