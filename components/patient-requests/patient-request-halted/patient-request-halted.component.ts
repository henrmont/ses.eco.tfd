import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
} as const;

export type PatientRequestHaltedDialogData = {
  patient_request?: PatientRequest;
};

@Component({
  selector: 'app-patient-request-halted',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-request-halted.component.html',
  styleUrl: './patient-request-halted.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestHaltedComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestHaltedDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestHaltedComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly isMarkedHalted = computed(
    () => Boolean(this.data?.patient_request?.is_owner_bookmark)
  );

  protected readonly patientName = computed(
    () => this.data?.patient_request?.report?.patient_care?.patient?.name ?? 'Não informado'
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
      .haltedPatientRequest(patientRequestId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(
            response?.message || 'Solicitação paralisada com sucesso!'
          );
          this.requestsChannel.postMessage('update');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar paralisar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}