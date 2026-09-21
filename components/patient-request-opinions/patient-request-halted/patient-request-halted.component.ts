import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services e Models
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';

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
  private readonly opinionService = inject(PatientRequestOpinionService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestHaltedComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão / Sobrestamento
  // ==========================================
  /**
   * Dispara a requisição para paralisar/sobrestar a solicitação do parecerista (médico/social)
   */
  protected onSubmit(): void {
    const requestId = this.data?.patient_request?.id;
    const profileType = this.data?.type;

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação inválido.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.opinionService.haltedPatientRequest(profileType, requestId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.messageService.showMessage(response?.message || 'Status de sobrestamento atualizado!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao tentar atualizar o sobrestamento.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}