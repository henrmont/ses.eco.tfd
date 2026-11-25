import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { saveAs } from 'file-saver';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
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

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
  defaultDialogWidth: '400px',
} as const;

export interface ReportAttachmentDialogData {
  patient_care?: PatientCare;
  patient_report?: PatientReport;
  report_attachment?: ReportAttachment;
}

@Component({
  selector: 'app-report-attachments',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './report-attachments.component.html',
  styleUrl: './report-attachments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportAttachmentsComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<ReportAttachmentDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
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
  protected readonly downloadingArchiveId = signal<number | null>(null);

  private readonly patientCareId = this.data?.patient_care?.id ?? null;
  private readonly reportId = this.data?.patient_report?.id ?? null;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchReportAttachments(true);
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected download(archiveId: number | null | undefined, name?: string): void {
    if (!archiveId || this.downloadingArchiveId() === archiveId) return;

    this.downloadingArchiveId.set(archiveId);

    const fileName = name?.trim() || `anexo-${archiveId}`;

    this.storageService
      .download('tfd', archiveId)
      .pipe(
        finalize(() => this.downloadingArchiveId.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, fileName);
          }
        },
        error: (err) => {
          const fallbackError = 'Erro ao realizar o download do arquivo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  protected reportAttachmentCreate(): void {
    this.openDialog(ReportAttachmentCreateComponent, this.getBaseDialogData());
  }

  protected reportAttachmentUpdate(reportAttachment: ReportAttachment): void {
    this.openDialog(
      ReportAttachmentUpdateComponent,
      this.getAttachmentDialogData(reportAttachment)
    );
  }

  protected reportAttachmentDelete(reportAttachment: ReportAttachment): void {
    this.openDialog(
      ReportAttachmentDeleteComponent,
      this.getAttachmentDialogData(reportAttachment)
    );
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private getBaseDialogData(): ReportAttachmentDialogData {
    return {
      patient_care: this.data?.patient_care,
      patient_report: this.data?.patient_report,
    };
  }

  private getAttachmentDialogData(reportAttachment: ReportAttachment): ReportAttachmentDialogData {
    return {
      ...this.getBaseDialogData(),
      report_attachment: reportAttachment,
    };
  }

  private fetchReportAttachments(showLoading = false): void {
    if (!this.patientCareId || !this.reportId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.patientService
      .getReportAttachments(this.patientCareId, this.reportId)
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
        },
      });
  }

  private setupBroadcastChannel(): void {
    this.patientsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchReportAttachments(false);
      }
    };
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: ReportAttachmentDialogData,
    width: string = COMPONENT_CONFIG.defaultDialogWidth,
    height = 'auto',
    requiresRefresh = true
  ): void {
    this.dialog
      .open(component, {
        width,
        height,
        disableClose: true,
        autoFocus: false,
        scrollStrategy: this.overlay.scrollStrategies.noop(),
        data,
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