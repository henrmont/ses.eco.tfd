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
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';
import { PatientRequest } from '../../../models/patient-request.model';
import { Role } from '../../../models/role.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

// Modais do Contexto de Prestações de Contas
import { AccountabilityDailiesComponent } from '../accountability-dailies/accountability-dailies.component';
import { PatientRequestAccountabilityCreateComponent } from '../patient-request-accountability-create/patient-request-accountability-create.component';
import { PatientRequestAccountabilityDeleteComponent } from '../patient-request-accountability-delete/patient-request-accountability-delete.component';
import { PatientRequestAccountabilityDetailComponent } from '../patient-request-accountability-detail/patient-request-accountability-detail.component';
import { PatientRequestAccountabilityUpdateComponent } from '../patient-request-accountability-update/patient-request-accountability-update.component';
import { PatientRequestAccountabilityRequirementComponent } from '../patient-request-accountability-requirement/patient-request-accountability-requirement.component';

export type PatientRequestAccountabilitiesDialogData = {
  patient_request?: PatientRequest;
  accountability?: PatientRequestAccountability;
  roles?: Role[];
};

export interface MappedAccountability extends PatientRequestAccountability {
  totalDailiesNum: number;
}

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
  // Instância do Broadcast Channel
  // ==========================================
  private readonly accountabilitiesChannel = new BroadcastChannel('tfd-accountabilities-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAccountabilitiesDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'created_at', 'dailies', 'status', 'actions'];
  protected readonly accountabilitiesList = signal<PatientRequestAccountability[]>([]);
  protected readonly isLoading = signal<boolean>(true);
  protected readonly totalValue = signal<number>(0);
  protected readonly dataSource = new MatTableDataSource<PatientRequestAccountability>([]);

  // Somatório do total de diárias das prestações de contas
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

  // Define dinamicamente as colunas do rodapé
  protected readonly footerColumns = computed(() =>
    this.accountabilitiesList().length > 0 ? this.displayedColumns : []
  );

  private readonly requestId = computed(() => this.data?.patient_request?.id ?? null);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchAccountabilities(true);
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
  protected patientRequestAccountabilityCreate(): void {
    this.openDialog(PatientRequestAccountabilityCreateComponent, {
      patient_request: this.data?.patient_request
    }, '500px');
  }

  protected patientRequestAccountabilityDetail(accountability: PatientRequestAccountability): void {
    this.openDialog(PatientRequestAccountabilityDetailComponent, { accountability }, '800px', 'auto', false);
  }

  protected patientRequestAccountabilityUpdate(accountability: PatientRequestAccountability): void {
    this.openDialog(PatientRequestAccountabilityUpdateComponent, { accountability }, '500px');
  }

  protected patientRequestAccountabilityDelete(accountability: PatientRequestAccountability): void {
    this.openDialog(PatientRequestAccountabilityDeleteComponent, { accountability }, '400px', 'auto', true);
  }

  protected accountabilityDailies(accountability: PatientRequestAccountability): void {
    this.openDialog(AccountabilityDailiesComponent, { accountability, roles: this.data?.roles }, '1000px', 'auto', true);
  }

  protected patientRequestAccountabilityRequirement(accountability: PatientRequestAccountability): void {
    this.openDialog(PatientRequestAccountabilityRequirementComponent, { accountability }, '500px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchAccountabilities(showLoading = false): void {
    const currentRequestId = this.requestId();

    if (!currentRequestId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.fetchBalance();

    this.accountabilityService.getAccountabilities(currentRequestId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response) ? response : (response?.data || []);
          this.accountabilitiesList.set(items);
          this.dataSource.data = items;
        },
        error: (err) => {
          this.accountabilitiesList.set([]);
          this.dataSource.data = [];
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

  private setupBroadcastChannel(): void {
    this.accountabilitiesChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchAccountabilities(false);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.accountabilitiesChannel.close();
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: PatientRequestAccountabilitiesDialogData,
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
          this.handleAccountabilityChange();
        }
      });
  }

  private handleAccountabilityChange(): void {
    this.fetchAccountabilities(false);
    this.accountabilitiesChannel.postMessage('update');
  }
}