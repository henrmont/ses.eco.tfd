import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Services
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestService } from '../../../services/patient-request.service';

@Component({
  selector: 'app-patient-request-attachment-delete',
  standalone: true,
  imports: [
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-attachment-delete.component.html',
  styleUrl: './patient-request-attachment-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAttachmentDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAttachmentDeleteComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const attachmentId = this.data?.patient_request_attachment?.id;

    if (!attachmentId) {
      this.messageService.showMessage('Identificador do anexo não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.patientRequestService.deletePatientRequestAttachment(attachmentId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.messageService.showMessage(response?.message || 'Anexo removido com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar remover o anexo.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}