import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

// Utilitários / Pipes
import { NgxMaskPipe } from 'ngx-mask';

@Component({
  selector: 'app-patient-request-accountability-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    NgxMaskPipe
  ],
  templateUrl: './patient-request-accountability-detail.component.html',
  styleUrl: './patient-request-accountability-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAccountabilityDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
}