import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { NgxMaskDirective } from 'ngx-mask';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { DailyCost } from '../../../models/daily-cost.model';
import { SettingService } from '../../../services/setting.service';

@Component({
  selector: 'app-daily-cost-update',
  standalone: true,
  imports: [
    ReactiveFormsModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatProgressSpinnerModule, 
    MatIconModule, 
    NgxMaskDirective
  ],
  templateUrl: './daily-cost-update.component.html',
  styleUrl: './daily-cost-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DailyCostUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly settingService = inject(SettingService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<DailyCostUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected dailyCostForm!: FormGroup;
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    value: [
      { type: 'required', message: 'O valor é obrigatório.' },
      { type: 'min', message: 'O valor deve ser maior que zero.' }
    ]
  };

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
    const dailyCostId = this.data?.daily_cost?.id;

    if (!dailyCostId) {
      this.messageService.showMessage('Identificador do custo de diária inválido.');
      return;
    }

    if (this.dailyCostForm.invalid) {
      this.dailyCostForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.settingService.updateDailyCost(dailyCostId, this.dailyCostForm.getRawValue())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Custo de diária atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar o custo da diária.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const dailyCost = this.data?.daily_cost;

    this.dailyCostForm = this.fb.group({
      value: [dailyCost?.value ?? '', [Validators.required, Validators.min(0.01)]]
    });
  }
}