import { ComponentType, Overlay } from '@angular/cdk/overlay';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// Third-Party Libraries
import { NgxMaskPipe } from 'ngx-mask';

// Services & Models
import { PatientRequestTravel } from '../../../models/patient-request-travel.model';
import { TravelCompany } from '../../../enums/travel-company';
import { TravelPassenger } from '../../../models/travel-passenger.model';
import { TravelRoute } from '../../../models/travel-route.model';
import { TravelPassengerDetailComponent } from '../travel-passenger-detail/travel-passenger-detail.component';
import { TravelRouteDetailComponent } from '../travel-route-detail/travel-route-detail.component';

// Sub-dialogs (Ajuste os caminhos de importação conforme a estrutura do seu projeto)

export type PatientRequestTravelDetailDialogData = {
  travel?: PatientRequestTravel;
};

type TravelSubDialogData = {
  passenger?: TravelPassenger;
  route?: TravelRoute;
};

@Component({
  selector: 'app-patient-request-travel-detail',
  standalone: true,
  imports: [
    DatePipe,
    MatDialogModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule,
    MatTooltipModule,
    NgxMaskPipe
  ],
  templateUrl: './patient-request-travel-detail.component.html',
  styleUrl: './patient-request-travel-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestTravelDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestTravelDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Helpers e Métodos de Exibição
  // ==========================================
  /**
   * Converte a Key do Enum vinda do banco (ex: "LATAM") no seu Value de exibição (ex: "LATAM Airlines").
   */
  protected getAirlineCompanyLabel(key?: string | null): string {
    if (!key) return 'Não informada';
    return TravelCompany[key as keyof typeof TravelCompany] || key;
  }

  // ==========================================
  // Gestão Centralizada de Sub-Dialogs
  // ==========================================
  private openSubDialog<T>(
    component: ComponentType<T>,
    data: TravelSubDialogData,
    width = '800px',
    height = 'auto'
  ): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      data
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  // ==========================================
  // Handlers para Abertura de Sub-Modais
  // ==========================================
  protected showPassengerDetail(passenger: TravelPassenger): void {
    if (!passenger) return;
    this.openSubDialog(TravelPassengerDetailComponent, { passenger }, '800px');
  }

  protected showRouteDetail(route: TravelRoute): void {
    if (!route) return;
    this.openSubDialog(TravelRouteDetailComponent, { route }, '800px');
  }
}