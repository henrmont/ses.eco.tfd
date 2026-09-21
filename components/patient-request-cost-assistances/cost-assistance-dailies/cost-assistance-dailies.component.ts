import { ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
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
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

// Modais do Contexto de Diárias
import { CostAssistanceDailyCreateComponent } from '../cost-assistance-daily-create/cost-assistance-daily-create.component';
import { CostAssistanceDailyDeleteComponent } from '../cost-assistance-daily-delete/cost-assistance-daily-delete.component';
import { CostAssistanceDailyUpdateComponent } from '../cost-assistance-daily-update/cost-assistance-daily-update.component';
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';

// Define o tipo aceito para os dados dos modais do contexto
type CostAssistanceDailiesDialogData =
  | { cost_assistance: PatientRequestCostAssistance }
  | { cost_assistance_daily: CostAssistanceDaily };

// Constantes Locais
const TFD_COST_ASSISTANCES_CHANNEL = new BroadcastChannel('tfd-cost-assistances-channel');

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
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'value', 'amount', 'partial', 'actions'];
  protected readonly dailiesList = signal<CostAssistanceDaily[]>([]);
  protected readonly isLoading = signal<boolean>(true);

  // Instância ÚNICA/ESTÁTICA do MatTableDataSource
  protected readonly dataSource = new MatTableDataSource<CostAssistanceDaily>([]);

  // Mapeia a lista adicionando o valor computado 'partial' (subtotal) individual de forma reativa
  protected readonly mappedDailies = computed(() =>
    this.dailiesList().map(item => ({
      ...item,
      partial: (Number(item.amount) || 0) * (Number(item.daily_cost?.value) || 0)
    }))
  );

  // Computado que define se o rodapé deve exibir as colunas ou ficar escondido quando a lista estiver vazia
  protected readonly footerColumns = computed(() =>
    this.dailiesList().length > 0 ? this.displayedColumns : []
  );

  // Calcula o valor total global somando todos os parciais de maneira limpa e reativa
  protected readonly totalValue = computed(() =>
    this.mappedDailies().reduce((acc, item) => acc + item.partial, 0)
  );

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchCostAssistanceDailies(true);
    this.listenToBroadcastChannel();
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
  private setupTableBindings(): void {
    effect(() => {
      this.dataSource.data = this.mappedDailies();
    }, { injector: this.injector });
  }

  private fetchCostAssistanceDailies(showLoading = false): void {
    const costAssistanceId = this.data?.cost_assistance?.id;

    if (!costAssistanceId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.costAssistanceService.getCostAssistanceDailies(costAssistanceId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response) ? response : (response?.data || []);
          this.dailiesList.set(items);
        },
        error: (err) => {
          this.dailiesList.set([]);
          const fallbackError = 'Não foi possível carregar as diárias da ajuda de custo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private listenToBroadcastChannel(): void {
    TFD_COST_ASSISTANCES_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchCostAssistanceDailies(false);
      }
    };
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: CostAssistanceDailiesDialogData,
    width = '500px',
    height = 'auto',
    requiresRefresh = true,
    emitGlobalBroadcast = true
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
        if (result) {
          if (requiresRefresh) {
            this.fetchCostAssistanceDailies(false);
          }

          if (emitGlobalBroadcast) {
            TFD_COST_ASSISTANCES_CHANNEL.postMessage('update');
          }
        }
      });
  }
}