import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

// Services, Models & Interfaces
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type PatientRequestAccountabilityDetailDialogData = {
  accountability?: PatientRequestAccountability;
};

@Component({
  selector: 'app-patient-request-accountability-detail',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatCardModule
  ],
  templateUrl: './patient-request-accountability-detail.component.html',
  styleUrl: './patient-request-accountability-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAccountabilityDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAccountabilityDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });
}