import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientService } from '../../../services/patient.service';

@Component({
  selector: 'app-patient-archive',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './patient-archive.component.html',
  styleUrl: './patient-archive.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientArchiveComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientArchiveComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão / Ações
  // ==========================================
  protected onSubmit(): void {
    const patientCareId = this.data?.patient_care?.id;
    if (!patientCareId) {
      this.messageService.showMessage('Erro: Identificador do atendimento não encontrado.');
      return;
    }

    this.isSubmitting.set(true);

    this.patientService.archivePatient(patientCareId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Paciente arquivado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao tentar arquivar o paciente.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}