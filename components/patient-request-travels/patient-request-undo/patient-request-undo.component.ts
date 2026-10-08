import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { Professionals } from '../../../enums/professionals';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

export type PatientRequestUndoDialogData = {
  patient_request?: PatientRequest;
};

export interface DestinationOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-patient-request-undo',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-undo.component.html',
  styleUrl: './patient-request-undo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestUndoComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestUndoDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestUndoComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    reason: [
      { type: 'required', message: 'A justificativa do retorno é obrigatória.' }
    ],
    to: [
      { type: 'required', message: 'A definição do setor de destino é obrigatória.' }
    ]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Formulários Reativos
  // ==========================================
  protected readonly undoForm = this.fb.group({
    to: this.fb.control<string>('', { validators: [Validators.required] }),
    reason: this.fb.control<string>('', { validators: [Validators.required] })
  });

  constructor() {
    effect(() => {
      if (this.isSubmitting()) {
        this.undoForm.disable({ emitEvent: false });
      } else {
        this.undoForm.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    // Inicializações adicionais caso necessário
  }

  // ==========================================
  // Computed Properties (Opções de Destino)
  // ==========================================
  protected readonly destinationOptions = computed<DestinationOption[]>(() => {
    const request = this.data?.patient_request;
    if (!request) return [];

    const options: DestinationOption[] = [
      {
        value: 'user',
        label: `${Professionals.CADASTRO} (${request.report?.patient_care?.user?.professional?.name ?? 'Não informado'})`
      },
      {
        value: 'owner',
        label: `${Professionals.ADMINISTRATIVO} (${request.owner_professional?.name ?? 'Não informado'})`
      },
      {
        value: 'social',
        label: `${Professionals.ASSISTENTE_SOCIAL} (${request.social_professional?.name ?? 'Não informado'})`
      },
      {
        value: 'medical',
        label: `${Professionals.MEDICO} (${request.medical_professional?.name ?? 'Não informado'})`
      },
      {
        value: 'cost_assistance',
        label: `${Professionals.AJUDA_DE_CUSTO} (${request.cost_assistance_professional?.name ?? 'Não informado'})`
      }
    ];

    return options;
  });

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    if (this.undoForm.invalid) {
      this.undoForm.markAllAsTouched();
      return;
    }

    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação ou perfil inválido.');
      return;
    }

    this.isSubmitting.set(true);
    const payload = this.undoForm.getRawValue();

    this.travelService.undoPatientRequest(requestId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Solicitação devolvida com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar devolver a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}