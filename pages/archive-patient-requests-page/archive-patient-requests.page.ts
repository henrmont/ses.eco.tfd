import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  OnDestroy,
  OnInit,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { NgxMaskPipe, provideNgxMask } from 'ngx-mask';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
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

// Core & Models
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientRequest } from '../../models/patient-request.model';
import { Permission } from '../../models/permission.model';
import { Role } from '../../models/role.model';
import { User } from '../../models/user.model';
import { PatientRequestService } from '../../services/patient-request.service';

// Dialog Components
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestMoveFromArchiveComponent } from '../../components/patient-requests/patient-request-move-from-archive/patient-request-move-from-archive.component';
import { PatientRequestRequirementComponent } from '../../components/patient-requests/patient-request-requirement/patient-request-requirement.component';

// Estrutura dos dados para exibição da tabela de solicitações arquivadas
interface ArchivePatientRequestTableRow extends PatientRequest {
  name: string;
  cns: string;
  document: string;
  document_type: string;
  responsible: string;
}

type PatientRequestDialogData = { patient_request: PatientRequest };

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
  // ==========================================
  // Instância própria do canal
  // ==========================================
  private readonly requestsChannel = new BroadcastChannel('tfd-patient-requests-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // ViewChildren / Elementos da View
  // ==========================================
  private readonly archiveSort = viewChild<MatSort>('archiveSort');
  private readonly archivePaginator = viewChild<MatPaginator>('archivePaginator');

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  private loadingDialog!: MatDialogRef<LoadingComponent>;
  private readonly currentUser: User | undefined = this.route.parent?.snapshot.data['user'];

  protected readonly displayedColumns: string[] = ['name', 'cns', 'document', 'responsible', 'status', 'actions'];
  protected readonly archivedDataSource = new MatTableDataSource<ArchivePatientRequestTableRow>([]);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchArchivePatientRequests(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.requestsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.archivedDataSource.filter = filterValue.trim().toLowerCase();

    if (this.archivedDataSource.paginator) {
      this.archivedDataSource.paginator.firstPage();
    }
  }

  protected checkPermissions(permissionName: string): boolean {
    if (!this.currentUser?.roles) return true;

    const hasPermission = this.currentUser.roles.some((role: Role) =>
      role.permissions?.some((perm: Permission) => perm.name === permissionName)
    );

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
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(() => {
      const archiveSort = this.archiveSort();
      const archivePaginator = this.archivePaginator();

      if (archiveSort) this.archivedDataSource.sort = archiveSort;
      if (archivePaginator) this.archivedDataSource.paginator = archivePaginator;
    }, { injector: this.injector });
  }

  private fetchArchivePatientRequests(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.patientRequestService.getArchivePatientRequests()
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
          const archivedRequests = rawData.map((item) => this.mapArchivedRequestRow(item));
          this.archivedDataSource.data = archivedRequests;
        },
        error: () => {
          this.archivedDataSource.data = [];
        }
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
    return {
      ...item,
      name: item.report?.patient_care?.patient?.name || '-',
      cns: item.report?.patient_care?.patient?.cns || '-',
      document: item.report?.patient_care?.patient?.document || '-',
      document_type: item.report?.patient_care?.patient?.document_type || '-',
      responsible: item.owner_professional?.name || '-'
    };
  }

  private openLoading(): void {
    this.loadingDialog = this.dialog.open(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
  }

  private openDialog<T>(
    component: new (...args: any[]) => T,
    data: PatientRequestDialogData,
    width = '1200px',
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
          this.handleRequestChange();
        }
      });
  }

  private handleRequestChange(): void {
    this.fetchArchivePatientRequests(false);
    this.requestsChannel.postMessage('update');
  }
}