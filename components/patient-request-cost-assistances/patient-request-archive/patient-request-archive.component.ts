import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

@Component({
  selector: 'app-patient-request-archive',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './patient-request-archive.component.html',
  styleUrl: './patient-request-archive.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush // ⚡ Performance máxima com OnPush + Signals
})
export class PatientRequestArchiveComponent {
  // Injeções de Dependência modernas via inject()
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestArchiveComponent>);

  // Estado de submissão reativo
  protected readonly isSubmitting = signal<boolean>(false);

  /**
   * Dispara a requisição para arquivar a solicitação
   */
  protected onSubmit(): void {
    const patientRequestId = this.data?.patient_request?.id;

    if (!patientRequestId) {
      this.messageService.showMessage('Erro: Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);

    this.costAssistanceService.archivePatientRequest(patientRequestId).subscribe({
      next: (response: any) => {
        this.messageService.showMessage(response.message || 'Solicitação arquivada com sucesso!');
        this.dialogRef.close(true); // Retorna true para atualizar a grid/listagem pai
      },
      error: (err) => {
        const errorMessage = err?.error?.message || 'Ocorreu um erro ao tentar arquivar a solicitação.';
        this.messageService.showMessage(errorMessage);
        this.isSubmitting.set(false); // Reseta o estado em caso de erro para nova tentativa
      },
    });
  }
}