import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

// Material Modules
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

// Enums & Models
import { TravelCompany } from '../../../enums/travel-company';
import { TravelRoute } from '../../../models/travel-route.model';

export type TravelRouteDetailDialogData = {
  route?: TravelRoute;
};

@Component({
  selector: 'app-travel-route-detail',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './travel-route-detail.component.html',
  styleUrl: './travel-route-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelRouteDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<TravelRouteDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Helpers e Métodos de Exibição
  // ==========================================

  /**
   * Converte a chave do Enum vinda do banco (ex: "LATAM") no valor de exibição (ex: "LATAM Airlines").
   */
  protected getAirlineCompanyLabel(key?: string | null): string {
    if (!key) {
      return 'Não informada';
    }

    return TravelCompany[key as keyof typeof TravelCompany] ?? key;
  }
}