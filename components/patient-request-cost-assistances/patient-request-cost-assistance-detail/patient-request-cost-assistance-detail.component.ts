import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

// Services, Models & Interfaces
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type PatientRequestCostAssistanceDetailDialogData = {
  cost_assistance?: PatientRequestCostAssistance;
};

@Component({
  selector: 'app-patient-request-cost-assistance-detail',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatCardModule
  ],
  templateUrl: './patient-request-cost-assistance-detail.component.html',
  styleUrl: './patient-request-cost-assistance-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCostAssistanceDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestCostAssistanceDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Helpers e Métodos de Exibição
  // ==========================================

  /**
   * Obtém o nome formatado do passageiro vinculado (Paciente ou Acompanhante).
   */
  protected get passengerName(): string {
    const passengerRelation = (this.data?.cost_assistance as any)?.passenger;
    if (!passengerRelation) return 'Não informado';

    const isPatient = !!passengerRelation?.is_patient;
    const entity = isPatient 
      ? (passengerRelation?.patient || passengerRelation) 
      : passengerRelation?.escort;

    return entity?.name ?? entity?.full_name ?? 'Não informado';
  }

  /**
   * Obtém o rótulo do tipo/vínculo do passageiro (Paciente ou Acompanhante).
   */
  protected get passengerTypeLabel(): string | null {
    const passengerRelation = (this.data?.cost_assistance as any)?.passenger;
    if (!passengerRelation) return null;

    const isPatient = !!passengerRelation?.is_patient;
    return isPatient ? 'Paciente' : 'Acompanhante';
  }
}