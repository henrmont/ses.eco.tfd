import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';

// Services
import { PatientService } from '../../../services/patient.service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';

export type PatientEscortDeleteDialogData = {
  patient_care?: PatientCare;
  patient_escort?: PatientEscort & {
    pivot?: {
      id?: number;
    };
  };
};

@Component({
  selector: 'app-patient-escort-delete',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-escort-delete.component.html',
  styleUrl: './patient-escort-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientEscortDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientEscortDeleteDialogData | null>(MAT_DIALOG_DATA, { optional: true });
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
    return this.data?.patient_escort?.name || 'Acompanhante';
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const patientCareId = this.data?.patient_care?.id;
    const escortId = this.data?.patient_escort?.pivot?.id;

    if (!patientCareId || !escortId) {
      this.messageService.showMessage('Identificadores do atendimento ou do acompanhante inválidos.');
      return;
    }

    this.isSubmitting.set(true);

    this.patientService.deletePatientEscort(patientCareId, escortId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Acompanhante removido com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao tentar remover o acompanhante.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}