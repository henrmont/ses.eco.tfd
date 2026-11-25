import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { ReportAttachment } from '../../../models/report-attachment.model';
import { PatientService } from '../../../services/patient.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
} as const;

interface ReportAttachmentDeleteDialogData {
  patient_care?: PatientCare;
  patient_report?: PatientReport;
  report_attachment?: ReportAttachment;
}

@Component({
  selector: 'app-report-attachment-delete',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './report-attachment-delete.component.html',
  styleUrl: './report-attachment-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportAttachmentDeleteComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<ReportAttachmentDeleteDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<ReportAttachmentDeleteComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected get attachmentName(): string {
    return this.data?.report_attachment?.name || 'Sem nome';
  }

  protected onSubmit(): void {
    const patientCareId = this.data?.patient_care?.id;
    const reportId = this.data?.patient_report?.id;
    const attachmentId = this.data?.report_attachment?.id;

    if (!patientCareId || !reportId || !attachmentId) {
      this.messageService.showMessage(
        'Identificadores do atendimento, laudo ou anexo não encontrados.'
      );
      return;
    }

    this.isSubmitting.set(true);

    this.patientService
      .deleteReportAttachment(patientCareId, reportId, attachmentId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.patientsChannel.postMessage('update');
          this.messageService.showMessage(response?.message || 'Anexo removido com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao tentar remover o anexo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}