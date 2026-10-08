import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

// Material Modules
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

// Third-Party Libraries
import { NgxMaskPipe } from 'ngx-mask';

// Services, Models & Enums
import { TravelPassenger } from '../../../models/travel-passenger.model';
import { TravelGender } from '../../../enums/travel-gender';

export type TravelPassengerDetailDialogData = {
  passenger?: TravelPassenger;
};

@Component({
  selector: 'app-travel-passenger-detail',
  standalone: true,
  imports: [
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
  protected readonly data = inject<TravelPassengerDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Helpers e Métodos de Exibição
  // ==========================================

  /**
   * Obtém o nome formatado do passageiro (seja paciente ou acompanhante).
   */
  protected get passengerName(): string {
    const passenger = this.data?.passenger as any;
    if (!passenger) return 'Não informado';

    return passenger?.patient?.name ?? passenger?.escort?.name ?? passenger?.name ?? 'Não informado';
  }

  /**
   * Obtém o documento CPF do passageiro (seja paciente ou acompanhante).
   */
  protected get passengerDocument(): string | null {
    const passenger = this.data?.passenger as any;
    return passenger?.patient?.document ?? passenger?.escort?.document ?? null;
  }

  /**
   * Converte a Key do Enum de Sexo vinda do banco (ex: "M") no seu Value de exibição (ex: "Masculino").
   */
  protected getGenderLabel(key?: string | null): string {
    if (!key) return 'Não informado';
    return TravelGender[key as keyof typeof TravelGender] || key;
  }

  /**
   * Converte a sigla do tipo de passageiro (ADT / CHD) para um rótulo legível.
   */
  protected getPassengerTypeLabel(type?: string | null): string {
    if (!type) return 'Não informado';

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