import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { finalize } from 'rxjs';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestCostAssistance } from '../../../models/patient-request-cost-assistance.model';
import { PatientRequest } from '../../../models/patient-request.model';
import { Role } from '../../../../core/models/role.model';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';

// Modais do Contexto de Ajudas de Custo
import { CostAssistanceDailiesComponent } from '../cost-assistance-dailies/cost-assistance-dailies.component';
import { PatientRequestCostAssistanceCreateComponent } from '../patient-request-cost-assistance-create/patient-request-cost-assistance-create.component';
import { PatientRequestCostAssistanceDeleteComponent } from '../patient-request-cost-assistance-delete/patient-request-cost-assistance-delete.component';
import { PatientRequestCostAssistanceDetailComponent } from '../patient-request-cost-assistance-detail/patient-request-cost-assistance-detail.component';
import { PatientRequestCostAssistanceUpdateComponent } from '../patient-request-cost-assistance-update/patient-request-cost-assistance-update.component';
import { PatientRequestCostAssistanceRequirementComponent } from '../patient-request-cost-assistance-requirement/patient-request-cost-assistance-requirement.component';

export type PatientRequestCostAssistancesDialogData = {
  patient_request?: PatientRequest;
  cost_assistance?: PatientRequestCostAssistance;
  roles?: Role[];
};

export interface MappedCostAssistance extends PatientRequestCostAssistance {
  totalDailiesNum: number;
}

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
  // Instância do Broadcast Channel
  // ==========================================
  private readonly costAssistancesChannel = new BroadcastChannel('tfd-cost-assistances-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestCostAssistancesDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'type', 'created_at', 'dailies', 'status', 'actions'];
  protected readonly costAssistancesList = signal<PatientRequestCostAssistance[]>([]);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly totalValue = signal<number>(0);
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

  // Define dinamicamente as colunas do rodapé
  protected readonly footerColumns = computed(() =>
    this.costAssistancesList().length > 0 ? this.displayedColumns : []
  );

  // Verifica se existe ajuda de custo do tipo "Inicial"
  protected readonly hasInitialCostAssistance = computed(() =>
    this.costAssistancesList().some(item => item.type === 'Inicial')
  );

  private readonly requestId = computed(() => this.data?.patient_request?.id ?? null);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchCostAssistances(true);
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
  protected patientRequestCostAssistanceCreate(): void {
    this.openDialog(PatientRequestCostAssistanceCreateComponent, {
      patient_request: {
        ...this.data?.patient_request,
        has_initial_cost_assistance: this.hasInitialCostAssistance()
      }
    }, '800px');
  }

  protected patientRequestCostAssistanceDetail(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(PatientRequestCostAssistanceDetailComponent, { cost_assistance: costAssistance }, '800px', 'auto', false);
  }

  protected patientRequestCostAssistanceUpdate(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(PatientRequestCostAssistanceUpdateComponent, { cost_assistance: costAssistance }, '800px');
  }

  protected patientRequestCostAssistanceDelete(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(PatientRequestCostAssistanceDeleteComponent, { cost_assistance: costAssistance }, '400px', 'auto', true);
  }

  protected costAssistanceDailies(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(CostAssistanceDailiesComponent, { cost_assistance: costAssistance, roles: this.data?.roles }, '1000px', 'auto', true);
  }

  protected patientRequestCostAssistanceRequirement(costAssistance: PatientRequestCostAssistance): void {
    this.openDialog(PatientRequestCostAssistanceRequirementComponent, { cost_assistance: costAssistance }, '500px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchCostAssistances(showLoading = false): void {
    const currentRequestId = this.requestId();

    if (!currentRequestId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.fetchBalance();

    this.costAssistanceService.getCostAssistances(currentRequestId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response) ? response : (response?.data || []);
          this.costAssistancesList.set(items);
          this.dataSource.data = items;
        },
        error: (err) => {
          this.costAssistancesList.set([]);
          this.dataSource.data = [];
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

  private setupBroadcastChannel(): void {
    this.costAssistancesChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchCostAssistances(false);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.costAssistancesChannel.close();
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: PatientRequestCostAssistancesDialogData,
    width = '800px',
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
          this.handleCostAssistanceChange();
        }
      });
  }

  private handleCostAssistanceChange(): void {
    this.fetchCostAssistances(false);
    this.costAssistancesChannel.postMessage('update');
  }
}