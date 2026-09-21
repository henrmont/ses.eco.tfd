import { CommonModule } from '@angular/common';
import { 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  Component, 
  DestroyRef, 
  Injector, 
  OnInit, 
  inject, 
  signal 
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

// Angular Material e Módulos Externos
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { NgxMaskDirective } from 'ngx-mask';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { DailyCost } from '../../../models/daily-cost.model';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

@Component({
  selector: 'app-cost-assistance-daily-update',
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
    MatProgressSpinnerModule,
    NgxMaskDirective
  ],
  templateUrl: './cost-assistance-daily-update.component.html',
  styleUrl: './cost-assistance-daily-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CostAssistanceDailyUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<CostAssistanceDailyUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Formulário Principal
  // ==========================================
  protected updateCostAssistanceDailyForm!: FormGroup;

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly dailyCostsOptions = signal<DailyCost[]>([]);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isLoadingOptions = signal<boolean>(true);

  // ==========================================
  // Dicionário de Mensagens de Erro
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    daily_cost_id: [
      { type: 'required', message: 'O tipo de diária é obrigatório.' }
    ],
    amount: [
      { type: 'required', message: 'A quantidade é obrigatória.' },
      { type: 'min', message: 'A quantidade mínima deve ser igual a 1.' }
    ]
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
    this.fetchDailyCosts();
  }

  // ==========================================
  // Inicialização do Formulário
  // ==========================================
  private initForm(): void {
    const daily = this.data?.cost_assistance_daily;

    this.updateCostAssistanceDailyForm = this.fb.group({
      daily_cost_id: [daily?.daily_cost_id ?? null, [Validators.required]],
      amount: [daily?.amount ?? null, [Validators.required, Validators.min(1)]]
    });
  }

  // ==========================================
  // Handlers Reativos
  // ==========================================
  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.updateCostAssistanceDailyForm.disable({ emitEvent: false });
        } else {
          this.updateCostAssistanceDailyForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Helpers e Métodos Auxiliares
  // ==========================================
  /**
   * Busca as opções de tipos de diária disponíveis no sistema.
   */
  private fetchDailyCosts(): void {
    this.costAssistanceService.getDailyCosts()
      .pipe(
        finalize(() => {
          this.isLoadingOptions.set(false);
          this.cdr.markForCheck();
        }),
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

  // ==========================================
  // Submissão do Formulário
  // ==========================================
  protected onSubmit(): void {
    const dailyId = this.data?.cost_assistance_daily?.id;

    if (!dailyId) {
      this.messageService.showMessage('Identificador da diária não encontrado.');
      return;
    }

    if (this.updateCostAssistanceDailyForm.invalid) {
      this.updateCostAssistanceDailyForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.updateCostAssistanceDailyForm.getRawValue();

    this.costAssistanceService.updateCostAssistanceDaily(dailyId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Diária atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao atualizar a diária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}