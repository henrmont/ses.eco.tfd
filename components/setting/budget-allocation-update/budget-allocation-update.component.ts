import { ChangeDetectionStrategy, Component, DestroyRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { SettingService } from '../../../services/setting.service';

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
    ReactiveFormsModule
  ],
  templateUrl: './budget-allocation-update.component.html',
  styleUrl: './budget-allocation-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BudgetAllocationUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly settingService = inject(SettingService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<BudgetAllocationUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected budgetAllocationForm!: FormGroup;
  protected readonly isSubmitting = signal<boolean>(false);

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    program: [
      { type: 'required', message: 'O programa é obrigatório.' }
    ],
    active_project: [
      { type: 'required', message: 'O projeto ativo é obrigatório.' }
    ],
    nature_of_expenditure: [
      { type: 'required', message: 'A natureza da despesa é obrigatória.' }
    ],
    source: [
      { type: 'required', message: 'A fonte é obrigatória.' }
    ]
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
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

    if (this.budgetAllocationForm.invalid) {
      this.budgetAllocationForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.settingService.updateBudgetAllocation(budgetId, this.budgetAllocationForm.getRawValue())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Alocação orçamentária atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar a alocação orçamentária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private initForm(): void {
    const budget = this.data?.budget_allocation;

    this.budgetAllocationForm = this.fb.group({
      program: [budget?.program || '', [Validators.required]],
      active_project: [budget?.active_project || '', [Validators.required]],
      nature_of_expenditure: [budget?.nature_of_expenditure || '', [Validators.required]],
      source: [budget?.source || '', [Validators.required]]
    });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.budgetAllocationForm.disable({ emitEvent: false });
        } else {
          this.budgetAllocationForm.enable({ emitEvent: false });
        }
      });
  }
}