import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services e Models
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';

@Component({
  selector: 'app-patient-request-move-from-others',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-move-from-others.component.html',
  styleUrl: './patient-request-move-from-others.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestMoveFromOthersComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly opinionService = inject(PatientRequestOpinionService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestMoveFromOthersComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão / Movimentação
  // ==========================================
  /**
   * Dispara a requisição para movimentar a solicitação dentro do contexto de Opinion
   */
  protected onSubmit(): void {
    const requestType = this.data?.type;
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Erro: Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.opinionService.movePatientRequestFromOthers(requestType, requestId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Solicitação movimentada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao tentar movimentar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}