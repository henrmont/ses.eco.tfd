import { Overlay } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// File Handling
import { saveAs } from 'file-saver';
import { NgxMaskPipe } from 'ngx-mask';

// Services & Models
import { StorageService } from '../../../../core/services/storage-service';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientReport } from '../../../models/patient-report.model';

// Sub-dialogs
import { PatientEscortDetailComponent } from '../patient-escort-detail/patient-escort-detail.component';
import { PatientReportDetailComponent } from '../patient-report-detail/patient-report-detail.component';

type PatientSubDialogData =
  | { patient_escort: PatientEscort }
  | { patient_report: PatientReport };

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    NgxMaskPipe
  ],
  templateUrl: './patient-detail.component.html',
  styleUrl: './patient-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly storageService = inject(StorageService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

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

  // ==========================================
  // Gestão Centralizada de Sub-Dialogs
  // ==========================================
  private openSubDialog<T>(
    component: new (...args: any[]) => T,
    data: PatientSubDialogData,
    width = '800px',
    height = 'auto'
  ): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      data
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  // ==========================================
  // Handlers para Abertura de Sub-Modais
  // ==========================================
  protected showEscortDetail(escort: PatientEscort): void {
    if (!escort) return;
    this.openSubDialog(PatientEscortDetailComponent, { patient_escort: escort }, '900px');
  }

  protected showReportDetail(report: PatientReport): void {
    if (!report) return;
    this.openSubDialog(PatientReportDetailComponent, { patient_report: report }, '800px');
  }
}