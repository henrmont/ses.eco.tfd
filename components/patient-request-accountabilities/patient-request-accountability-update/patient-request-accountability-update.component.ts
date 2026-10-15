import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services, Models & Enums
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type PatientRequestAccountabilityUpdateDialogData = {
  accountability?: PatientRequestAccountability;
};

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-request-accountability-update',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './patient-request-accountability-update.component.html',
  styleUrl: './patient-request-accountability-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAccountabilityUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAccountabilityUpdateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAccountabilityUpdateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected updateAccountabilityForm!: FormGroup;
  protected readonly isSubmitting = signal<boolean>(false);

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    name: [
      { type: 'required', message: 'O nome da prestação de contas é obrigatório.' }
    ]
  };

  // ==========================================
  // Construtor com Lógica Reativa (Effect)
  // ==========================================
  constructor() {
    effect(() => {
      const submitting = this.isSubmitting();

      if (!this.updateAccountabilityForm) return;

      if (submitting) {
        this.updateAccountabilityForm.disable({ emitEvent: false });
      } else {
        this.updateAccountabilityForm.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const accountabilityId = this.data?.accountability?.id;

    if (this.updateAccountabilityForm.invalid || !accountabilityId) {
      this.updateAccountabilityForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.updateAccountabilityForm.getRawValue();

    this.accountabilityService.updateAccountability(accountabilityId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Prestação de contas atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao atualizar a prestação de contas.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const accountability = this.data?.accountability;

    this.updateAccountabilityForm = this.fb.group({
      name: [accountability?.name ?? null, [Validators.required]]
    });
  }
}