import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services e Models
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

@Component({
  selector: 'app-patient-request-archive',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-archive.component.html',
  styleUrl: './patient-request-archive.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestArchiveComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestArchiveComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão / Arquivamento
  // ==========================================
  protected onSubmit(): void {
    const patientRequestId = this.data?.patient_request?.id;

    if (!patientRequestId) {
      this.messageService.showMessage('Erro: Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.travelService.archivePatientRequest(patientRequestId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Solicitação arquivada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar arquivar a solicitação.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}