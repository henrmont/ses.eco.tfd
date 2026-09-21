import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnDestroy, OnInit, effect, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { NgxMaskPipe } from 'ngx-mask';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
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
import { PatientRequestService } from '../../services/patient-request.service';

// Dialog Components
import { PatientRequestAttachmentsComponent } from '../../components/patient-requests/patient-request-attachments/patient-request-attachments.component';
import { PatientRequestDeleteComponent } from '../../components/patient-requests/patient-request-delete/patient-request-delete.component';
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestFinishBackComponent } from '../../components/patient-requests/patient-request-finish-back/patient-request-finish-back.component';
import { PatientRequestHaltedComponent } from '../../components/patient-requests/patient-request-halted/patient-request-halted.component';
import { PatientRequestMoveFromOthersComponent } from '../../components/patient-requests/patient-request-move-from-others/patient-request-move-from-others.component';
import { PatientRequestMoveFromProcessesComponent } from '../../components/patient-requests/patient-request-move-from-processes/patient-request-move-from-processes.component';
import { PatientRequestProcessToMedicalComponent } from '../../components/patient-requests/patient-request-process-to-medical/patient-request-process-to-medical.component';
import { PatientRequestUpdateComponent } from '../../components/patient-requests/patient-request-update/patient-request-update.component';

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
  templateUrl: './patient-requests.page.html',
  styleUrl: './patient-requests.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestsPage implements OnInit, OnDestroy {
  // ==========================================
  // Instância própria do canal
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
  private readonly processSort = viewChild<MatSort>('processSort');
  private readonly othersSort = viewChild<MatSort>('othersSort');

  private readonly ownerPaginator = viewChild<MatPaginator>('ownerPaginator');
  private readonly processPaginator = viewChild<MatPaginator>('processPaginator');
  private readonly othersPaginator = viewChild<MatPaginator>('othersPaginator');

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  private loadingDialog!: MatDialogRef<LoadingComponent>;
  private readonly currentUser = this.route.parent?.parent?.snapshot.data['user'];

  protected readonly displayedOwnerColumns: string[] = ['bookmark', 'name', 'cns', 'type', 'consultation_date', 'status', 'actions'];
  protected readonly displayedProcessColumns: string[] = ['name', 'cns', 'type', 'consultation_date', 'responsible', 'actions'];
  protected readonly displayedOthersColumns: string[] = ['name', 'cns', 'type', 'consultation_date', 'responsible', 'actions'];

  protected readonly ownerDataSource = new MatTableDataSource<any>([]);
  protected readonly processDataSource = new MatTableDataSource<any>([]);
  protected readonly othersDataSource = new MatTableDataSource<any>([]);

  // ==========================================
  // Ciclo de Vida (Hooks)
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
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected applyOwnerFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.ownerDataSource.filter = filterValue.trim().toLowerCase();

    if (this.ownerDataSource.paginator) {
      this.ownerDataSource.paginator.firstPage();
    }
  }

  protected applyProcessFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.processDataSource.filter = filterValue.trim().toLowerCase();

    if (this.processDataSource.paginator) {
      this.processDataSource.paginator.firstPage();
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

    const hasPermission = this.currentUser.roles.some((role: any) =>
      role.permissions?.some((perm: Permission) => perm.name === permissionName)
    );

    return !hasPermission;
  }

  protected checkStatus(patientRequest: PatientRequest): boolean {
    return !!(patientRequest.medical_status && patientRequest.social_status);
  }

  // Ações disparadas pelos botões da tabela
  protected patientRequestHalted(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestHaltedComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestUpdate(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestUpdateComponent, { patient_request: patientRequest }, '800px');
  }

  protected patientRequestDelete(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestDeleteComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestProcessToMedical(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestProcessToMedicalComponent, { patient_request: patientRequest }, '500px');
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

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(() => {
      const ownerSort = this.ownerSort();
      const ownerPaginator = this.ownerPaginator();

      if (ownerSort) this.ownerDataSource.sort = ownerSort;
      if (ownerPaginator) this.ownerDataSource.paginator = ownerPaginator;

      const processSort = this.processSort();
      const processPaginator = this.processPaginator();

      if (processSort) this.processDataSource.sort = processSort;
      if (processPaginator) this.processDataSource.paginator = processPaginator;

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
        next: (response: any) => {
          const rawData: any[] = response || [];

          const owners = rawData
            .filter((item) => (!item.medical_professional || item.back_to_owner) && item.owner)
            .map((item) => this.mapPatientRequestRow(item));

          const processes = rawData
            .filter((item) => item.medical_professional && item.owner && !item.back_to_owner)
            .map((item) => this.mapPatientRequestRow(item));

          const others = rawData
            .filter((item) => !item.owner)
            .map((item) => this.mapPatientRequestRow(item));

          this.ownerDataSource.data = owners;
          this.processDataSource.data = processes;
          this.othersDataSource.data = others;
        },
        error: () => {
          this.ownerDataSource.data = [];
          this.processDataSource.data = [];
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

  private mapPatientRequestRow(item: any) {
    return {
      ...item,
      name: item.report?.patient_care?.patient?.name,
      cns: item.report?.patient_care?.patient?.cns,
      type: item.type,
      consultation_date: item.consultation_date,
      status: item.status,
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
    data: { patient_request: PatientRequest },
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