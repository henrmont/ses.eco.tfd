import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Services & Models
import { BudgetAllocation } from '../../../models/budget-allocation.model';
import { SettingService } from '../../../services/setting.service';
import { BudgetAllocationUpdateComponent } from '../budget-allocation-update/budget-allocation-update.component';

const TFD_SETTINGS_CHANNEL = new BroadcastChannel('tfd-settings-channel');

@Component({
  selector: 'app-budget-allocation',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatCardModule, 
    MatIconModule, 
    MatButtonModule, 
    MatProgressSpinnerModule, 
    MatTooltipModule
  ],
  templateUrl: './budget-allocation.component.html',
  styleUrl: './budget-allocation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BudgetAllocationComponent implements OnInit, OnDestroy {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly settingService = inject(SettingService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly budgetAllocation = signal<BudgetAllocation | null>(null);
  protected readonly isLoading = signal<boolean>(true);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchBudgetAllocation();

    TFD_SETTINGS_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update_budget') {
        this.fetchBudgetAllocation();
      }
    };
  }

  ngOnDestroy(): void {
    TFD_SETTINGS_CHANNEL.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected budgetAllocationUpdate(budgetAllocation: BudgetAllocation): void {
    this.openDialog(BudgetAllocationUpdateComponent, { budget_allocation: budgetAllocation });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchBudgetAllocation(): void {
    this.isLoading.set(true);

    this.settingService.getBudgetAllocation()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.budgetAllocation.set(response || null);
        },
        error: () => {
          this.budgetAllocation.set(null);
        }
      });
  }

  private openDialog<T>(
    component: new (...args: any[]) => T,
    data: { budget_allocation: BudgetAllocation },
    width = '600px',
    height = 'auto',
    requiresRefresh = true
  ): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      data
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && requiresRefresh) {
          this.handleDataChange();
        }
      });
  }

  private handleDataChange(): void {
    this.fetchBudgetAllocation();
    TFD_SETTINGS_CHANNEL.postMessage('update_budget');
  }
}