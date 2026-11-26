import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

// File Handling & Utils
import { saveAs } from 'file-saver';

// Core, Services, Enums & Models
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { Specialty } from '../../../enums/specialties';
import { PatientReport } from '../../../models/patient-report.model';

interface PatientReportDetailDialogData {
  patient_report?: PatientReport;
}

@Component({
  selector: 'app-patient-report-detail',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './patient-report-detail.component.html',
  styleUrl: './patient-report-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientReportDetailComponent {
  // ==========================================
  // Injeção de Dependências e Dados
  // ==========================================
  protected readonly data = inject<PatientReportDetailDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly storageService = inject(StorageService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly downloadingArchiveId = signal<number | null>(null);

  protected readonly report = computed<PatientReport | undefined>(
    () => this.data?.patient_report
  );

  protected readonly specialtyLabel = computed<string>(() => {
    const rawSpecialty = this.report()?.specialty;
    return Specialty[rawSpecialty as keyof typeof Specialty] ?? rawSpecialty ?? 'Não informado';
  });

  // ==========================================
  // Operações de Arquivo / Download
  // ==========================================
  protected download(archiveId: number | null | undefined, name?: string): void {
    if (!archiveId || this.downloadingArchiveId() === archiveId) return;

    this.downloadingArchiveId.set(archiveId);

    this.storageService
      .download('tfd', archiveId)
      .pipe(
        finalize(() => this.downloadingArchiveId.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, name || `anexo-${archiveId}`);
          }
        },
        error: (err) => {
          const fallbackError = 'Erro ao realizar o download do arquivo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}