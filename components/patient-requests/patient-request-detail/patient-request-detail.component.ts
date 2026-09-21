import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Overlay } from '@angular/cdk/overlay';

// Material Modules
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// File Handling
import { saveAs } from 'file-saver';

// Services & Models
import { StorageService } from '../../../../core/services/storage-service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientRequestOpinion } from '../../../models/patient-request-opinion.model';
import { PatientRequestTravel } from '../../../models/patient-request-travel.model';
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';
import { Patient } from '../../../models/patient.model';

// Sub-dialogs
import { PatientDetailComponent } from '../../patients/patient-detail/patient-detail.component';
import { PatientReportDetailComponent } from '../../patients/patient-report-detail/patient-report-detail.component';
import { PatientRequestOpinionDetailComponent } from '../../patient-request-opinions/patient-request-opinion-detail/patient-request-opinion-detail.component';
import { PatientRequestTravelDetailComponent } from '../../patient-request-travels/patient-request-travel-detail/patient-request-travel-detail.component';
import { PatientRequestCostAssistanceDetailComponent } from '../../patient-request-cost-assistances/patient-request-cost-assistance-detail/patient-request-cost-assistance-detail.component';
import { PatientRequestAccountabilityDetailComponent } from '../../patient-request-accountabilities/patient-request-accountability-detail/patient-request-accountability-detail.component';

// Define o tipo aceito para as propriedades do Modal
type PatientRequestSubDialogData =
  { patient: Patient | undefined }
  | { patient_care: PatientCare }
  | { patient_report: PatientReport }
  | { opinion: PatientRequestOpinion }
  | { travel: PatientRequestTravel }
  | { cost_assistance: PatientRequestCostAssistance }
  | { accountability: PatientRequestAccountability };

@Component({
  selector: 'app-patient-request-detail',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-detail.component.html',
  styleUrl: './patient-request-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestDetailComponent {
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

    this.storageService.download('tfd',archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        }
      });
  }

  // ==========================================
  // Gestão Centralizada de Dialogs
  // ==========================================
  private openSubDialog<T>(
    component: new (...args: any[]) => T,
      data: PatientRequestSubDialogData,
      width = '1200px',
      height = 'auto',
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
  protected patientDetail(patientCare: PatientCare): void {
    if (!patientCare) return;
    this.openSubDialog(PatientDetailComponent, { patient: patientCare.patient }, '1200px', '700px');
  }

  protected patientReportDetail(patientReport: PatientReport): void {
    if (!patientReport) return;
    this.openSubDialog(PatientReportDetailComponent, { patient_report: patientReport }, '800px');
  }

  protected patientRequestOpinionDetail(opinion: PatientRequestOpinion): void {
    if (!opinion) return;
    this.openSubDialog(PatientRequestOpinionDetailComponent, { opinion }, '1200px', '700px');
  }

  protected patientRequestTravelDetail(travel: PatientRequestTravel): void {
    if (!travel) return;
    this.openSubDialog(PatientRequestTravelDetailComponent, { travel }, '800px');
  }

  protected showCostAssistance(costAssistance: PatientRequestCostAssistance): void {
    if (!costAssistance) return;
    this.openSubDialog(PatientRequestCostAssistanceDetailComponent, { cost_assistance: costAssistance }, '800px');
  }

  protected showAccountability(accountability: PatientRequestAccountability): void {
    if (!accountability) return;
    this.openSubDialog(PatientRequestAccountabilityDetailComponent, { accountability }, '800px');
  }
}