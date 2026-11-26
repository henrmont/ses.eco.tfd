import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Models
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
    MatListModule,
  ],
  templateUrl: './patient-request-requirement.component.html',
  styleUrl: './patient-request-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestRequirementDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  private readonly patientRequestState = signal<PatientRequest | null>(
    this.data?.patient_request ?? null
  );

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const request = this.patientRequestState();
    if (!request) return [];

    const isEntranceType = request.type?.toLowerCase() === 'entrada';

    const items: RequirementItem[] = [
      {
        label: 'Avaliação Médica',
        fulfilled: Boolean(request.medical_status),
      },
      {
        label: 'Avaliação Social',
        fulfilled: Boolean(request.social_status),
      },
    ];

    // Exibe Viagem e Ajuda de Custo apenas se NÃO for solicitação do tipo Entrada
    if (!isEntranceType) {
      items.push(
        {
          label: 'TFD / Viagem',
          fulfilled: Boolean(request.travel_status),
        },
        {
          label: 'Ajuda de Custo',
          fulfilled: Boolean(request.cost_assistance_status),
        }
      );
    }

    return items;
  });
}