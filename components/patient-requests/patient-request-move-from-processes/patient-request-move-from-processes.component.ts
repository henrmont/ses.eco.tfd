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

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';

// Services
import { PatientRequestService } from '../../../services/patient-request.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
} as const;

export type PatientRequestMoveFromProcessesDialogData = {
  patient_request?: PatientRequest;
};

@Component({
  selector: 'app-patient-request-move-from-processes',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-request-move-from-processes.component.html',
  styleUrl: './patient-request-move-from-processes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestMoveFromProcessesComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestMoveFromProcessesDialogData | null>(
    MAT_DIALOG_DATA,
    { optional: true }
  );
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestMoveFromProcessesComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly patientName = computed(
    () => this.data?.patient_request?.report?.patient_care?.patient?.name || 'Não informado'
  );

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
    const patientRequestId = this.data?.patient_request?.id;

    if (!patientRequestId) {
      this.messageService.showMessage('Identificador da solicitação inválido.');
      return;
    }

    this.isSubmitting.set(true);

    this.patientRequestService
      .movePatientRequestFromProcesses(patientRequestId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(
            response?.message || 'Solicitação movimentada com sucesso!'
          );
          this.requestsChannel.postMessage('update');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar movimentar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}