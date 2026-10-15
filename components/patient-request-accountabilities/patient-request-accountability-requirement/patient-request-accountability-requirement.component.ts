import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Core, Services & Models
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';

export type PatientRequestAccountabilityRequirementDialogData = {
  accountability?: PatientRequestAccountability;
};

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-request-accountability-requirement',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule
  ],
  templateUrl: './patient-request-accountability-requirement.component.html',
  styleUrl: './patient-request-accountability-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAccountabilityRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAccountabilityRequirementDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Computed Properties (Consolidação de Dados)
  // ==========================================
  private readonly rawData = computed(() => this.data?.accountability || null);

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const accountability = this.rawData();
    if (!accountability) return [];

    const items: RequirementItem[] = [
      {
        label: 'Diárias cadastradas',
        fulfilled: accountability.accountability_dailies != null && accountability.accountability_dailies.length > 0
      },
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