import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { AccountabilityDaily } from '../../../models/accountability-daily.model';
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';
import { Role } from '../../../../core/models/role.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

// Modais do Contexto de Diárias da Prestação de Contas
import { AccountabilityDailyCreateComponent } from '../accountability-daily-create/accountability-daily-create.component';
import { AccountabilityDailyDeleteComponent } from '../accountability-daily-delete/accountability-daily-delete.component';
import { AccountabilityDailyUpdateComponent } from '../accountability-daily-update/accountability-daily-update.component';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type AccountabilityDailiesDialogData = {
  accountability?: PatientRequestAccountability;
  accountability_daily?: AccountabilityDaily;
  roles?: Role[];
};

export interface MappedAccountabilityDaily extends AccountabilityDaily {
  partial: number;
}

@Component({
  selector: 'app-accountability-dailies',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './accountability-dailies.component.html',
  styleUrl: './accountability-dailies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountabilityDailiesComponent implements OnInit {
  // ==========================================
  // Instância do Broadcast Channel
  // ==========================================
  private readonly accountabilitiesChannel = new BroadcastChannel('tfd-accountabilities-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<AccountabilityDailiesDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'value', 'amount', 'partial', 'actions'];
  protected readonly dailiesList = signal<AccountabilityDaily[]>([]);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly dataSource = new MatTableDataSource<MappedAccountabilityDaily>([]);

  // Mapeia a lista adicionando o valor computado 'partial' (subtotal) individual
  protected readonly mappedDailies = computed<MappedAccountabilityDaily[]>(() =>
    this.dailiesList().map(item => ({
      ...item,
      partial: (Number(item.amount) || 0) * (Number(item.daily_cost?.value) || 0)
    }))
  );

  // Define dinamicamente as colunas do rodapé
  protected readonly footerColumns = computed(() =>
    this.dailiesList().length > 0 ? this.displayedColumns : []
  );

  // Calcula o valor total global somando todos os parciais
  protected readonly totalValue = computed(() =>
    this.mappedDailies().reduce((acc, item) => acc + item.partial, 0)
  );

  private readonly accountabilityId = computed(() => this.data?.accountability?.id ?? null);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchAccountabilityDailies(true);
  }

  // ==========================================
  // Avaliação de Permissões
  // ==========================================
  protected checkPermissions(permissionName: string): boolean {
    const roles = this.data?.roles || [];
    return !roles.some((role) =>
      role?.permissions?.some((p) => p?.name === permissionName)
    );
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected accountabilityDailyCreate(): void {
    this.openDialog(AccountabilityDailyCreateComponent, { accountability: this.data?.accountability }, '500px');
  }

  protected accountabilityDailyUpdate(accountabilityDaily: AccountabilityDaily): void {
    this.openDialog(AccountabilityDailyUpdateComponent, { accountability_daily: accountabilityDaily }, '500px');
  }

  protected accountabilityDailyDelete(accountabilityDaily: AccountabilityDaily): void {
    this.openDialog(AccountabilityDailyDeleteComponent, { accountability_daily: accountabilityDaily }, '400px');
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchAccountabilityDailies(showLoading = false): void {
    const currentAccountabilityId = this.accountabilityId();

    if (!currentAccountabilityId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.accountabilityService.getAccountabilityDailies(currentAccountabilityId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response) ? response : (response?.data || []);
          this.dailiesList.set(items);
          this.dataSource.data = this.mappedDailies();
        },
        error: (err) => {
          this.dailiesList.set([]);
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar as diárias da prestação de contas.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private setupBroadcastChannel(): void {
    this.accountabilitiesChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchAccountabilityDailies(false);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.accountabilitiesChannel.close();
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: AccountabilityDailiesDialogData,
    width = '500px',
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
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && requiresRefresh) {
          this.handleDailyChange();
        }
      });
  }

  private handleDailyChange(): void {
    this.fetchAccountabilityDailies(false);
    this.accountabilitiesChannel.postMessage('update');
  }
}