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

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { PaymentService } from '../../../services/payment.service';

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
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './payment-update.component.html',
  styleUrl: './payment-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly paymentService = inject(PaymentService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PaymentUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Formulário Principal
  // ==========================================
  protected updatePaymentForm!: FormGroup;

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Dicionário de Mensagens de Erro
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
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
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Inicialização do Formulário
  // ==========================================
  private initForm(): void {
    const payment = this.data?.payment;

    this.updatePaymentForm = this.fb.group({
      sigadoc: [payment?.sigadoc ?? null, [Validators.required]],
      creditor: [payment?.creditor ?? null, [Validators.required]],
      document_number: [payment?.document_number ?? null, [Validators.required]]
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
          this.updatePaymentForm.disable({ emitEvent: false });
        } else {
          this.updatePaymentForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Submissão do Formulário
  // ==========================================
  /**
   * Submete o formulário para atualização do pagamento.
   */
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

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.updatePaymentForm.getRawValue();

    this.paymentService.updatePayment(paymentId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Pagamento atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao atualizar o pagamento.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}