import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

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
export class PatientRequestCostAssistanceDetailComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<PatientRequestCostAssistanceDetailComponent>);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly passengerName = signal<string>('Não informado');
  protected readonly passengerTypeLabel = signal<string>('');

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.resolvePassengerData();
  }

  // ==========================================
  // Helpers e Métodos Auxiliares
  // ==========================================
  /**
   * Resolve a exibição do nome e do tipo do passageiro com base no objeto vinculado à ajuda de custo.
   */
  private resolvePassengerData(): void {
    const costAssistance = this.data?.cost_assistance;
    const passengerRelation = costAssistance?.passenger;

    if (!passengerRelation) {
      return;
    }

    const isPatient = !!passengerRelation?.is_patient;
    const entity = isPatient
      ? (passengerRelation?.patient || passengerRelation)
      : passengerRelation?.escort;

    const name = entity?.name || entity?.full_name;

    if (name) {
      this.passengerName.set(name);
      this.passengerTypeLabel.set(isPatient ? 'Paciente' : 'Acompanhante');
    }
  }
}