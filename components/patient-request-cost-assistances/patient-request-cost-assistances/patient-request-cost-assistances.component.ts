import { ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
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
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';
import { Permission } from '../../../models/permission.model';
import { Role } from '../../../models/role.model';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

// Modais do Contexto de Ajudas de Custo
import { CostAssistanceDailiesComponent } from '../cost-assistance-dailies/cost-assistance-dailies.component';
import { PatientRequestCostAssistanceCreateComponent } from '../patient-request-cost-assistance-create/patient-request-cost-assistance-create.component';
import { PatientRequestCostAssistanceDeleteComponent } from '../patient-request-cost-assistance-delete/patient-request-cost-assistance-delete.component';
import { PatientRequestCostAssistanceDetailComponent } from '../patient-request-cost-assistance-detail/patient-request-cost-assistance-detail.component';
import { PatientRequestCostAssistanceUpdateComponent } from '../patient-request-cost-assistance-update/patient-request-cost-assistance-update.component';
import { PatientRequest } from '../../../models/patient-request.model';

// Define o tipo aceito para os dados do modal de ajudas de custo
type CostAssistanceDialogData =
  | { patient_request: PatientRequest }
  | { cost_assistance: PatientRequestCostAssistance; permissions?: Role[] };

// Interface estendida para cálculos ou propriedades mapeadas da lista
interface MappedCostAssistance extends PatientRequestCostAssistance {
  totalDailiesNum: number;
}

// Constantes Locais
const TFD_COST_ASSISTANCES_CHANNEL = new BroadcastChannel('tfd-cost-assistances-channel');

@Component({
  selector: 'app-patient-request-cost-assistances',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-cost-assistances.component.html',
  styleUrl: './patient-request-cost-assistances.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestCostAssistancesComponent implements OnInit {
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
  protected readonly displayedColumns: string[] = ['name', 'type', 'created_at', 'dailies', 'status', 'actions'];
  protected readonly costAssistancesList = signal<PatientRequestCostAssistance[]>([]);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly totalValue = signal<number>(0);

  // Instância ÚNICA/ESTÁTICA do MatTableDataSource
  protected readonly dataSource = new MatTableDataSource<PatientRequestCostAssistance>([]);

  // Somatório do total de diárias das ajudas de custo
  protected readonly totalCostAssistances = computed(() =>
    this.costAssistancesList().reduce((acc, item) => acc + (Number(item.total_dailies) || 0), 0)
  );

  // Avalia se existe alguma ajuda de custo cadastrada sem diárias
  protected readonly hasCostAssistanceWithoutDailies = computed(() => {
    const list = this.costAssistancesList();
    if (!list || list.length === 0) return false;

    return list.some((item) => {
      const totalDailies = Number(item.total_dailies) || 0;
      const dailiesArrayLength = Array.isArray(item.dailies) ? item.dailies.length : 0;
      return totalDailies === 0 && dailiesArrayLength === 0;
    });
  });

  // Define dinamicamente as colunas do rodapé. 
  // Retorna as colunas normais se houver itens, ou um array vazio para ocultá-lo sem quebrar o layout.
  protected readonly footerColumns = computed(() =>
    this.costAssistancesList().length > 0 ? this.displayedColumns : []
  );

  // Adicione essa propriedade computada no componente pai:
  protected readonly hasInitialCostAssistance = computed(() =>
    this.costAssistancesList().some(item => item.type === 'Inicial')
  );

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchCostAssistances(true);
    this.listenToBroadcastChannel();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected patientRequestCostAssistanceCreate(): void {
    this.openDialog(PatientRequestCostAssistanceCreateComponent, { patient_request: {...this.data?.patient_request, has_initial_cost_assistance: this.hasInitialCostAssistance()} }, '800px');
  }

  protected patientRequestCostAssistanceDetail(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(PatientRequestCostAssistanceDetailComponent, { cost_assistance: costAssistance }, '800px', 'auto', false, false);
  }

  protected patientRequestCostAssistanceUpdate(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(PatientRequestCostAssistanceUpdateComponent, { cost_assistance: costAssistance }, '800px');
  }

  protected patientRequestCostAssistanceDelete(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(PatientRequestCostAssistanceDeleteComponent, { cost_assistance: costAssistance }, '400px', 'auto', true);
  }

  protected costAssistanceDailies(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(CostAssistanceDailiesComponent, { cost_assistance: costAssistance, permissions: this.data?.permissions }, '1000px', 'auto', true);
  }

  /**
   * Verifica se a permissão informada NÃO existe nos papéis recebidos.
   */
  protected checkPermissions(name: string): boolean {
    const roles = this.data?.permissions || [];
    for (const item of roles) {
      const hasPermission = item.permissions?.some((p: Permission) => p.name === name);
      if (hasPermission) {
        return false;
      }
    }
    return true;
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(() => {
      this.dataSource.data = this.costAssistancesList();
    }, { injector: this.injector });
  }

  private fetchCostAssistances(showLoading = false): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.fetchBalance();

    this.costAssistanceService.getCostAssistances(requestId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response) ? response : (response?.data || []);
          this.costAssistancesList.set(items);
        },
        error: (err) => {
          this.costAssistancesList.set([]);
          const fallbackError = 'Não foi possível carregar as ajudas de custo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private fetchBalance(): void {
    const careId = this.data?.patient_request?.report?.patient_care?.id;

    if (!careId) return;

    this.costAssistanceService.getBalance(careId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          const balanceValue = typeof response === 'number'
            ? response
            : (response?.balance ?? response?.total ?? response?.value ?? 0);

          this.totalValue.set(Number(balanceValue) || 0);
        },
        error: () => {
          this.totalValue.set(0);
        }
      });
  }

  private listenToBroadcastChannel(): void {
    TFD_COST_ASSISTANCES_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchCostAssistances(false);
      }
    };
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: CostAssistanceDialogData,
    width = '800px',
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
            this.fetchCostAssistances(false);
          }

          if (emitGlobalBroadcast) {
            TFD_COST_ASSISTANCES_CHANNEL.postMessage('update');
          }
        }
      });
  }
}