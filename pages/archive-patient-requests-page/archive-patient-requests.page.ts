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
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
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
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestMoveFromArchiveComponent } from '../../components/patient-requests/patient-request-move-from-archive/patient-request-move-from-archive.component';
import { PatientRequestRequirementComponent } from '../../components/patient-requests/patient-request-requirement/patient-request-requirement.component';

// ============================================================================
// CONFIGURAÇÃO DO MÓDULO (Único bloco a ajustar ao replicar para outro módulo)
// ============================================================================
const PAGE_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
  permissionPrefix: 'tfd/',
} as const;

interface ArchivePatientRequestTableRow extends PatientRequest {
  name: string;
  cns: string;
  document: string;
  document_type: string;
  responsible: string;
  fullResponsible: string;
}

interface PatientRequestDialogData {
  patient_request?: PatientRequest;
}

@Component({
  selector: 'app-archive-patient-requests-page',
  standalone: true,
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    NgxMaskPipe,
  ],
  providers: [provideNgxMask()],
  templateUrl: './archive-patient-requests.page.html',
  styleUrl: './archive-patient-requests.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivePatientRequestsPage implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(PAGE_CONFIG.channelName);

  // Injeção de Dependências
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // Queries Reativas da View
  private readonly archiveSort = viewChild<MatSort>('archiveSort');
  private readonly archivePaginator = viewChild<MatPaginator>('archivePaginator');

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

  protected readonly displayedColumns: string[] = [
    'name',
    'cns',
    'document',
    'responsible',
    'status',
    'actions',
  ];

  protected readonly archivedDataSource = new MatTableDataSource<ArchivePatientRequestTableRow>([]);

  constructor() {
    effect(() => {
      const archiveSort = this.archiveSort();
      const archivePaginator = this.archivePaginator();

      if (archiveSort) this.archivedDataSource.sort = archiveSort;
      if (archivePaginator) this.archivedDataSource.paginator = archivePaginator;
    });
  }

  ngOnInit(): void {
    this.fetchArchivePatientRequests(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.loadingDialog?.close();
    this.requestsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis no Template
  // ==========================================
  protected applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.archivedDataSource.filter = filterValue.trim().toLowerCase();

    if (this.archivedDataSource.paginator) {
      this.archivedDataSource.paginator.firstPage();
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
  protected patientRequestDetail(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestDetailComponent, { patient_request: patientRequest }, '1200px', '700px', false);
  }

  protected patientRequestMoveFromArchive(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestMoveFromArchiveComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestRequirement(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestRequirementComponent, { patient_request: patientRequest }, '500px');
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private fetchArchivePatientRequests(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.patientRequestService
      .getArchivePatientRequests()
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
          this.archivedDataSource.data = rawData.map((item) => this.mapArchivedRequestRow(item));
        },
        error: () => {
          this.archivedDataSource.data = [];
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.requestsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchArchivePatientRequests(false);
      }
    };
  }

  private mapArchivedRequestRow(item: PatientRequest): ArchivePatientRequestTableRow {
    const patient = item.report?.patient_care?.patient;
    const rawName = patient?.name?.trim() || '-';
    const rawResponsible = item.owner_professional?.name?.trim() || '-';

    return {
      ...item,
      name: this.formatPatientName(rawName),
      cns: patient?.cns || '-',
      document: patient?.document || '-',
      document_type: patient?.document_type || '-',
      responsible: this.formatResponsibleName(rawResponsible),
      fullResponsible: rawResponsible,
    };
  }

  private formatPatientName(name: string): string {
    if (name === '-' || name.length <= 40) return name;
    return `${name.slice(0, 32)}...${name.slice(-5)}`;
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
          this.handleRequestChange();
        }
      });
  }

  private handleRequestChange(): void {
    this.fetchArchivePatientRequests(false);
    this.requestsChannel.postMessage('update');
  }
}