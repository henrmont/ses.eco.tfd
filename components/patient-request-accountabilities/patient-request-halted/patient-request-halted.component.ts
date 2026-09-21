import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material e Módulos Externos
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

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
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestHaltedComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão / Ações
  // ==========================================
  /**
   * Dispara a requisição para paralisar/sobrestar a solicitação de viagem do paciente.
   */
  protected onSubmit(): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.accountabilityService
      .haltedPatientRequest(requestId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Status de sobrestamento atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro operacional ao atualizar o sobrestamento.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}