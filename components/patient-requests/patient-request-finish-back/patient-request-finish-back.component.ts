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

export type PatientRequestFinishBackDialogData = {
  patient_request?: PatientRequest;
  back_to_owner?: string;
};

@Component({
  selector: 'app-patient-request-finish-back',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-request-finish-back.component.html',
  styleUrl: './patient-request-finish-back.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestFinishBackComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestFinishBackDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestFinishBackComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly backToOwner = computed(
    () =>
      this.data?.patient_request?.back_to_owner ||
      this.data?.back_to_owner ||
      'Informação de retorno não disponível.'
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
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação inválido.');
      return;
    }

    this.isSubmitting.set(true);

    this.patientRequestService
      .finishBackPatientRequest(requestId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(
            response?.message || 'Retorno da solicitação finalizado com sucesso!'
          );
          this.requestsChannel.postMessage('update');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar finalizar o retorno da solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}