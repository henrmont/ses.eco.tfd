import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { AccountabilityDaily } from '../../../models/accountability-daily.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type AccountabilityDailyDeleteDialogData = {
  accountability_daily?: AccountabilityDaily;
};

@Component({
  selector: 'app-accountability-daily-delete',
  standalone: true,
  imports: [
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
  protected readonly data = inject<AccountabilityDailyDeleteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
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
  // Getters / Helpers de Exibição
  // ==========================================
  protected get dailyName(): string {
    return this.data?.accountability_daily?.daily_cost?.name ?? 'Não informado';
  }

  // ==========================================
  // Métodos de Ação
  // ==========================================
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

    this.accountabilityService.deleteAccountabilityDaily(dailyId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Diária removida com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar remover a diária.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}