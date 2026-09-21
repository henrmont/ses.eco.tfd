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
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Services & Models
import { DailyCost } from '../../../models/daily-cost.model';
import { SettingService } from '../../../services/setting.service';
import { DailyCostUpdateComponent } from '../daily-cost-update/daily-cost-update.component';

const TFD_SETTINGS_CHANNEL = new BroadcastChannel('tfd-settings-channel');

@Component({
  selector: 'app-dailies-cost',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatCardModule, 
    MatListModule, 
    MatIconModule, 
    MatButtonModule, 
    MatProgressSpinnerModule, 
    MatTooltipModule
  ],
  templateUrl: './dailies-cost.component.html',
  styleUrl: './dailies-cost.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DailiesCostComponent implements OnInit, OnDestroy {
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
  protected readonly dailiesCost = signal<DailyCost[]>([]);
  protected readonly isLoading = signal<boolean>(true);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchDailiesCost();

    TFD_SETTINGS_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update_dailies') {
        this.fetchDailiesCost();
      }
    };
  }

  ngOnDestroy(): void {
    TFD_SETTINGS_CHANNEL.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected updateDailyCost(dailyCost: DailyCost): void {
    this.openDialog(DailyCostUpdateComponent, { daily_cost: dailyCost });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchDailiesCost(): void {
    this.isLoading.set(true);

    this.settingService.getDailiesCost()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.dailiesCost.set(response || []);
        },
        error: () => {
          this.dailiesCost.set([]);
        }
      });
  }

  private openDialog<T>(
    component: new (...args: any[]) => T,
    data: { daily_cost: DailyCost },
    width = '400px',
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
    this.fetchDailiesCost();
    TFD_SETTINGS_CHANNEL.postMessage('update_dailies');
  }
}