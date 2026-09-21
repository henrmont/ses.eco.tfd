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
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';
import { PatientRequest } from '../../../models/patient-request.model';
import { Permission } from '../../../models/permission.model';
import { Role } from '../../../models/role.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

// Modais do Contexto de Prestações de Contas
import { AccountabilityDailiesComponent } from '../accountability-dailies/accountability-dailies.component';
import { PatientRequestAccountabilityCreateComponent } from '../patient-request-accountability-create/patient-request-accountability-create.component';
import { PatientRequestAccountabilityDeleteComponent } from '../patient-request-accountability-delete/patient-request-accountability-delete.component';
import { PatientRequestAccountabilityDetailComponent } from '../patient-request-accountability-detail/patient-request-accountability-detail.component';
import { PatientRequestAccountabilityUpdateComponent } from '../patient-request-accountability-update/patient-request-accountability-update.component';

// Define o tipo aceito para os dados dos modais de prestação de contas
type AccountabilityDialogData =
  | { patient_request: PatientRequest }
  | { accountability: PatientRequestAccountability; permissions?: Role[] };

// Constantes Locais
const TFD_ACCOUNTABILITIES_CHANNEL = new BroadcastChannel('tfd-accountabilities-channel');

@Component({
  selector: 'app-patient-request-accountabilities',
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
  templateUrl: './patient-request-accountabilities.component.html',
  styleUrl: './patient-request-accountabilities.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAccountabilitiesComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'created_at', 'dailies', 'status', 'actions'];
  protected readonly accountabilitiesList = signal<PatientRequestAccountability[]>([]);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly totalValue = signal<number>(0);

  // Instância ÚNICA/ESTÁTICA do MatTableDataSource
  protected readonly dataSource = new MatTableDataSource<PatientRequestAccountability>([]);

  // Somatório do montante total de diárias das prestações de contas
  protected readonly totalAccountabilities = computed(() =>
    this.accountabilitiesList().reduce((acc, item) => acc + (Number(item.total_dailies) || 0), 0)
  );

  // Avalia se existe alguma prestação de contas cadastrada sem diárias
  protected readonly hasAccountabilityWithoutDailies = computed(() => {
    const list = this.accountabilitiesList();
    if (!list || list.length === 0) return false;

    return list.some((item) => {
      const totalDailies = Number(item.total_dailies) || 0;
      const dailiesArrayLength = Array.isArray(item.dailies) ? item.dailies.length : 0;
      return totalDailies === 0 && dailiesArrayLength === 0;
    });
  });

  // Define dinamicamente as colunas do rodapé (oculta quando vazio)
  protected readonly footerColumns = computed(() =>
    this.accountabilitiesList().length > 0 ? this.displayedColumns : []
  );

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchAccountabilities(true);
    this.listenToBroadcastChannel();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected patientRequestAccountabilityCreate(): void {
    this.openDialog(PatientRequestAccountabilityCreateComponent, { patient_request: this.data?.patient_request }, '500px');
  }

  protected patientRequestAccountabilityDetail(accountability: PatientRequestAccountability): void {
    this.openDialog(PatientRequestAccountabilityDetailComponent, { accountability }, '800px', 'auto', false, false);
  }

  protected patientRequestAccountabilityUpdate(accountability: PatientRequestAccountability): void {
    this.openDialog(PatientRequestAccountabilityUpdateComponent, { accountability }, '400px');
  }

  protected patientRequestAccountabilityDelete(accountability: PatientRequestAccountability): void {
    this.openDialog(PatientRequestAccountabilityDeleteComponent, { accountability }, '400px', 'auto', true);
  }

  protected accountabilityDailies(accountability: PatientRequestAccountability): void {
    this.openDialog(AccountabilityDailiesComponent, { accountability, permissions: this.data?.permissions }, '1000px', 'auto', true);
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
      this.dataSource.data = this.accountabilitiesList();
    }, { injector: this.injector });
  }

  private fetchAccountabilities(showLoading = false): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.fetchBalance();

    this.accountabilityService.getAccountabilities(requestId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response) ? response : (response?.data || []);
          this.accountabilitiesList.set(items);
        },
        error: (err) => {
          this.accountabilitiesList.set([]);
          const fallbackError = 'Não foi possível carregar as prestações de contas.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private fetchBalance(): void {
    const careId = this.data?.patient_request?.report?.patient_care?.id;

    if (!careId) return;

    this.accountabilityService.getBalance(careId)
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
    TFD_ACCOUNTABILITIES_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchAccountabilities(false);
      }
    };
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: AccountabilityDialogData,
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
            this.fetchAccountabilities(false);
          }

          if (emitGlobalBroadcast) {
            TFD_ACCOUNTABILITIES_CHANNEL.postMessage('update');
          }
        }
      });
  }
}