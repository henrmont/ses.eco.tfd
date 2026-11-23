import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';

// Services & Models
import { BudgetAllocation } from '../../../models/budget-allocation.model';
import { SettingService } from '../../../services/setting.service';

export interface BudgetAllocationUpdateDialogData {
  budget_allocation?: BudgetAllocation;
}

interface ErrorMessage {
  type: string;
  message: string;
}

interface BudgetAllocationUpdateForm {
  program: FormControl<string>;
  active_project: FormControl<string>;
  nature_of_expenditure: FormControl<string>;
  source: FormControl<string>;
}

@Component({
  selector: 'app-budget-allocation-update',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './budget-allocation-update.component.html',
  styleUrl: './budget-allocation-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetAllocationUpdateComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<BudgetAllocationUpdateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly settingService = inject(SettingService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<BudgetAllocationUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly budgetAllocationForm: FormGroup<BudgetAllocationUpdateForm>;
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    program: [
      { type: 'required', message: 'O programa é obrigatório.' },
    ],
    active_project: [
      { type: 'required', message: 'O projeto ativo é obrigatório.' },
    ],
    nature_of_expenditure: [
      { type: 'required', message: 'A natureza da despesa é obrigatória.' },
    ],
    source: [
      { type: 'required', message: 'A fonte é obrigatória.' },
    ],
  };

  constructor() {
    const budget = this.data?.budget_allocation;

    this.budgetAllocationForm = this.fb.group<BudgetAllocationUpdateForm>({
      program: this.fb.control(budget?.program || '', [Validators.required]),
      active_project: this.fb.control(budget?.active_project || '', [Validators.required]),
      nature_of_expenditure: this.fb.control(budget?.nature_of_expenditure || '', [Validators.required]),
      source: this.fb.control(budget?.source || '', [Validators.required]),
    });

    effect(() => {
      if (this.isSubmitting()) {
        this.budgetAllocationForm.disable({ emitEvent: false });
      } else {
        this.budgetAllocationForm.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const budgetId = this.data?.budget_allocation?.id;

    if (!budgetId) {
      this.messageService.showMessage('Identificador da alocação orçamentária inválido.');
      return;
    }

    if (this.budgetAllocationForm.invalid || this.isSubmitting()) {
      this.budgetAllocationForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.budgetAllocationForm.getRawValue() as Partial<BudgetAllocation>;

    this.settingService
      .updateBudgetAllocation(budgetId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(
            response?.message || 'Alocação orçamentária atualizada com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar a alocação orçamentária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}