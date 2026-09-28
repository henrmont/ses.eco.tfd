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

interface PatientRequirementData {
  marital_status?: string | null;
  phone?: string | null;
  cell_phone?: string | null;
  email?: string | null;
  mother_name?: string | null;
  city?: string | null;
  state?: string | null;
  file_cns_id?: number | string | null;
  file_document_id?: number | string | null;
  file_address_id?: number | string | null;
  patientInfo?: {
    control_number?: string | null;
    file_protocol_id?: number | string | null;
  } | null;
  has_reports?: boolean; // Booleano retornado da API correspondente a $this->reports()->exists()
}

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-requirement',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatButtonModule
  ],
  templateUrl: './patient-requirement.component.html',
  styleUrl: './patient-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequirementComponent {
  /**
   * Dados recebidos via MAT_DIALOG_DATA (caso o componente seja aberto via MatDialog)
   */
  protected readonly data = inject(MAT_DIALOG_DATA);

  /**
   * Ou via Input Signal (caso seja usado diretamente no template como <app-patient-requirement [patientData]="data">)
   */
  public readonly patientInput = input<PatientRequirementData | null>(null);

  /**
   * Consolida a fonte de dados (Dialog Data ou Input)
   */
  private readonly rawData = computed(() => this.patientInput() || this.data.patient_care || null);

  /**
   * Mapeamento reativo das checagens baseado no PHP
   */
  protected readonly requirements = computed<RequirementItem[]>(() => {
    const data = this.rawData();
    if (!data) return [];

    return [
      {
        label: 'Estado Civil',
        fulfilled: data.patient.marital_status != null && data.patient.marital_status !== ''
      },
      {
        label: 'Telefone ou Celular de Contato',
        fulfilled: (data.patient.phone != null && data.patient.phone !== '') || (data.patient.cell_phone != null && data.patient.cell_phone !== '')
      },
      {
        label: 'E-mail',
        fulfilled: data.patient.email != null && data.patient.email !== ''
      },
      {
        label: 'Nome da Mãe',
        fulfilled: data.patient.mother_name != null && data.patient.mother_name !== ''
      },
      {
        label: 'Cidade',
        fulfilled: data.patient.city != null && data.patient.city !== ''
      },
      {
        label: 'Estado (UF)',
        fulfilled: data.patient.state != null && data.patient.state !== ''
      },
      {
        label: 'Número de Controle',
        fulfilled: data.patient.patient_info?.control_number != null && data.patient.patient_info?.control_number !== ''
      },
      {
        label: 'Laudo Cadastrado',
        fulfilled: !!data.has_reports
      },
      {
        label: 'Comprovante do CNS',
        fulfilled: data.patient.file_cns_id != null
      },
      {
        label: 'Documento Anexado (CPF/RG)',
        fulfilled: data.patient.file_document_id != null
      },
      {
        label: 'Comprovante de Endereço Anexado',
        fulfilled: data.patient.file_address_id != null
      },
      {
        label: 'Sigadoc Anexado',
        fulfilled: data.patient.patient_info?.file_sigadoc_id != null
      }
    ];
  });
}