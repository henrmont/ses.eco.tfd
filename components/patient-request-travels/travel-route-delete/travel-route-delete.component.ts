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
import { TravelRoute } from '../../../models/travel-route.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

export type TravelRouteDeleteDialogData = {
  route?: TravelRoute;
};

@Component({
  selector: 'app-travel-route-delete',
  standalone: true,
  imports: [
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './travel-route-delete.component.html',
  styleUrl: './travel-route-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelRouteDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<TravelRouteDeleteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<TravelRouteDeleteComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Getters / Helpers de Exibição
  // ==========================================
  protected get routeDescription(): string {
    const origin = this.data?.route?.origin ?? 'Origem não informada';
    const destination = this.data?.route?.destination ?? 'Destino não informado';

    return `${origin} para ${destination}`;
  }

  // ==========================================
  // Métodos de Ação
  // ==========================================
  protected onSubmit(): void {
    const routeId = this.data?.route?.id;

    if (!routeId) {
      this.messageService.showMessage('Identificador da rota não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.travelService.deleteRoute(routeId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Rota removida com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar remover a rota.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}