import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

// Enums & Models
import { TravelCompany } from '../../../enums/travel-company';

@Component({
  selector: 'app-travel-route-detail',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
  ],
  templateUrl: './travel-route-detail.component.html',
  styleUrl: './travel-route-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TravelRouteDetailComponent {
  /**
   * Dados injetados do diálogo do Angular Material.
   */
  protected readonly data = inject(MAT_DIALOG_DATA);

  /**
   * Converte a chave do Enum vinda do banco (ex: "LATAM") no valor de exibição (ex: "LATAM Airlines").
   */
  protected getAirlineCompanyLabel(key?: string): string {
    if (!key) {
      return 'Não informada';
    }

    return TravelCompany[key as keyof typeof TravelCompany] ?? key;
  }
}