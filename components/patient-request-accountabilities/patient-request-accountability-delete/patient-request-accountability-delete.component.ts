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
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type PatientRequestAccountabilityDeleteDialogData = {
  accountability?: PatientRequestAccountability;
};

@Component({
  selector: 'app-patient-request-accountability-delete',
  standalone: true,
  imports: [
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-accountability-delete.component.html',
  styleUrl: './patient-request-accountability-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAccountabilityDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAccountabilityDeleteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAccountabilityDeleteComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Getters / Helpers de Exibição
  // ==========================================
  protected get accountabilityName(): string {
    return this.data?.accountability?.name ?? 'Não informado';
  }

  // ==========================================
  // Métodos de Ação
  // ==========================================
  protected onSubmit(): void {
    const accountabilityId = this.data?.accountability?.id;

    if (!accountabilityId) {
      this.messageService.showMessage('Identificador da prestação de contas não encontrado.');
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.accountabilityService.deleteAccountability(accountabilityId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Prestação de contas removida com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar remover a prestação de contas.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}