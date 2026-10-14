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
import { CostAssistanceDaily } from '../../../models/cost-assistance-daily.model';
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';
import { Role } from '../../../models/role.model';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

// Modais do Contexto de Diárias
import { CostAssistanceDailyCreateComponent } from '../cost-assistance-daily-create/cost-assistance-daily-create.component';
import { CostAssistanceDailyDeleteComponent } from '../cost-assistance-daily-delete/cost-assistance-daily-delete.component';
import { CostAssistanceDailyUpdateComponent } from '../cost-assistance-daily-update/cost-assistance-daily-update.component';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type CostAssistanceDailiesDialogData = {
  cost_assistance?: PatientRequestCostAssistance;
  cost_assistance_daily?: CostAssistanceDaily;
  roles?: Role[];
};

export interface MappedCostAssistanceDaily extends CostAssistanceDaily {
  partial: number;
}

@Component({
  selector: 'app-cost-assistance-dailies',
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
  templateUrl: './cost-assistance-dailies.component.html',
  styleUrl: './cost-assistance-dailies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CostAssistanceDailiesComponent implements OnInit {
  // ==========================================
  // Instância do Broadcast Channel
  // ==========================================
  private readonly costAssistancesChannel = new BroadcastChannel('tfd-cost-assistances-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<CostAssistanceDailiesDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'value', 'amount', 'partial', 'actions'];
  protected readonly dailiesList = signal<CostAssistanceDaily[]>([]);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly dataSource = new MatTableDataSource<MappedCostAssistanceDaily>([]);

  // Mapeia a lista adicionando o valor computado 'partial' (subtotal) individual
  protected readonly mappedDailies = computed<MappedCostAssistanceDaily[]>(() =>
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

  private readonly costAssistanceId = computed(() => this.data?.cost_assistance?.id ?? null);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchCostAssistanceDailies(true);
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
  protected costAssistanceDailyCreate(): void {
    this.openDialog(CostAssistanceDailyCreateComponent, { cost_assistance: this.data?.cost_assistance }, '500px');
  }

  protected costAssistanceDailyUpdate(costAssistanceDaily: CostAssistanceDaily): void {
    this.openDialog(CostAssistanceDailyUpdateComponent, { cost_assistance_daily: costAssistanceDaily }, '500px');
  }

  protected costAssistanceDailyDelete(costAssistanceDaily: CostAssistanceDaily): void {
    this.openDialog(CostAssistanceDailyDeleteComponent, { cost_assistance_daily: costAssistanceDaily }, '400px');
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchCostAssistanceDailies(showLoading = false): void {
    const currentCostAssistanceId = this.costAssistanceId();

    if (!currentCostAssistanceId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.costAssistanceService.getCostAssistanceDailies(currentCostAssistanceId)
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
          const fallbackError = 'Não foi possível carregar as diárias da ajuda de custo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private setupBroadcastChannel(): void {
    this.costAssistancesChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchCostAssistanceDailies(false);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.costAssistancesChannel.close();
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: CostAssistanceDailiesDialogData,
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
    this.fetchCostAssistanceDailies(false);
    this.costAssistancesChannel.postMessage('update');
  }
}