import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Services
import { MessageService } from '../../../../core/services/message-service';
import { PatientService } from '../../../services/patient.service';

@Component({
  selector: 'app-report-attachment-delete',
  standalone: true,
  imports: [
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './report-attachment-delete.component.html',
  styleUrl: './report-attachment-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportAttachmentDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<ReportAttachmentDeleteComponent>);
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
    const attachmentId = this.data?.report_attachment?.id;

    if (!attachmentId) {
      this.messageService.showMessage('Identificador do anexo não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.patientService.deleteReportAttachment(attachmentId)
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