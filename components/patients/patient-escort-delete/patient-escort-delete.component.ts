import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientService } from '../../../services/patient.service';

@Component({
  selector: 'app-patient-escort-delete',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
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
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientEscortDeleteComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const pivotId = this.data?.patient_escort?.pivot?.id;
    if (!pivotId) {
      this.messageService.showMessage('Identificador do vínculo não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.patientService.deletePatientEscort(pivotId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Acompanhante removido com sucesso!');
          this.dialogRef.close(true);
        },
        error: err => {
          const fallbackError = err?.error?.message || 'Ocorreu um erro ao tentar remover o acompanhante.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}