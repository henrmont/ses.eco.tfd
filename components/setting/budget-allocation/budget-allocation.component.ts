import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models
import { Permission } from '../../../../core/models/permission.model';
import { Role } from '../../../../core/models/role.model';
import { AuthService } from '../../../../core/services/auth.service';
import { BudgetAllocation } from '../../../models/budget-allocation.model';
import { TfdUser as User } from '../../../models/user.model';
import { SettingService } from '../../../services/setting.service';

// Dialog Components
import { BudgetAllocationUpdateComponent } from '../budget-allocation-update/budget-allocation-update.component';

// ============================================================================
// CONFIGURAÇÃO DO MÓDULO (Único bloco a ajustar ao replicar para outro módulo)
// ============================================================================
const PAGE_CONFIG = {
  channelName: 'tfd-settings-channel',
  channelEvent: 'update_budget',
  permissionPrefix: 'tfd/',
} as const;

interface BudgetAllocationDialogData {
  budget_allocation: BudgetAllocation;
}

@Component({
  selector: 'app-budget-allocation',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './budget-allocation.component.html',
  styleUrl: './budget-allocation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetAllocationComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly settingsChannel = new BroadcastChannel(PAGE_CONFIG.channelName);

  // Injeção de Dependências
  private readonly settingService = inject(SettingService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // Estado e Controle Reativo
  private readonly currentUser = computed(() => this.authService.currentUser() as User | null);

  private readonly userPermissions = computed<Set<string>>(() => {
    const roles = this.currentUser()?.roles || [];
    return new Set<string>(
      roles
        .flatMap((role: Role) => role.permissions || [])
        .map((perm: Permission) => perm.name?.trim().toLowerCase())
        .filter((name): name is string => Boolean(name))
    );
  });

  protected readonly budgetAllocation = signal<BudgetAllocation | null>(null);
  protected readonly isLoading = signal<boolean>(true);

  ngOnInit(): void {
    this.fetchBudgetAllocation(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.settingsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis no Template
  // ==========================================
  /**
   * Retorna `true` quando o botão deve ficar DESABILITADO (`[disabled]="checkPermissions('...')"`)
   */
  protected checkPermissions(permissionName: string): boolean {
    const permissions = this.userPermissions();
    if (permissions.size === 0) return true;

    const target = permissionName.trim().toLowerCase();
    const hasPermission =
      permissions.has(target) ||
      permissions.has(`${PAGE_CONFIG.permissionPrefix}${target}`);

    return !hasPermission;
  }

  protected budgetAllocationUpdate(budgetAllocation: BudgetAllocation): void {
    this.openDialog(BudgetAllocationUpdateComponent, { budget_allocation: budgetAllocation });
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private fetchBudgetAllocation(showLoading = false): void {
    if (showLoading) this.isLoading.set(true);

    this.settingService
      .getBudgetAllocation()
      .pipe(
        finalize(() => {
          if (showLoading) this.isLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.budgetAllocation.set(response || null);
        },
        error: () => {
          this.budgetAllocation.set(null);
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.settingsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === PAGE_CONFIG.channelEvent) {
        this.fetchBudgetAllocation(false);
      }
    };
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: BudgetAllocationDialogData,
    width = '600px',
    height = 'auto',
    requiresRefresh = true
  ): void {
    this.dialog
      .open(component, {
        width,
        height,
        disableClose: true,
        autoFocus: false,
        scrollStrategy: this.overlay.scrollStrategies.noop(),
        data,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && requiresRefresh) {
          this.handleDataChange();
        }
      });
  }

  private handleDataChange(): void {
    this.fetchBudgetAllocation(false);
    this.settingsChannel.postMessage(PAGE_CONFIG.channelEvent);
  }
}