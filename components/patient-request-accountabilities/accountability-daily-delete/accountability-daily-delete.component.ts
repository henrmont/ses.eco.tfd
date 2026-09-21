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
  selector: 'app-accountability-daily-delete',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './accountability-daily-delete.component.html',
  styleUrl: './accountability-daily-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountabilityDailyDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<AccountabilityDailyDeleteComponent>);
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
   * Dispara a requisição para remover a diária da prestação de contas.
   */
  protected onSubmit(): void {
    const dailyId = this.data?.accountability_daily?.id;

    if (!dailyId) {
      this.messageService.showMessage('Identificador da diária não encontrado.');
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.accountabilityService
      .deleteAccountabilityDaily(dailyId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Diária removida com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao tentar remover a diária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}