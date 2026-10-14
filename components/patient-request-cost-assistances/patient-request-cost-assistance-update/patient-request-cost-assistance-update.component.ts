import { CommonModule } from '@angular/common';
import { 
  ChangeDetectionStrategy, 
  Component, 
  DestroyRef, 
  OnInit, 
  effect, 
  inject, 
  signal 
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

// Services, Models & Interfaces
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export interface UnifiedPassengerOption {
  id: number;
  name: string;
  isPatient: boolean;
  typeLabel: string;
}

export type PatientRequestCostAssistanceUpdateDialogData = {
  cost_assistance?: PatientRequestCostAssistance;
  patient_request?: PatientRequest;
};

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-request-cost-assistance-update',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './patient-request-cost-assistance-update.component.html',
  styleUrl: './patient-request-cost-assistance-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCostAssistanceUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestCostAssistanceUpdateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<PatientRequestCostAssistanceUpdateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected updateCostAssistanceForm!: FormGroup;

  protected readonly passengersOptions = signal<UnifiedPassengerOption[]>([]);
  protected readonly isSubmitting = signal<boolean>(false);

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    name: [
      { type: 'required', message: 'O nome da ajuda de custo é obrigatório.' }
    ],
    type: [
      { type: 'required', message: 'O tipo da ajuda de custo é obrigatório.' }
    ],
    passenger_id: [],
    bank: [],
    agency: [],
    account: []
  };

  // ==========================================
  // Construtor com Lógica Reativa (Effect)
  // ==========================================
  constructor() {
    effect(() => {
      const submitting = this.isSubmitting();

      if (!this.updateCostAssistanceForm) return;

      if (submitting) {
        this.updateCostAssistanceForm.disable({ emitEvent: false });
      } else {
        this.updateCostAssistanceForm.enable({ emitEvent: false });
        // Mantém o campo de tipo sempre desabilitado
        this.updateCostAssistanceForm.get('type')?.disable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.extractPassengers();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const costAssistanceId = this.data?.cost_assistance?.id;

    if (!costAssistanceId) {
      this.messageService.showMessage('Identificador da ajuda de custo não encontrado.');
      return;
    }

    if (this.updateCostAssistanceForm.invalid) {
      this.updateCostAssistanceForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.updateCostAssistanceForm.getRawValue();

    this.costAssistanceService.updateCostAssistance(costAssistanceId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Ajuda de custo atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao atualizar a ajuda de custo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const costAssistance = this.data?.cost_assistance;

    this.updateCostAssistanceForm = this.fb.group({
      name: [costAssistance?.name ?? null, [Validators.required]],
      type: [{ value: costAssistance?.type ?? null, disabled: true }, [Validators.required]],
      passenger_id: [costAssistance?.passenger_id ?? null],
      bank: [costAssistance?.bank ?? null],
      agency: [costAssistance?.agency ?? null],
      account: [costAssistance?.account ?? null]
    });
  }

  /**
   * Extrai e desduplica a lista de passageiros vinculados às viagens
   * da solicitação do paciente.
   */
  private extractPassengers(): void {
    const travels = this.data?.patient_request?.travels || this.data?.cost_assistance?.patient_request?.travels || [];
    const mapPassengers = new Map<string, UnifiedPassengerOption>();

    for (const travel of travels) {
      const passengers = travel?.passengers || [];

      for (const item of passengers) {
        const isPatient = !!item?.is_patient;
        const entity = isPatient ? (item?.patient || item) : item?.escort;

        if (entity?.id) {
          const mapKey = `${isPatient ? 'patient' : 'escort'}-${entity.id}`;

          if (!mapPassengers.has(mapKey)) {
            mapPassengers.set(mapKey, {
              id: item.id,
              name: entity.name || (entity as any).full_name || `Passageiro ${entity.id}`,
              isPatient,
              typeLabel: isPatient ? 'Paciente' : 'Acompanhante'
            });
          }
        }
      }
    }

    this.passengersOptions.set(Array.from(mapPassengers.values()));
  }
}