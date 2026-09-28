import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { saveAs } from 'file-saver';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Services & Models
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { ReportAttachment } from '../../../models/report-attachment.model';
import { PatientService } from '../../../services/patient.service';

// Dialog Components
import { ReportAttachmentCreateComponent } from '../report-attachment-create/report-attachment-create.component';
import { ReportAttachmentDeleteComponent } from '../report-attachment-delete/report-attachment-delete.component';
import { ReportAttachmentUpdateComponent } from '../report-attachment-update/report-attachment-update.component';

// Tipagem dos Dados do Modal
type ReportAttachmentDialogData = {
  patient_care?: PatientCare;
  patient_report?: PatientReport;
  report_attachment?: ReportAttachment;
};

@Component({
  selector: 'app-report-attachments',
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
  templateUrl: './report-attachments.component.html',
  styleUrl: './report-attachments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportAttachmentsComponent implements OnInit, OnDestroy {
  // ==========================================
  // Instância própria do canal
  // ==========================================
  private readonly patientsChannel = new BroadcastChannel('tfd-patients-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly patientService = inject(PatientService);
  private readonly storageService = inject(StorageService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'actions'];
  protected readonly dataSource = new MatTableDataSource<ReportAttachment>([]);
  protected readonly isLoading = signal<boolean>(true);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchReportAttachments(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
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

  protected reportAttachmentCreate(): void {
    this.openDialog(ReportAttachmentCreateComponent, {
      patient_care: this.data?.patient_care,
      patient_report: this.data?.patient_report
    });
  }

  protected reportAttachmentUpdate(reportAttachment: ReportAttachment): void {
    this.openDialog(ReportAttachmentUpdateComponent, {
      patient_care: this.data?.patient_care,
      patient_report: this.data?.patient_report,
      report_attachment: reportAttachment
    });
  }

  protected reportAttachmentDelete(reportAttachment: ReportAttachment): void {
    this.openDialog(ReportAttachmentDeleteComponent, {
      patient_care: this.data?.patient_care,
      patient_report: this.data?.patient_report,
      report_attachment: reportAttachment
    }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchReportAttachments(showLoading = false): void {
    const patientCareId = this.data?.patient_care?.id || this.data?.patient_report?.patient_care_id || this.data?.patient_report?.patient_care?.id;
    const reportId = this.data?.patient_report?.id;

    if (!patientCareId || !reportId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.patientService.getReportAttachments(patientCareId, reportId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ReportAttachment[]) => {
          this.dataSource.data = response || [];
        },
        error: (err) => {
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar os anexos do laudo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private listenToBroadcastChannel(): void {
    this.patientsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchReportAttachments(false);
      }
    };
  }

  private openDialog<T>(
    component: new (...args: any[]) => T,
    data: ReportAttachmentDialogData,
    width = '400px',
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
          this.handleAttachmentChange();
        }
      });
  }

  private handleAttachmentChange(): void {
    this.fetchReportAttachments(false);
    this.patientsChannel.postMessage('update');
  }
}