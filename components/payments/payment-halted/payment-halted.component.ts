import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services e Models
import { MessageService } from '../../../../core/services/message-service';
import { PaymentService } from '../../../services/payment.service';

@Component({
  selector: 'app-payment-halted',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './payment-halted.component.html',
  styleUrl: './payment-halted.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentHaltedComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly paymentService = inject(PaymentService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PaymentHaltedComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Submissão / Sobrestamento
  // ==========================================
  /**
   * Dispara a requisição para paralisar/sobrestar a solicitação
   */
  protected onSubmit(): void {
    const paymentId = this.data?.payment?.id;

    if (!paymentId) {
      this.messageService.showMessage('Erro: Identificador da solicitação não encontrado.');
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.paymentService.haltedPayment(paymentId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Status de sobrestamento atualizado!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro operacional ao atualizar o sobrestamento.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}