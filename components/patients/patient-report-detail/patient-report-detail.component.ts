import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// File Handling & Utils
import { saveAs } from 'file-saver';

// Services, Enums & Models
import { StorageService } from '../../../../core/services/storage-service';
import { Specialty } from '../../../enums/specialties';
import { PatientReport } from '../../../models/patient-report.model';

type PatientReportDetailDialogData = {
  patient_report?: PatientReport;
};

@Component({
  selector: 'app-patient-report-detail',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './patient-report-detail.component.html',
  styleUrl: './patient-report-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientReportDetailComponent {
  // ==========================================
  // Injeção de Dependências e Dados
  // ==========================================
  protected readonly data = inject<PatientReportDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly storageService = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get report(): PatientReport | undefined {
    return this.data?.patient_report;
  }

  protected get specialtyLabel(): string {
    const rawSpecialty = this.report?.specialty;
    return Specialty[rawSpecialty as keyof typeof Specialty] ?? rawSpecialty ?? 'Não informado';
  }

  // ==========================================
  // Operações de Arquivo / Download
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd', archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        }
      });
  }
}