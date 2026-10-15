import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequest } from '../../../models/patient-request.model';

// Services
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

export type PatientRequestMoveFromHistoryDialogData = {
  patient_request?: PatientRequest;
};

@Component({
  selector: 'app-patient-request-move-from-history',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-move-from-history.component.html',
  styleUrl: './patient-request-move-from-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestMoveFromHistoryComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestMoveFromHistoryDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestMoveFromHistoryComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get patientName(): string {
    return this.data?.patient_request?.report?.patient_care?.patient?.name || 'Não informado';
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const patientRequestId = this.data?.patient_request?.id;

    if (!patientRequestId) {
      this.messageService.showMessage('Identificador da solicitação inválido.');
      return;
    }

    this.isSubmitting.set(true);

    this.costAssistanceService.movePatientRequestFromHistory(patientRequestId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Solicitação movimentada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar movimentar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}