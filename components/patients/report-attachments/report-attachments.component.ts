import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
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

// Core, Models e Enums
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';
import { PatientReport } from '../../../models/patient-report.model';
import { ReportAttachment } from '../../../models/report-attachment.model';
import { PatientService } from '../../../services/patient.service';

// Dialog Components
import { ReportAttachmentCreateComponent } from '../report-attachment-create/report-attachment-create.component';
import { ReportAttachmentDeleteComponent } from '../report-attachment-delete/report-attachment-delete.component';
import { ReportAttachmentUpdateComponent } from '../report-attachment-update/report-attachment-update.component';

// Define o tipo aceito para as propriedades dos Modais de Anexos
type ReportAttachmentDialogData =
  | { report_attachment: ReportAttachment }
  | { patient_report: PatientReport | undefined };

// Constantes Locais
const TFD_PATIENTS_CHANNEL = new BroadcastChannel('tfd-patients-channel');

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
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly patientService = inject(PatientService);
  private readonly storageService = inject(StorageService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

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
  }

  ngOnDestroy(): void {
    TFD_PATIENTS_CHANNEL.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd',archiveId)
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
    this.openDialog(ReportAttachmentCreateComponent, { patient_report: this.data?.patient_report });
  }

  protected reportAttachmentUpdate(reportAttachment: ReportAttachment): void {
    this.openDialog(ReportAttachmentUpdateComponent, { report_attachment: reportAttachment });
  }

  protected reportAttachmentDelete(reportAttachment: ReportAttachment): void {
    this.openDialog(ReportAttachmentDeleteComponent, { report_attachment: reportAttachment }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchReportAttachments(showLoading = false): void {
    const reportId = this.data?.patient_report?.id;

    if (!reportId) {
      this.isLoading.set(false);
      this.cdr.markForCheck();
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.patientService.getReportAttachments(reportId)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const rawData: ReportAttachment[] = response || [];
          this.dataSource.data = rawData;
        },
        error: (err) => {
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar os anexos do laudo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private openDialog<T>(
    component: new (...args: any[]) => T,
    data: ReportAttachmentDialogData,
    width = '400px',
    height = 'auto',
    requiresRefresh = true,
    emitGlobalBroadcast = true
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
        if (result) {
          this.fetchReportAttachments(requiresRefresh);

          if (emitGlobalBroadcast) {
            TFD_PATIENTS_CHANNEL.postMessage('update');
          }
          this.cdr.markForCheck();
        }
      });
  }
}