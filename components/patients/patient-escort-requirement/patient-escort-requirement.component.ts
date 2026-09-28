import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';

// Angular Material
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

interface PatientEscortRequirementData {
  relation?: string | null;
  city?: string | null;
  state?: string | null;
  file_cns_id?: number | string | null;
  file_document_id?: number | string | null;
  file_address_id?: number | string | null;
  // Permite aceitar tanto o objeto direto do acompanhante quanto embrulhado em patient_escort
  patient_escort?: PatientEscortRequirementData;
}

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-escort-requirement',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatButtonModule
  ],
  templateUrl: './patient-escort-requirement.component.html',
  styleUrl: './patient-escort-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientEscortRequirementComponent {
  /**
   * Dados recebidos via MAT_DIALOG_DATA (caso seja aberto via MatDialog)
   */
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });

  /**
   * Dados via Input Signal (caso seja usado como tag <app-patient-escort-requirement [escortData]="data">)
   */
  public readonly escortInput = input<PatientEscortRequirementData | null>(null);

  /**
   * Consolida a fonte de dados acessando o acompanhante (direto ou via wrapper patient_escort)
   */
  private readonly rawData = computed(() => {
    const inputData = this.escortInput();
    if (inputData) {
      return inputData.patient_escort || inputData;
    }

    const dialogData = this.data;
    if (dialogData) {
      return dialogData.patient_escort || dialogData.patient_care?.patient_escort || dialogData;
    }

    return null;
  });

  /**
   * Mapeamento reativo dos requisitos do acompanhante baseado no PHP
   */
  protected readonly requirements = computed<RequirementItem[]>(() => {
    const escort = this.rawData();
    if (!escort) return [];

    return [
      {
        label: 'Grau de Parentesco / Relação',
        fulfilled: escort.relation != null && escort.relation !== ''
      },
      {
        label: 'Cidade',
        fulfilled: escort.city != null && escort.city !== ''
      },
      {
        label: 'Estado (UF)',
        fulfilled: escort.state != null && escort.state !== ''
      },
      {
        label: 'Comprovante do CNS Anexado',
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
}