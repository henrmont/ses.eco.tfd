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
import { TravelPassenger } from '../../../models/travel-passenger.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

export type TravelPassengerDeleteDialogData = {
  passenger?: TravelPassenger;
};

@Component({
  selector: 'app-travel-passenger-delete',
  standalone: true,
  imports: [
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './travel-passenger-delete.component.html',
  styleUrl: './travel-passenger-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelPassengerDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<TravelPassengerDeleteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<TravelPassengerDeleteComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Getters / Helpers de Exibição
  // ==========================================
  protected get passengerName(): string {
    const passenger = this.data?.passenger as any;

    if (!passenger) {
      return 'Não informado';
    }

    return passenger?.patient?.name ?? passenger?.escort?.name ?? passenger?.name ?? 'Não informado';
  }

  // ==========================================
  // Métodos de Ação
  // ==========================================
  protected onSubmit(): void {
    const passengerId = this.data?.passenger?.id;

    if (!passengerId) {
      this.messageService.showMessage('Identificador do passageiro não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.travelService.deletePassenger(passengerId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Passageiro removido com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar remover o passageiro.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}