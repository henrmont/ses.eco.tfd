import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Core & Models
import { PatientEscort } from '../../../models/patient-escort.model';

type PatientEscortRequirementDialogData = {
  patient_escort?: PatientEscort;
};

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-escort-requirement',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule
  ],
  templateUrl: './patient-escort-requirement.component.html',
  styleUrl: './patient-escort-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientEscortRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientEscortRequirementDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Computed Properties (Consolidação de Dados)
  // ==========================================
  private readonly rawData = computed(() => this.data?.patient_escort || null);

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const escort = this.rawData();
    if (!escort) return [];

    return [
      {
        label: 'Nome Completo',
        fulfilled: this.hasValue(escort.name)
      },
      {
        label: 'Grau de Parentesco / Relação',
        fulfilled: this.hasValue(escort.relation)
      },
      {
        label: 'Cidade',
        fulfilled: this.hasValue(escort.city)
      },
      {
        label: 'Estado (UF)',
        fulfilled: this.hasValue(escort.state)
      },
      {
        label: 'Comprovante do CNS',
        fulfilled: escort.file_cns_id != null
      },
      {
        label: 'Documento Anexado (CPF/RG)',
        fulfilled: escort.file_document_id != null
      },
      {
        label: 'Comprovante de Endereço Anexado',
        fulfilled: escort.file_address_id != null
      }
    ];
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