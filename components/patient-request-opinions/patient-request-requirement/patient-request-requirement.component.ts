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

interface PatientRequestRequirementData {
  type?: string | null;
  medical?: boolean | null;
  medical_status?: boolean | null;
  social?: boolean | null;
  social_status?: boolean | null;
  [key: string]: unknown;
}

interface RequirementItem {
  label: string;
  fulfilled: boolean;
}

@Component({
  selector: 'app-patient-request-requirement',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule,
    MatButtonModule
  ],
  templateUrl: './patient-request-requirement.component.html',
  styleUrl: './patient-request-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  /**
   * Dados recebidos via MAT_DIALOG_DATA (se aberto via modal)
   */
  protected readonly data = inject(MAT_DIALOG_DATA);

  // ==========================================
  // Inputs e Signals
  // ==========================================
  /**
   * Input Signal (se utilizado diretamente via template)
   */
  public readonly requestData = input<PatientRequestRequirementData | null>(null);

  /**
   * Consolida a fonte de dados (Input ou Dialog Data)
   */
  private readonly rawData = computed<PatientRequestRequirementData | null>(() => 
    this.requestData() || this.data?.patient_request || null
  );

  /**
   * Mapeamento reativo condicional aos requisitos
   */
  protected readonly requirements = computed<RequirementItem[]>(() => {
    const request = this.rawData();
    if (!request) return [];

    // Prioriza o 'type' direto no data ou dentro de patient_request
    const type = (this.data?.type || '').toLowerCase();

    const items: RequirementItem[] = []

    if (type === 'medical') 
      items.push({ label: 'Parecer médico favorável', fulfilled: Boolean(request.medical && request.medical_status)})
    else
      items.push({ label: 'Parecer social favorável', fulfilled: Boolean(request.social && request.social_status)})

    return items;
  });
}