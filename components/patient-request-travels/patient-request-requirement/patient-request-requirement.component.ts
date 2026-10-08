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
  fulfilled?: boolean;
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

    const items: RequirementItem[] = [
      {
        label: 'Parecer médico favorável',
        fulfilled: request.medical_status
      },
      {
        label: 'Parecer social favorável',
        fulfilled: request.social_status
      },
      {
        label: 'Passagem válida cadastrada',
        fulfilled: request.travel_status
      },
    ];

    return items;
  });
}