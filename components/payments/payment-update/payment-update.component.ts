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

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Models & Serviços
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { Payment } from '../../../models/payment.model';
import { PaymentService } from '../../../services/payment.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type PaymentUpdateDialogData = {
  payment?: Payment;
};

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-payment-update',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './payment-update.component.html',
  styleUrl: './payment-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PaymentUpdateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<PaymentUpdateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly paymentService = inject(PaymentService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected updatePaymentForm!: FormGroup;

  protected readonly isSubmitting = signal<boolean>(false);

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    sigadoc: [
      { type: 'required', message: 'O número do SIGADOC é obrigatório.' }
    ],
    creditor: [
      { type: 'required', message: 'O código do credor é obrigatório.' }
    ],
    document_number: [
      { type: 'required', message: 'O número do documento é obrigatório.' }
    ]
  };

  // ==========================================
  // Construtor com Lógica Reativa (Effect)
  // ==========================================
  constructor() {
    effect(() => {
      const submitting = this.isSubmitting();

      if (!this.updatePaymentForm) return;

      if (submitting) {
        this.updatePaymentForm.disable({ emitEvent: false });
      } else {
        this.updatePaymentForm.enable({ emitEvent: false });
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
    const paymentId = this.data?.payment?.id;

    if (!paymentId) {
      this.messageService.showMessage('Identificador do pagamento não encontrado.');
      return;
    }

    if (this.updatePaymentForm.invalid) {
      this.updatePaymentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.paymentService.updatePayment(paymentId, this.updatePaymentForm.getRawValue())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Pagamento atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao atualizar o pagamento.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const payment = this.data?.payment;

    this.updatePaymentForm = this.fb.group({
      sigadoc: [payment?.sigadoc ?? null, [Validators.required]],
      creditor: [payment?.creditor ?? null, [Validators.required]],
      document_number: [payment?.document_number ?? null, [Validators.required]]
    });
  }
}