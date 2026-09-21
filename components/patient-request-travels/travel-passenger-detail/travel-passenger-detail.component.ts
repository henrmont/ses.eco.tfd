import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgxMaskPipe } from 'ngx-mask';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

// Enums e Suporte
import { TravelGender } from '../../../enums/travel-gender';

@Component({
  selector: 'app-travel-passenger-detail',
  standalone: true,
  imports: [
    CommonModule, 
    CurrencyPipe,
    MatDialogModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule, 
    NgxMaskPipe
  ],
  templateUrl: './travel-passenger-detail.component.html',
  styleUrl: './travel-passenger-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelPassengerDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Helpers e Conversões de Exibição
  // ==========================================
  /**
   * Converte a Key do Enum de Sexo vinda do banco (ex: "M") no seu Value de exibição (ex: "Masculino").
   */
  protected getGenderLabel(key?: string): string {
    if (!key) {
      return 'Não informado';
    }
    return TravelGender[key as keyof typeof TravelGender] || key;
  }

  /**
   * Converte a sigla do tipo de passageiro (ADT / CHD) para um rótulo legível.
   */
  protected getPassengerTypeLabel(type?: string): string {
    if (!type) {
      return 'Não informado';
    }

    switch (type.toUpperCase()) {
      case 'ADT':
        return 'Adulto (ADT)';
      case 'CHD':
        return 'Criança (CHD)';
      default:
        return type;
    }
  }
}