import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Core, Services & Models
import { PatientRequestTravel } from '../../../models/patient-request-travel.model';

export type PatientRequestTravelRequirementDialogData = {
  travel?: PatientRequestTravel;
};

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-request-travel-requirement',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule
  ],
  templateUrl: './patient-request-travel-requirement.component.html',
  styleUrl: './patient-request-travel-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestTravelRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestTravelRequirementDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Computed Properties (Consolidação de Dados)
  // ==========================================
  private readonly rawData = computed(() => this.data?.travel || null);

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const travel = this.rawData();
    if (!travel) return [];

    const items: RequirementItem[] = [
      {
        label: 'Tipo de passagem',
        fulfilled: this.hasValue(travel.type)
      },
      {
        label: 'Origem',
        fulfilled: this.hasValue(travel.origin)
      },
      {
        label: 'Destino',
        fulfilled: this.hasValue(travel.destination)
      },
      {
        label: 'Data de ida ou data de volta',
        fulfilled: this.hasValue(travel.departure_date) || this.hasValue(travel.return_date)
      },
      {
        label: 'Descrição',
        fulfilled: this.hasValue(travel.description)
      },
      {
        label: 'Tem passageiros cadastrados',
        fulfilled: travel.passengers != null && travel.passengers.length > 0
      },
      {
        label: 'Tem rotas cadastradas',
        fulfilled: travel.travel_routes != null && travel.travel_routes.length > 0
      }
    ];

    return items;
  });

  // ==========================================
  // Métodos Auxiliares Privados
  // ==========================================
  private hasValue(value?: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return !isNaN(value);
    return true;
  }
}