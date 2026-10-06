import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

// Models
import { PatientRequestOpinion } from '../../../models/patient-request-opinion.model';

export type PatientRequestOpinionDetailDialogData = {
  opinion?: PatientRequestOpinion;
};

@Component({
  selector: 'app-patient-request-opinion-detail',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule
  ],
  templateUrl: './patient-request-opinion-detail.component.html',
  styleUrl: './patient-request-opinion-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestOpinionDetailComponent {
  // ==========================================
  // Injeção de Dependências e Dados
  // ==========================================
  protected readonly data = inject<PatientRequestOpinionDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly sanitizer = inject(DomSanitizer);

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get opinion(): PatientRequestOpinion | undefined {
    return this.data?.opinion;
  }

  protected get professional() {
    return this.opinion?.professional;
  }

  // ==========================================
  // Propriedades Computadas (Signals)
  // ==========================================
  protected readonly sanitizedHtml = computed<SafeHtml>(() => {
    const rawHtml = this.opinion?.content || '';
    return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  });
}