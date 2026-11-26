import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';

// Models & Services
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';

const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
} as const;

export type PatientEscortDeleteDialogData = {
  patient_care?: PatientCare;
  patient_escort?: PatientEscort;
};

@Component({
  selector: 'app-patient-escort-delete',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './patient-escort-delete.component.html',
  styleUrl: './patient-escort-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientEscortDeleteComponent implements OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientEscortDeleteDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientEscortDeleteComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get escortName(): string {
    return this.data?.patient_escort?.name?.trim() || 'Acompanhante';
  }

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
    const escortId = this.data?.patient_escort?.pivot?.id ?? this.data?.patient_escort?.id;

    if (!patientCareId || !escortId) {
      this.messageService.showMessage(
        'Identificadores do atendimento ou do acompanhante inválidos.'
      );
      return;
    }

    this.isSubmitting.set(true);

    this.patientService
      .deletePatientEscort(patientCareId, escortId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.patientsChannel.postMessage('update');
          this.messageService.showMessage(
            response?.message || 'Acompanhante removido com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao tentar remover o acompanhante.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}