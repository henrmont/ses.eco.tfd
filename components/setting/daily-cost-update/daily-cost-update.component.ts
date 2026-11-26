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
import { NgxMaskDirective } from 'ngx-mask';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';

// Services & Models
import { DailyCost } from '../../../models/daily-cost.model';
import { SettingService } from '../../../services/setting.service';

export interface DailyCostUpdateDialogData {
  daily_cost?: DailyCost;
}

interface ErrorMessage {
  type: string;
  message: string;
}

interface DailyCostUpdateForm {
  value: FormControl<number | string>;
}

@Component({
  selector: 'app-daily-cost-update',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NgxMaskDirective,
    ReactiveFormsModule,
  ],
  templateUrl: './daily-cost-update.component.html',
  styleUrl: './daily-cost-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyCostUpdateComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<DailyCostUpdateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly settingService = inject(SettingService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<DailyCostUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly dailyCostForm: FormGroup<DailyCostUpdateForm>;
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    value: [
      { type: 'required', message: 'O valor é obrigatório.' },
      { type: 'min', message: 'O valor deve ser maior que zero.' },
    ],
  };

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get dailyCostName(): string {
    return this.data?.daily_cost?.name || 'Diária';
  }

  constructor() {
    const initialValue = this.data?.daily_cost?.value ?? '';

    this.dailyCostForm = this.fb.group<DailyCostUpdateForm>({
      value: this.fb.control<number | string>(initialValue, [
        Validators.required,
        Validators.min(0.01),
      ]),
    });

    effect(() => {
      if (this.isSubmitting()) {
        this.dailyCostForm.disable({ emitEvent: false });
      } else {
        this.dailyCostForm.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const dailyCostId = this.data?.daily_cost?.id;

    if (!dailyCostId) {
      this.messageService.showMessage('Identificador do custo de diária inválido.');
      return;
    }

    if (this.dailyCostForm.invalid || this.isSubmitting()) {
      this.dailyCostForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.dailyCostForm.getRawValue() as Partial<DailyCost>;

    this.settingService
      .updateDailyCost(dailyCostId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(
            response?.message || 'Custo de diária atualizado com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar o custo da diária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}