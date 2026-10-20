import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

// Core, Services & Models
import { Payment } from '../../../models/payment.model';

export type PaymentRequirementDialogData = {
  payment?: Payment;
};

interface RequirementItem {
  label: string;
  fulfilled?: boolean;
}

@Component({
  selector: 'app-payment-requirement',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatListModule
  ],
  templateUrl: './payment-requirement.component.html',
  styleUrl: './payment-requirement.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentRequirementComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PaymentRequirementDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Computed Properties (Consolidação de Dados)
  // ==========================================
  private readonly rawData = computed(() => this.data?.payment || null);

  protected readonly requirements = computed<RequirementItem[]>(() => {
    const payment = this.rawData();
    if (!payment) return [];

    const items: RequirementItem[] = [
      {
        label: 'Número do Sigadoc',
        fulfilled: this.hasValue(payment.sigadoc) 
      },
      {
        label: 'Registro do Credor (FIPLAN)',
        fulfilled: this.hasValue(payment.creditor)
      },
      {
        label: 'Número do documento',
        fulfilled: this.hasValue(payment.document_number)
      },
    ];

    return items;
  });

  // ==========================================
  // Métodos Auxiliares Privados
  // ==========================================
  private hasValue(value?: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (typeof value === 'number') return !isNaN(value);
    return true;
  }
}