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

// Angular Material & Bibliotecas Externas
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { NgxMaskDirective } from 'ngx-mask';

// Core, Models & Serviços
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { DailyCost } from '../../../models/daily-cost.model';
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type AccountabilityDailyCreateDialogData = {
  accountability?: PatientRequestAccountability;
};

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-accountability-daily-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    NgxMaskDirective
  ],
  templateUrl: './accountability-daily-create.component.html',
  styleUrl: './accountability-daily-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountabilityDailyCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<AccountabilityDailyCreateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<AccountabilityDailyCreateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected createAccountabilityDailyForm!: FormGroup;

  protected readonly dailyCostsOptions = signal<DailyCost[]>([]);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isLoadingOptions = signal<boolean>(true);

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    daily_cost_id: [
      { type: 'required', message: 'O tipo de diária é obrigatório.' }
    ],
    amount: [
      { type: 'required', message: 'A quantidade é obrigatória.' },
      { type: 'min', message: 'A quantidade mínima deve ser igual a 1.' }
    ]
  };

  // ==========================================
  // Construtor com Lógica Reativa (Effect)
  // ==========================================
  constructor() {
    effect(() => {
      const submitting = this.isSubmitting();

      if (!this.createAccountabilityDailyForm) return;

      if (submitting) {
        this.createAccountabilityDailyForm.disable({ emitEvent: false });
      } else {
        this.createAccountabilityDailyForm.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.fetchDailyCosts();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const accountabilityId = this.data?.accountability?.id;

    if (this.createAccountabilityDailyForm.invalid || !accountabilityId) {
      this.createAccountabilityDailyForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.createAccountabilityDailyForm.getRawValue();

    this.accountabilityService.createAccountabilityDaily(accountabilityId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Diária adicionada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao vincular a diária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    this.createAccountabilityDailyForm = this.fb.group({
      daily_cost_id: [null, [Validators.required]],
      amount: [null, [Validators.required, Validators.min(1)]]
    });
  }

  /**
   * Busca as opções de tipos de diária disponíveis no sistema.
   */
  private fetchDailyCosts(): void {
    this.accountabilityService.getDailyCosts()
      .pipe(
        finalize(() => this.isLoadingOptions.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response) ? response : (response?.data || []);
          this.dailyCostsOptions.set(items);
        },
        error: () => {
          this.messageService.showMessage('Falha ao carregar as opções de diária.');
        }
      });
  }
}