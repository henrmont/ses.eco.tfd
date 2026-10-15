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
import { finalize } from 'rxjs/operators';

// Angular Material e Módulos Externos
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { NgxMaskDirective } from 'ngx-mask';

// Services, Models & Interfaces
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { AccountabilityDaily } from '../../../models/accountability-daily.model';
import { DailyCost } from '../../../models/daily-cost.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type AccountabilityDailyUpdateDialogData = {
  accountability_daily?: AccountabilityDaily;
};

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-accountability-daily-update',
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
  templateUrl: './accountability-daily-update.component.html',
  styleUrl: './accountability-daily-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountabilityDailyUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<AccountabilityDailyUpdateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<AccountabilityDailyUpdateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected updateAccountabilityDailyForm!: FormGroup;

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

      if (!this.updateAccountabilityDailyForm) return;

      if (submitting) {
        this.updateAccountabilityDailyForm.disable({ emitEvent: false });
      } else {
        this.updateAccountabilityDailyForm.enable({ emitEvent: false });
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
    const dailyId = this.data?.accountability_daily?.id;

    if (!dailyId) {
      this.messageService.showMessage('Identificador da diária não encontrado.');
      return;
    }

    if (this.updateAccountabilityDailyForm.invalid) {
      this.updateAccountabilityDailyForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.updateAccountabilityDailyForm.getRawValue();

    this.accountabilityService.updateAccountabilityDaily(dailyId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Diária atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao atualizar a diária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const daily = this.data?.accountability_daily;

    this.updateAccountabilityDailyForm = this.fb.group({
      daily_cost_id: [daily?.daily_cost_id ?? null, [Validators.required]],
      amount: [daily?.amount ?? null, [Validators.required, Validators.min(1)]]
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