import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

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
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly sanitizer = inject(DomSanitizer);

  // ==========================================
  // Propriedades Computadas (Signals)
  // ==========================================
  protected readonly sanitizedHtml = computed<SafeHtml>(() => {
    const rawHtml = this.data?.opinion?.content || '';
    return this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  });
}