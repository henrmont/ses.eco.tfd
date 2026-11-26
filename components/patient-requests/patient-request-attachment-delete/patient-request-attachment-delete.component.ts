import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  computed,
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
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
} as const;

export interface PatientRequestAttachmentDeleteDialogData {
  patient_request?: PatientRequest;
  patient_request_attachment?: PatientRequestAttachment;
}

@Component({
  selector: 'app-patient-request-attachment-delete',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-request-attachment-delete.component.html',
  styleUrl: './patient-request-attachment-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestAttachmentDeleteComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAttachmentDeleteDialogData | null>(
    MAT_DIALOG_DATA,
    { optional: true }
  );
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAttachmentDeleteComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly attachmentName = computed<string>(
    () => this.data?.patient_request_attachment?.name || 'Sem nome'
  );

  private readonly attachmentId = computed<number | null>(() => {
    const id = this.data?.patient_request_attachment?.id;
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
  });

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnDestroy(): void {
    this.requestsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const id = this.attachmentId();

    if (!id) {
      this.messageService.showMessage('Identificador do anexo não encontrado.');
      return;
    }

    this.isSubmitting.set(true);

    this.patientRequestService
      .deletePatientRequestAttachment(id)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.requestsChannel.postMessage('update');
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