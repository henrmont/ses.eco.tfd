import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Core & Models
import { PatientCare } from '../../../models/patient-care.model';

type PatientRequirementDialogData = {
  patient_care?: PatientCare;
};

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-requirement',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule
  ],
  templateUrl: './patient-requirement.component.html',
  styleUrl: './patient-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequirementDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Computed Properties (Consolidação de Dados)
  // ==========================================
  private readonly rawData = computed(() => this.data?.patient_care || null);

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const care = this.rawData();
    if (!care) return [];

    const patient = care.patient;
    const patientInfo = patient?.patient_info;

    return [
      {
        label: 'Estado Civil',
        fulfilled: this.hasValue(patient?.marital_status)
      },
      {
        label: 'Telefone ou Celular de Contato',
        fulfilled: this.hasValue(patient?.phone) || this.hasValue(patient?.cell_phone)
      },
      {
        label: 'E-mail',
        fulfilled: this.hasValue(patient?.email)
      },
      {
        label: 'Nome da Mãe',
        fulfilled: this.hasValue(patient?.mother_name)
      },
      {
        label: 'Cidade',
        fulfilled: this.hasValue(patient?.city)
      },
      {
        label: 'Estado (UF)',
        fulfilled: this.hasValue(patient?.state)
      },
      {
        label: 'Número de Controle',
        fulfilled: this.hasValue(patientInfo?.control_number)
      },
      {
        label: 'Laudo Cadastrado',
        fulfilled: !!care.has_reports
      },
      {
        label: 'Comprovante do CNS',
        fulfilled: patient?.file_cns_id != null
      },
      {
        label: 'Documento Anexado (CPF/RG)',
        fulfilled: patient?.file_document_id != null
      },
      {
        label: 'Comprovante de Endereço Anexado',
        fulfilled: patient?.file_address_id != null
      },
      {
        label: 'Sigadoc Anexado',
        fulfilled: patientInfo?.file_sigadoc_id != null
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