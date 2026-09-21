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

// Material Modules e Externos
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
  selector: 'app-cost-assistance-daily-create',
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
  templateUrl: './cost-assistance-daily-create.component.html',
  styleUrl: './cost-assistance-daily-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CostAssistanceDailyCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<CostAssistanceDailyCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
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
  // Estados Reativos via Signals
  // ==========================================
  protected readonly dailyCostsOptions = signal<DailyCost[]>([]);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isLoadingOptions = signal<boolean>(true);

  // ==========================================
  // FormGroups
  // ==========================================
  protected createCostAssistanceDailyForm!: FormGroup;

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
    this.createCostAssistanceDailyForm = this.fb.group({
      daily_cost_id: [null, [Validators.required]],
      amount: [null, [Validators.required, Validators.min(1)]]
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
          this.createCostAssistanceDailyForm.disable({ emitEvent: false });
        } else {
          this.createCostAssistanceDailyForm.enable({ emitEvent: false });
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
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const costAssistanceId = this.data?.cost_assistance?.id;

    if (this.createCostAssistanceDailyForm.invalid || !costAssistanceId) {
      this.createCostAssistanceDailyForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.createCostAssistanceDailyForm.getRawValue();

    this.costAssistanceService.createCostAssistanceDaily(costAssistanceId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Diária adicionada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao vincular a diária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}