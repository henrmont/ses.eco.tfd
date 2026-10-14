import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

// Services, Models & Enums
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
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

export type PatientRequestCostAssistanceCreateDialogData = {
  patient_request?: PatientRequest;
};

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-request-cost-assistance-create',
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
  templateUrl: './patient-request-cost-assistance-create.component.html',
  styleUrl: './patient-request-cost-assistance-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCostAssistanceCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestCostAssistanceCreateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<PatientRequestCostAssistanceCreateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected createCostAssistanceForm!: FormGroup;

  // Signal para guardar o estado de has_initial_cost_assistance vindo da requisição
  protected readonly hasInitialCostAssistance = signal<boolean>(
    !!this.data?.patient_request?.has_initial_cost_assistance
  );

  /**
   * Computed que reavalia automaticamente o tipo sempre que
   * `hasInitialCostAssistance` for modificado.
   */
  protected readonly costAssistanceType = computed(() => {
    return this.hasInitialCostAssistance() ? 'Complemento' : 'Inicial';
  });

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
      const currentType = this.costAssistanceType();

      if (!this.createCostAssistanceForm) return;

      if (submitting) {
        this.createCostAssistanceForm.disable({ emitEvent: false });
      } else {
        this.createCostAssistanceForm.enable({ emitEvent: false });
        // Mantém o campo de tipo sempre sincronizado e desabilitado
        this.createCostAssistanceForm.get('type')?.setValue(currentType, { emitEvent: false });
        this.createCostAssistanceForm.get('type')?.disable({ emitEvent: false });
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
    const requestId = this.data?.patient_request?.id;

    if (this.createCostAssistanceForm.invalid || !requestId) {
      this.createCostAssistanceForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.createCostAssistanceForm.getRawValue();

    this.costAssistanceService.createCostAssistance(requestId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Ajuda de custo criada com sucesso!');
          // Atualiza a flag reativa local para 'true' caso precise refletir a criação de uma Inicial
          this.hasInitialCostAssistance.set(true);
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao criar a ajuda de custo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    this.createCostAssistanceForm = this.fb.group({
      name: [null, [Validators.required]],
      type: [{ value: this.costAssistanceType(), disabled: true }, [Validators.required]],
      passenger_id: [null],
      bank: [null],
      agency: [null],
      account: [null]
    });
  }

  /**
   * Extrai e desduplica a lista de passageiros vinculados às viagens
   * da solicitação do paciente.
   */
  private extractPassengers(): void {
    const travels = this.data?.patient_request?.travels || [];
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