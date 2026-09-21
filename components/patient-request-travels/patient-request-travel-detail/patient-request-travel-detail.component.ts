import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// Material Modules
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

// Third-Party Libraries
import { NgxMaskPipe } from 'ngx-mask';

// Enums & Domain
import { TravelCompany } from '../../../enums/travel-company';

@Component({
  selector: 'app-patient-request-travel-detail',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule, 
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
  protected readonly data = inject(MAT_DIALOG_DATA);

  // ==========================================
  // Helpers e Métodos de Exibição
  // ==========================================

  /**
   * Converte a Key do Enum vinda do banco (ex: "LATAM") no seu Value de exibição (ex: "LATAM Airlines").
   */
  protected getAirlineCompanyLabel(key?: string): string {
    if (!key) return 'Não informada';
    return TravelCompany[key as keyof typeof TravelCompany] || key;
  }
}