import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Core, Services & Models
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';

export type PatientRequestCostAssistanceRequirementDialogData = {
  cost_assistance?: PatientRequestCostAssistance;
};

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-request-cost-assistance-requirement',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule
  ],
  templateUrl: './patient-request-cost-assistance-requirement.component.html',
  styleUrl: './patient-request-cost-assistance-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCostAssistanceRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestCostAssistanceRequirementDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Computed Properties (Consolidação de Dados)
  // ==========================================
  private readonly rawData = computed(() => this.data?.cost_assistance || null);

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const costAssistance = this.rawData();
    if (!costAssistance) return [];

    const items: RequirementItem[] = [
      {
        label: 'Credor (Paciente ou Acompanhante)',
        fulfilled: this.hasValue(costAssistance.passenger)
      },
      {
        label: 'Banco',
        fulfilled: this.hasValue(costAssistance.bank)
      },
      {
        label: 'Agencia',
        fulfilled: this.hasValue(costAssistance.agency)
      },
      {
        label: 'Conta',
        fulfilled: this.hasValue(costAssistance.account)
      },
      {
        label: 'Diárias cadastradas',
        fulfilled: costAssistance.cost_assistance_dailies != null && costAssistance.cost_assistance_dailies.length > 0
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