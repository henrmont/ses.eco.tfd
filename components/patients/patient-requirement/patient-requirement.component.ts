import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Models
import { PatientCare } from '../../../models/patient-care.model';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
} as const;

interface PatientRequirementDialogData {
  patient_care?: PatientCare;
}

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
    MatListModule,
  ],
  templateUrl: './patient-requirement.component.html',
  styleUrl: './patient-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequirementComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequirementDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  private readonly patientCareState = signal<PatientCare | null>(
    this.data?.patient_care ?? null
  );

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const care = this.patientCareState();
    if (!care) return [];

    const patient = care.patient;
    const patientInfo = patient?.patient_info;

    return [
      {
        label: 'Estado civil',
        fulfilled: this.hasValue(patient?.marital_status),
      },
      {
        label: 'Telefone ou celular de contato',
        fulfilled: this.hasValue(patient?.phone) || this.hasValue(patient?.cell_phone),
      },
      {
        label: 'E-mail',
        fulfilled: this.hasValue(patient?.email),
      },
      {
        label: 'Nome da mãe',
        fulfilled: this.hasValue(patient?.mother_name),
      },
      {
        label: 'Cidade',
        fulfilled: this.hasValue(patient?.city),
      },
      {
        label: 'Estado (UF)',
        fulfilled: this.hasValue(patient?.state),
      },
      {
        label: 'Número de controle',
        fulfilled: this.hasValue(patientInfo?.control_number),
      },
      {
        label: 'Laudo cadastrado',
        fulfilled: Boolean(care.has_reports),
      },
      {
        label: 'Comprovante do CNS',
        fulfilled: patient?.file_cns_id != null,
      },
      {
        label: 'Documento anexado (CPF/Certidão)',
        fulfilled: patient?.file_document_id != null,
      },
      {
        label: 'Comprovante de endereço anexado',
        fulfilled: patient?.file_address_id != null,
      },
      {
        label: 'SigaDoc anexado',
        fulfilled: patientInfo?.file_sigadoc_id != null,
      },
    ];
  });

  protected readonly fulfilledCount = computed<number>(
    () => this.requirements().filter((item) => item.fulfilled).length
  );

  protected readonly totalCount = computed<number>(() => this.requirements().length);

  protected readonly isAllFulfilled = computed<boolean>(
    () => this.totalCount() > 0 && this.fulfilledCount() === this.totalCount()
  );

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private hasValue(value?: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return !Number.isNaN(value);
    return true;
  }
}