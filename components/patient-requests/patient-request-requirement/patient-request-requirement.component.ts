import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Core, Services & Models
import { PatientRequest } from '../../../models/patient-request.model';

export type PatientRequestRequirementDialogData = {
  patient_request?: PatientRequest;
};

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-request-requirement',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule
  ],
  templateUrl: './patient-request-requirement.component.html',
  styleUrl: './patient-request-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestRequirementDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Computed Properties (Consolidação de Dados)
  // ==========================================
  private readonly rawData = computed(() => this.data?.patient_request || null);

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const request = this.rawData();
    if (!request) return [];

    const isEntranceType = request.type?.toLowerCase() === 'entrada';

    const items: RequirementItem[] = [
      {
        label: 'Avaliação Médica',
        fulfilled: Boolean(request.medical && request.medical_status)
      },
      {
        label: 'Avaliação Social',
        fulfilled: Boolean(request.social && request.social_status)
      }
    ];

    // Exibe Viagem e Ajuda de Custo apenas se NÃO for solicitação do tipo Entrada
    if (!isEntranceType) {
      items.push(
        {
          label: 'TFD / Viagem',
          fulfilled: Boolean(request.travel && request.travel_status)
        },
        {
          label: 'Ajuda de Custo',
          fulfilled: Boolean(request.cost_assistance && request.cost_assistance_status)
        }
      );
    }

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