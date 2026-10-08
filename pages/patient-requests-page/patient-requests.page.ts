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
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { NgxMaskPipe, provideNgxMask } from 'ngx-mask';

// Angular Material & CDK
import { ComponentType, Overlay } from '@angular/cdk/overlay';
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

// Core & Models
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientRequest } from '../../models/patient-request.model';
import { Permission } from '../../models/permission.model';
import { Role } from '../../models/role.model';
import { User } from '../../models/user.model';
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

// Interfaces/Tipos estruturados para Dialogs e Tabelas
type PatientRequestDialogData = {
  patient_request?: PatientRequest;
};

interface OwnerPatientRequestTableRow extends PatientRequest {
  name: string;
  cns: string;
}

interface OthersPatientRequestTableRow extends PatientRequest {
  name: string;
  cns: string;
  responsible: string;
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
    NgxMaskPipe
  ],
  providers: [provideNgxMask()],
  templateUrl: './patient-requests.page.html',
  styleUrl: './patient-requests.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestsPage implements OnInit, OnDestroy {
  // ==========================================
  // Instância do Canal Broadcast
  // ==========================================
  private readonly patientRequestsChannel = new BroadcastChannel('tfd-patient-requests-channel');

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
  private readonly ownerSort = viewChild<MatSort>('ownerSort');
  private readonly othersSort = viewChild<MatSort>('othersSort');
  private readonly ownerPaginator = viewChild<MatPaginator>('ownerPaginator');
  private readonly othersPaginator = viewChild<MatPaginator>('othersPaginator');

  // ==========================================
  // Propriedades e Estado
  // ==========================================
  private loadingDialog!: MatDialogRef<LoadingComponent>;
  private readonly currentUser: User | undefined = this.route.parent?.snapshot.data['user'];

  protected readonly displayedOwnerColumns: string[] = ['bookmark', 'name', 'cns', 'type', 'consultation_date', 'status', 'actions'];
  protected readonly displayedOthersColumns: string[] = ['name', 'cns', 'type', 'consultation_date', 'responsible', 'status', 'actions'];

  protected readonly ownerDataSource = new MatTableDataSource<OwnerPatientRequestTableRow>([]);
  protected readonly othersDataSource = new MatTableDataSource<OthersPatientRequestTableRow>([]);

  // ==========================================
  // Ciclo de Vida
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchPatientRequests(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.patientRequestsChannel.close();
  }

  // ==========================================
  // Filtros e Permissões
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

  protected checkPermissions(permissionName: string): boolean {
    if (!this.currentUser?.roles) return true;

    const hasPermission = this.currentUser.roles.some((role: Role) =>
      role.permissions?.some((perm: Permission) => perm.name === permissionName)
    );

    return !hasPermission;
  }

  // ==========================================
  // Ações Disparadas pela Tabela
  // ==========================================
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
  // Métodos Privados Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(() => {
      const ownerSort = this.ownerSort();
      const ownerPaginator = this.ownerPaginator();

      if (ownerSort) this.ownerDataSource.sort = ownerSort;
      if (ownerPaginator) this.ownerDataSource.paginator = ownerPaginator;

      const othersSort = this.othersSort();
      const othersPaginator = this.othersPaginator();

      if (othersSort) this.othersDataSource.sort = othersSort;
      if (othersPaginator) this.othersDataSource.paginator = othersPaginator;
    }, { injector: this.injector });
  }

  private fetchPatientRequests(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.patientRequestService.getPatientRequests()
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
          console.log(response)
          const rawData = response || [];

          const owners = rawData
            .filter((item) => item.owner)
            .map((item) => this.mapOwnerPatientRequestRow(item));

          const others = rawData
            .filter((item) => !item.owner)
            .map((item) => this.mapOthersPatientRequestRow(item));

          this.ownerDataSource.data = owners;
          this.othersDataSource.data = others;
        },
        error: () => {
          this.ownerDataSource.data = [];
          this.othersDataSource.data = [];
        }
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
    return {
      ...item,
      name: item.report?.patient_care?.patient?.name || '-',
      cns: item.report?.patient_care?.patient?.cns || '-'
    };
  }

  private mapOthersPatientRequestRow(item: PatientRequest): OthersPatientRequestTableRow {
    return {
      ...item,
      name: item.report?.patient_care?.patient?.name || '-',
      cns: item.report?.patient_care?.patient?.cns || '-',
      responsible: item.owner_professional?.name || '-'
    };
  }

  private openLoading(): void {
    this.loadingDialog = this.dialog.open(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
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
          this.handlePatientRequestChange();
        }
      });
  }

  private handlePatientRequestChange(): void {
    this.fetchPatientRequests(false);
    this.patientRequestsChannel.postMessage('update');
  }
}