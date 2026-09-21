import { ChangeDetectionStrategy, Component, DestroyRef, inject, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

// Material Modules
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services & Models
import { PatientRequestService } from '../../../services/patient-request.service';
import { MessageService } from '../../../../core/services/message-service';

@Component({
  selector: 'app-patient-request-halted',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-halted.component.html',
  styleUrl: './patient-request-halted.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestHaltedComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestHaltedComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Métodos de Ação
  // ==========================================
  protected onSubmit(): void {
    const patientRequestId = this.data?.patient_request?.id;

    if (!patientRequestId) {
      this.messageService.showMessage('Identificador da solicitação inválido.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.patientRequestService.haltedPatientRequest(patientRequestId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.messageService.showMessage(response?.message || 'Solicitação paralisada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar paralisar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}