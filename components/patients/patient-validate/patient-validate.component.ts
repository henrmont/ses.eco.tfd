import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { MessageService } from '../../../../core/services/message-service';
import { PatientService } from '../../../services/patient.service';

@Component({
  selector: 'app-patient-validate',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-validate.component.html',
  styleUrl: './patient-validate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientValidateComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientValidateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão / Ações
  // ==========================================
  protected onSubmit(): void {
    const patientCareId = this.data?.patient_care?.id;
    if (!patientCareId) {
      this.messageService.showMessage('Erro: Identificador do atendimento não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    const isValid = this.data?.patientCare?.is_valid;
    const acaoSucesso = isValid ? 'invalidado' : 'validado';
    const acaoErro = isValid ? 'invalidar' : 'validar';

    this.patientService.validatePatient(patientCareId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || `Atendimento ${acaoSucesso} com sucesso!`);
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || `Ocorreu um erro ao tentar ${acaoErro} o atendimento.`;
          this.messageService.showMessage(fallbackError);
        }
      });
  }
}