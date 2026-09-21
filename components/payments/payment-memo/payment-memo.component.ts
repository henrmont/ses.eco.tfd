import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Material Modules
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

// Services e Models
import { MessageService } from '../../../../core/services/message-service';
import { PaymentService } from '../../../services/payment.service';

@Component({
  selector: 'app-payment-memo',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconButton,
    MatCardModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './payment-memo.component.html',
  styleUrl: './payment-memo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentMemoComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly paymentService = inject(PaymentService);
  private readonly messageService = inject(MessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Views e Elementos do Template
  // ==========================================
  private readonly memoContent = viewChild<ElementRef<HTMLElement>>('memoContent');

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Métodos Auxiliares
  // ==========================================
  getEscortNames(data: any): string {
    const passengers = data?.payment?.travel?.passengers;

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return 'Não informado';
    }

    const escortNames = passengers
      .filter(p => p?.escort && p?.escort_id)
      .map(p => p.escort.name)
      .filter(name => !!name);

    return escortNames.length > 0 ? escortNames.join(', ') : 'Não informado';
  }

  // ==========================================
  // Ações do Template
  // ==========================================
  /**
   * Copia o conteúdo do memorando mantendo a formatação rica de tabela (HTML)
   * e um fallback legível em texto puro.
   */
  protected onCopyText(): void {
    const contentElement = this.memoContent()?.nativeElement;
    if (!contentElement) return;

    // Clona o conteúdo para não afetar a interface
    const clone = contentElement.cloneNode(true) as HTMLElement;

    // Remove o background de todos os elementos e garante fundo transparente
    const allElements = clone.querySelectorAll<HTMLElement>('*');
    allElements.forEach(el => {
      el.style.backgroundColor = 'transparent';
    });

    // Aplica estilos inline para a tabela
    const tables = clone.querySelectorAll('table');
    tables.forEach(table => {
      table.setAttribute('style', 'border-collapse: collapse; width: 100%; border: 1px solid #000; background-color: transparent;');
    });

    const cells = clone.querySelectorAll('th, td');
    cells.forEach(cell => {
      cell.setAttribute(
        'style',
        'border: 1px solid #000000; padding: 6px 10px; text-align: center; font-family: Arial, sans-serif; font-size: 11pt; background-color: transparent;'
      );
    });

    const headers = clone.querySelectorAll('th');
    headers.forEach(header => {
      header.style.fontWeight = 'bold';
      header.style.backgroundColor = 'transparent';
    });

    // Cria um container temporário fora da tela
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.appendChild(clone);
    document.body.appendChild(container);

    // Seleciona e executa a cópia
    const range = document.createRange();
    range.selectNodeContents(container);

    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.messageService.showMessage('Memorando copiado para a área de transferência!');
      } else {
        navigator.clipboard.writeText(contentElement.innerText);
        this.messageService.showMessage('Texto do memorando copiado!');
      }
    } catch (err) {
      navigator.clipboard.writeText(contentElement.innerText);
      this.messageService.showMessage('Texto do memorando copiado!');
    } finally {
      if (selection) {
        selection.removeAllRanges();
      }
      document.body.removeChild(container);
    }
  }

  /**
   * Realiza o download do PDF do memorando
   */
  protected downloadMemoPdf(): void {
    const paymentId = this.data?.payment?.id;

    if (!paymentId) {
      this.messageService.showMessage('Erro: Identificador do pagamento não encontrado.');
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    this.paymentService.downloadMemoPdf(paymentId)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (blobData: Blob) => {
          const file = new Blob([blobData], { type: 'application/pdf' });
          const fileURL = URL.createObjectURL(file);

          const anchor = document.createElement('a');
          anchor.href = fileURL;
          anchor.download = `memorando_${this.data?.payment?.document_number || paymentId}.pdf`;
          anchor.click();

          URL.revokeObjectURL(fileURL);
          this.messageService.showMessage('Download do PDF iniciado com sucesso!');
        },
        error: err => {
          const fallbackError = 'Erro ao tentar realizar o download do memorando.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}