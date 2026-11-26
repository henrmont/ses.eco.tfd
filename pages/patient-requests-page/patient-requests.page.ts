import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { finalize } from 'rxjs';
import { NgxMaskPipe, provideNgxMask } from 'ngx-mask';

// Angular Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models (Padrão alias "as User")
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { Permission } from '../../../core/models/permission.model';
import { Role } from '../../../core/models/role.model';
import { PatientRequest } from '../../models/patient-request.model';
import { TfdUser as User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { PatientRequestService } from '../../services/patient-request.service';

// Dialog Components
import { PatientRequestArchiveComponent } from '../../components/patient-requests/patient-request-archive/patient-request-archive.component';
import { PatientRequestAttachmentsComponent } from '../../components/patient-requests/patient-request-attachments/patient-request-attachments.component';
import { PatientRequestDeleteComponent } from '../../components/patient-requests/patient-request-delete/patient-request-delete.component';
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestFinishBackComponent } from '../../components/patient-requests/patient-request-finish-back/patient-request-finish-back.component';
import { PatientRequestHaltedComponent } from '../../components/patient-requests/patient-request-halted/patient-request-halted.component';
import { PatientRequestMoveFromOthersComponent } from '../../components/patient-requests/patient-request-move-from-others/patient-request-move-from-others.component';
import { PatientRequestMoveFromProcessesComponent } from '../../components/patient-requests/patient-request-move-from-processes/patient-request-move-from-processes.component';
import { PatientRequestProcessComponent } from '../../components/patient-requests/patient-request-process/patient-request-process.component';
import { PatientRequestRequirementComponent } from '../../components/patient-requests/patient-request-requirement/patient-request-requirement.component';
import { PatientRequestUpdateComponent } from '../../components/patient-requests/patient-request-update/patient-request-update.component';

// ============================================================================
// CONFIGURAÇÃO DO MÓDULO (Único bloco a ajustar ao replicar para outro módulo)
// ============================================================================
const PAGE_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
  permissionPrefix: 'tfd/',
} as const;

interface OwnerPatientRequestTableRow extends PatientRequest {
  name: string;
  cns: string;
}

interface OthersPatientRequestTableRow extends PatientRequest {
  name: string;
  cns: string;
  responsible: string;
  fullResponsible: string;
}

interface PatientRequestDialogData {
  patient_request?: PatientRequest;
}

@Component({
  selector: 'app-patient-requests-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    NgxMaskPipe,
  ],
  providers: [provideNgxMask()],
  templateUrl: './patient-requests.page.html',
  styleUrl: './patient-requests.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestsPage implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientRequestsChannel = new BroadcastChannel(PAGE_CONFIG.channelName);

  // Injeção de Dependências
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // Queries Reativas da View
  private readonly ownerSort = viewChild<MatSort>('ownerSort');
  private readonly othersSort = viewChild<MatSort>('othersSort');
  private readonly ownerPaginator = viewChild<MatPaginator>('ownerPaginator');
  private readonly othersPaginator = viewChild<MatPaginator>('othersPaginator');

  // Estado e Controle Reativo
  private loadingDialog?: MatDialogRef<LoadingComponent>;
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

  protected readonly displayedOwnerColumns: string[] = [
    'bookmark',
    'name',
    'cns',
    'type',
    'consultation_date',
    'status',
    'actions',
  ];

  protected readonly displayedOthersColumns: string[] = [
    'name',
    'cns',
    'type',
    'consultation_date',
    'responsible',
    'status',
    'actions',
  ];

  protected readonly ownerDataSource = new MatTableDataSource<OwnerPatientRequestTableRow>([]);
  protected readonly othersDataSource = new MatTableDataSource<OthersPatientRequestTableRow>([]);

  constructor() {
    effect(() => {
      const ownerSort = this.ownerSort();
      const ownerPaginator = this.ownerPaginator();

      if (ownerSort) this.ownerDataSource.sort = ownerSort;
      if (ownerPaginator) this.ownerDataSource.paginator = ownerPaginator;

      const othersSort = this.othersSort();
      const othersPaginator = this.othersPaginator();

      if (othersSort) this.othersDataSource.sort = othersSort;
      if (othersPaginator) this.othersDataSource.paginator = othersPaginator;
    });
  }

  ngOnInit(): void {
    this.fetchPatientRequests(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.loadingDialog?.close();
    this.patientRequestsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis no Template
  // ==========================================
  protected applyOwnerFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.ownerDataSource.filter = filterValue.trim().toLowerCase();

    if (this.ownerDataSource.paginator) {
      this.ownerDataSource.paginator.firstPage();
    }
  }

  protected applyOthersFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.othersDataSource.filter = filterValue.trim().toLowerCase();

    if (this.othersDataSource.paginator) {
      this.othersDataSource.paginator.firstPage();
    }
  }

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

  // Ações disparadas pelos botões da tabela
  protected patientRequestHalted(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestHaltedComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestArchive(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestArchiveComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestUpdate(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestUpdateComponent, { patient_request: patientRequest }, '800px');
  }

  protected patientRequestDelete(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestDeleteComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestProcess(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestProcessComponent, { patient_request: patientRequest }, '500px');
  }

  protected patientRequestMoveFromProcesses(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestMoveFromProcessesComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestMoveFromOthers(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestMoveFromOthersComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestDetail(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestDetailComponent, { patient_request: patientRequest }, '1000px', 'auto', false);
  }

  protected patientRequestAttachments(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestAttachmentsComponent, { patient_request: patientRequest }, '600px', 'auto', false);
  }

  protected patientRequestFinishBack(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestFinishBackComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestRequirement(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestRequirementComponent, { patient_request: patientRequest }, '500px');
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private fetchPatientRequests(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.patientRequestService
      .getPatientRequests()
      .pipe(
        finalize(() => {
          if (showLoading && this.loadingDialog) {
            this.loadingDialog.close();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientRequest[]) => {
          const rawData = response || [];

          this.ownerDataSource.data = rawData
            .filter((item) => item.owner)
            .map((item) => this.mapOwnerPatientRequestRow(item));

          this.othersDataSource.data = rawData
            .filter((item) => !item.owner)
            .map((item) => this.mapOthersPatientRequestRow(item));
        },
        error: () => {
          this.ownerDataSource.data = [];
          this.othersDataSource.data = [];
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.patientRequestsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPatientRequests(false);
      }
    };
  }

  private mapOwnerPatientRequestRow(item: PatientRequest): OwnerPatientRequestTableRow {
    const rawName = item.report?.patient_care?.patient?.name?.trim() || '-';

    return {
      ...item,
      name: this.formatPatientName(rawName),
      cns: item.report?.patient_care?.patient?.cns || '-',
    };
  }

  private mapOthersPatientRequestRow(item: PatientRequest): OthersPatientRequestTableRow {
    const rawName = item.report?.patient_care?.patient?.name?.trim() || '-';
    const rawResponsible = item.owner_professional?.name?.trim() || '-';

    return {
      ...item,
      name: this.formatPatientName(rawName),
      cns: item.report?.patient_care?.patient?.cns || '-',
      responsible: this.formatResponsibleName(rawResponsible),
      fullResponsible: rawResponsible,
    };
  }

  private formatPatientName(name: string): string {
    if (name === '-' || name.length <= 40) return name;
    return `${name.slice(0, 32)} ...${name.slice(-5)}`;
  }

  private formatResponsibleName(name: string): string {
    if (name === '-') return name;
    const parts = name.split(/\s+/);
    return parts.length <= 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1]}`;
  }

  private openLoading(): void {
    this.loadingDialog = this.dialog.open(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: PatientRequestDialogData,
    width = '1200px',
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
          this.handlePatientRequestChange();
        }
      });
  }

  private handlePatientRequestChange(): void {
    this.fetchPatientRequests(false);
    this.patientRequestsChannel.postMessage('update');
  }
}