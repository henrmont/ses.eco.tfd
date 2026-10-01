import { CommonModule } from '@angular/common';
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
import { ComponentType, Overlay } from '@angular/cdk/overlay';
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
import { PatientRequestOpinionService } from '../../services/patient-request-opinion.service';

// Dialog Components
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestMoveFromArchiveComponent } from '../../components/patient-request-opinions/patient-request-move-from-archive/patient-request-move-from-archive.component';
import { PatientRequestRequirementComponent } from '../../components/patient-request-opinions/patient-request-requirement/patient-request-requirement.component';

// Tipos estruturados para Dialogs e Tabelas
type PatientRequestDialogData = {
  patient_request?: PatientRequest;
  type?: string;
  permissions?: Role[];
};

interface ArchivePatientRequestMedicalOpinionsTableRow extends PatientRequest {
  name: string;
  cns: string;
  document: string;
  responsible: string;
}

@Component({
  selector: 'app-archive-patient-request-medical-opinions-page',
  standalone: true,
  imports: [
    CommonModule,
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
  templateUrl: './archive-patient-request-medical-opinions.page.html',
  styleUrl: './archive-patient-request-medical-opinions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivePatientRequestMedicalOpinionsPage implements OnInit, OnDestroy {
  // ==========================================
  // Instância própria do canal
  // ==========================================
  private readonly opinionsChannel = new BroadcastChannel('tfd-opinions-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly opinionService = inject(PatientRequestOpinionService);
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
  private readonly currentUser: User | undefined = this.route.parent?.parent?.snapshot.data['user'];

  protected readonly displayedColumns: string[] = [
    'name',
    'cns',
    'document',
    'responsible',
    'status',
    'actions',
  ];

  protected readonly archivedDataSource = new MatTableDataSource<ArchivePatientRequestMedicalOpinionsTableRow>([]);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchArchivePatientRequests(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.opinionsChannel.close();
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
    this.openDialog(PatientRequestDetailComponent, { patient_request: patientRequest }, '1000px', 'auto', false);
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
    effect(
      () => {
        const archiveSort = this.archiveSort();
        const archivePaginator = this.archivePaginator();

        if (archiveSort) this.archivedDataSource.sort = archiveSort;
        if (archivePaginator) this.archivedDataSource.paginator = archivePaginator;
      },
      { injector: this.injector }
    );
  }

  private fetchArchivePatientRequests(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.opinionService
      .getArchivePatientRequests('medical')
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
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.opinionsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchArchivePatientRequests(false);
      }
    };
  }

  private mapArchivedRequestRow(item: PatientRequest): ArchivePatientRequestMedicalOpinionsTableRow {
    return {
      ...item,
      name: item.report?.patient_care?.patient?.name || '-',
      cns: item.report?.patient_care?.patient?.cns || '-',
      document: item.report?.patient_care?.patient?.document || '-',
      responsible: item.medical_professional?.name || '-',
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
    component: ComponentType<T>,
    data: PatientRequestDialogData,
    width = '400px',
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
        data: {
          type: 'medical',
          ...data,
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && requiresRefresh) {
          this.handleOpinionChange();
        }
      });
  }

  private handleOpinionChange(): void {
    this.fetchArchivePatientRequests(false);
    this.opinionsChannel.postMessage('update');
  }
}