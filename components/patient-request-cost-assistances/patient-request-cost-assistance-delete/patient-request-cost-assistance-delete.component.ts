import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type PatientRequestCostAssistanceDeleteDialogData = {
  cost_assistance?: PatientRequestCostAssistance;
};

@Component({
  selector: 'app-patient-request-cost-assistance-delete',
  standalone: true,
  imports: [
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-cost-assistance-delete.component.html',
  styleUrl: './patient-request-cost-assistance-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCostAssistanceDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestCostAssistanceDeleteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestCostAssistanceDeleteComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Getters / Helpers de Exibição
  // ==========================================
  protected get costAssistanceName(): string {
    return this.data?.cost_assistance?.name ?? 'Não informado';
  }

  // ==========================================
  // Métodos de Ação
  // ==========================================
  protected onSubmit(): void {
    const costAssistanceId = this.data?.cost_assistance?.id;

    if (!costAssistanceId) {
      this.messageService.showMessage('Identificador da ajuda de custo não encontrado.');
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.costAssistanceService.deleteCostAssistance(costAssistanceId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Ajuda de custo removida com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar remover a ajuda de custo.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}