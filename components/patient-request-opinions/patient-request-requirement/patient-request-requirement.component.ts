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
  type?: 'medical' | 'social';
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

    const type = (this.data?.type || '').toLowerCase();
    const items: RequirementItem[] = [];

    if (type === 'medical') {
      items.push({
        label: 'Parecer médico favorável',
        fulfilled: Boolean(request.medical && request.medical_status)
      });
    } else {
      items.push({
        label: 'Parecer social favorável',
        fulfilled: Boolean(request.social && request.social_status)
      });
    }

    return items;
  });
}