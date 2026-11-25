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
import { MessageService } from '../../../../core/services/message-service';
import { PatientCare } from '../../../models/patient-care.model';

// Services
import { PatientService } from '../../../services/patient.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
} as const;

interface PatientFinishBackDialogData {
  patient_care?: PatientCare;
  back_to_user?: string;
}

@Component({
  selector: 'app-patient-finish-back',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-finish-back.component.html',
  styleUrl: './patient-finish-back.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientFinishBackComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientFinishBackDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientFinishBackComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly backToUser = computed<string>(
    () =>
      this.data?.patient_care?.back_to_user?.trim() ||
      this.data?.back_to_user?.trim() ||
      'Informação de retorno não disponível.'
  );

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const patientCareId = this.data?.patient_care?.id;

    if (!patientCareId) {
      this.messageService.showMessage('Identificador do atendimento inválido.');
      return;
    }

    this.isSubmitting.set(true);

    this.patientService
      .finishBackPatient(patientCareId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.patientsChannel.postMessage('update');
          this.messageService.showMessage(
            response?.message || 'Retorno do paciente finalizado com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar finalizar o retorno do paciente.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}