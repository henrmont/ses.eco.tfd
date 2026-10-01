import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';

// Angular Material
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

export interface PatientRequestRequirementData {
  type?: string | null;
  medical?: boolean | null;
  medical_status?: boolean | null;
  social?: boolean | null;
  social_status?: boolean | null;
  travel?: boolean | null;
  travel_status?: boolean | null;
  cost_assistance?: boolean | null;
  cost_assistance_status?: boolean | null;
  [key: string]: unknown;
}

export interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-request-requirement',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatButtonModule
  ],
  templateUrl: './patient-request-requirement.component.html',
  styleUrl: './patient-request-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestRequirementComponent {
  /**
   * Dados recebidos via MAT_DIALOG_DATA (se aberto via modal)
   */
  protected readonly data = inject<{ patient_request?: PatientRequestRequirementData }>(MAT_DIALOG_DATA, { optional: true });

  /**
   * Input Signal (se utilizado diretamente via template)
   */
  public readonly requestData = input<PatientRequestRequirementData | null>(null);

  /**
   * Consolida a fonte de dados (Input ou Dialog Data)
   */
  private readonly rawData = computed<PatientRequestRequirementData | null>(() => 
    this.requestData() || this.data?.patient_request || null
  );

  /**
   * Mapeamento reativo condicional ao tipo da solicitação
   */
  protected readonly requirements = computed<RequirementItem[]>(() => {
    const request = this.rawData();
    if (!request) return [];

    const isEntranceType = request.type?.toLowerCase() === 'entrada' || request.type?.toLowerCase() === 'entrance';

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
}