import { ComponentType, Overlay } from '@angular/cdk/overlay';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// File Handling & Utils
import { saveAs } from 'file-saver';
import { NgxMaskPipe } from 'ngx-mask';

// Services & Models
import { StorageService } from '../../../../core/services/storage-service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientReport } from '../../../models/patient-report.model';

// Sub-dialogs
import { PatientEscortDetailComponent } from '../patient-escort-detail/patient-escort-detail.component';
import { PatientReportDetailComponent } from '../patient-report-detail/patient-report-detail.component';

type PatientDetailDialogData = {
  patient_care?: PatientCare;
};

type PatientSubDialogData = {
  patient_escort?: PatientEscort,
  patient_report?: PatientReport
}

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
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
  // Injeção de Dependências e Dados
  // ==========================================
  protected readonly data = inject<PatientDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly storageService = inject(StorageService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get patientCare(): PatientCare | undefined {
    return this.data?.patient_care;
  }

  protected get patient() {
    return this.patientCare?.patient;
  }

  protected get patientInfo() {
    return this.patient?.patient_info;
  }

  protected get escorts(): PatientEscort[] {
    return this.patientCare?.escorts || [];
  }

  protected get reports(): PatientReport[] {
    return this.patientCare?.reports || [];
  }

  protected get documentMask(): string {
    return this.patient?.document_type === 'CPF'
      ? '000.000.000-00'
      : '000000 00 00 0000 0 00000 000 0000000 00';
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

  // ==========================================
  // Gestão Centralizada de Sub-Dialogs
  // ==========================================
  private openSubDialog<T>(
    component: ComponentType<T>,
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