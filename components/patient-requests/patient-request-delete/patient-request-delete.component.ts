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
import { MessageService } from '../../../../core/services/message.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
} as const;

export type PatientRequestDeleteDialogData = {
  patient_request?: PatientRequest;
};

@Component({
  selector: 'app-patient-request-delete',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-request-delete.component.html',
  styleUrl: './patient-request-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestDeleteComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestDeleteDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestDeleteComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

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
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);

    this.patientRequestService
      .deletePatientRequest(patientRequestId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(
            response?.message || 'Solicitação removida com sucesso!'
          );
          this.requestsChannel.postMessage('update');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError =
            err?.error?.message || 'Ocorreu um erro ao tentar remover a solicitação.';
          this.messageService.showMessage(fallbackError);
        },
      });
  }
}