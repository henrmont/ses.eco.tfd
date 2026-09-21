import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Models e Enums
import { MessageService } from '../../../../core/services/message-service';
import { Specialty } from '../../../enums/specialties';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { PatientService } from '../../../services/patient.service';

// Dialog Components
import { PatientReportCreateComponent } from '../patient-report-create/patient-report-create.component';
import { PatientReportDeleteComponent } from '../patient-report-delete/patient-report-delete.component';
import { PatientReportDetailComponent } from '../patient-report-detail/patient-report-detail.component';
import { PatientReportUpdateComponent } from '../patient-report-update/patient-report-update.component';
import { ReportAttachmentsComponent } from '../report-attachments/report-attachments.component';

// Define o tipo aceito para as propriedades dos Modais de Laudo
type PatientReportDialogData =
  | { patient_report: PatientReport }
  | { patient_care: PatientCare | undefined };

// Constantes Locais
const TFD_PATIENTS_CHANNEL = new BroadcastChannel('tfd-patients-channel');

@Component({
  selector: 'app-patient-reports',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-reports.component.html',
  styleUrl: './patient-reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientReportsComponent implements OnInit, OnDestroy {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['protocol', 'specialty', 'cid', 'lawsuit', 'actions'];
  protected readonly dataSource = new MatTableDataSource<PatientReport>([]);
  protected readonly isLoading = signal<boolean>(true);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchPatientReports(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    TFD_PATIENTS_CHANNEL.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected getSpecialtyLabel(specialtyKey: string): string {
    if (!specialtyKey) return 'Não informada';
    return Specialty[specialtyKey as keyof typeof Specialty] ?? specialtyKey;
  }

  protected patientReportDetail(patientReport: PatientReport): void {
    this.openDialog(PatientReportDetailComponent, { patient_report: patientReport }, '800px', 'auto', false);
  }

  protected patientReportCreate(): void {
    this.openDialog(PatientReportCreateComponent, { patient_care: this.data?.patient_care });
  }

  protected patientReportUpdate(patientReport: PatientReport): void {
    this.openDialog(PatientReportUpdateComponent, { patient_report: patientReport });
  }

  protected patientReportDelete(patientReport: PatientReport): void {
    this.openDialog(PatientReportDeleteComponent, { patient_report: patientReport }, '400px', 'auto', true);
  }

  protected reportAttachments(patientReport: PatientReport): void {
    this.openDialog(ReportAttachmentsComponent, { patient_report: patientReport }, '600px', 'auto', false);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchPatientReports(showLoading = false): void {
    const patientCareId = this.data?.patient_care?.id;

    if (!patientCareId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.patientService.getPatientReports(patientCareId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const rawData: PatientReport[] = response || [];
          this.dataSource.data = rawData;
        },
        error: (err) => {
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar os laudos do paciente.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private listenToBroadcastChannel(): void {
    TFD_PATIENTS_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPatientReports(false);
      }
    };
  }

  private openDialog<T>(
    component: new (...args: any[]) => T,
    data: PatientReportDialogData,
    width = '800px',
    height = 'auto',
    requiresRefresh = true
  ): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      data
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && requiresRefresh) {
          this.handleReportChange();
        }
      });
  }

  private handleReportChange(): void {
    this.fetchPatientReports(false);
    TFD_PATIENTS_CHANNEL.postMessage('update');
  }
}