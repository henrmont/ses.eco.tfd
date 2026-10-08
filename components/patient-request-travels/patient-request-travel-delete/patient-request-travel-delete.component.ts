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
import { PatientRequestTravel } from '../../../models/patient-request-travel.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

export type PatientRequestTravelDeleteDialogData = {
  travel?: PatientRequestTravel;
};

@Component({
  selector: 'app-patient-request-travel-delete',
  standalone: true,
  imports: [
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-travel-delete.component.html',
  styleUrl: './patient-request-travel-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestTravelDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestTravelDeleteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestTravelDeleteComponent>);
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
    const travelId = this.data?.travel?.id;

    if (!travelId) {
      this.messageService.showMessage('Identificador da viagem não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.travelService.deleteTravel(travelId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Viagem removida com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar remover a viagem.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}