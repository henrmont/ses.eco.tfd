import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnDestroy, OnInit, effect, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { NgxMaskPipe } from 'ngx-mask';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
import { PatientCare } from '../../models/patient-care.model';
import { PatientRequest } from '../../models/patient-request.model';
import { Permission } from '../../models/permission.model';
import { Role } from '../../models/role.model';
import { PatientRequestCostAssistanceService } from '../../services/patient-request-cost-assistance.service';

// Dialog Components
import { PatientRequestAttachmentsComponent } from '../../components/patient-requests/patient-request-attachments/patient-request-attachments.component';
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestFinishBackComponent } from '../../components/patient-request-cost-assistances/patient-request-finish-back/patient-request-finish-back.component';
import { PatientRequestHaltedComponent } from '../../components/patient-request-cost-assistances/patient-request-halted/patient-request-halted.component';
import { PatientRequestHistoryComponent } from '../../components/patient-request-cost-assistances/patient-request-history/patient-request-history.component';
import { PatientRequestCostAssistancesComponent } from '../../components/patient-request-cost-assistances/patient-request-cost-assistances/patient-request-cost-assistances.component';
import { PatientRequestMoveFromOthersComponent } from '../../components/patient-request-cost-assistances/patient-request-move-from-others/patient-request-move-from-others.component';
import { PatientRequestUndoComponent } from '../../components/patient-request-cost-assistances/patient-request-undo/patient-request-undo.component';
import { PatientRequestProcessToPaymentComponent } from '../../components/patient-request-cost-assistances/patient-request-process-to-payment/patient-request-process-to-payment.component';
import { PatientRequestArchiveComponent } from '../../components/patient-request-cost-assistances/patient-request-archive/patient-request-archive.component';

// Define os formatos de dados aceitos pelos modais da página de ajuda de custo
type PatientRequestDialogData =
  | { patient_request: PatientRequest }
  | { patient_request: PatientRequest; permissions: Role[] };


@Component({
  selector: 'app-patient-request-cost-assistance-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
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
  templateUrl: './patient-request-cost-assistances.page.html',
  styleUrl: './patient-request-cost-assistances.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestCostAssistancesPage implements OnInit, OnDestroy {
  // ==========================================
  // Instância própria do canal
  // ==========================================
  private readonly costAssistancesChannel = new BroadcastChannel('tfd-cost-assistances-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
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
  // Propriedades e Estado Reativo
  // ==========================================
  private loadingDialog!: MatDialogRef<LoadingComponent>;
  private readonly currentUser = this.route.parent?.parent?.snapshot.data['user'];

  protected readonly displayedOwnerColumns: string[] = ['bookmark', 'patient', 'cns', 'type', 'consultation_date', 'status', 'actions'];
  protected readonly displayedOthersColumns: string[] = ['patient', 'cns', 'type', 'consultation_date', 'responsible', 'actions'];

  protected readonly ownerDataSource = new MatTableDataSource<any>([]);
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
    this.costAssistancesChannel.close();
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

  protected checkStatus(patientRequest: PatientRequest): boolean {
    return !!(patientRequest.medical_status && patientRequest.social_status);
  }

  // Ações disparadas pelos botões da tabela
  protected patientRequestHalted(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestHaltedComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestAttachments(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestAttachmentsComponent, { patient_request: patientRequest }, '600px', 'auto', false);
  }

  protected patientRequestUndo(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestUndoComponent, { patient_request: patientRequest }, '500px');
  }

  protected patientRequestCostAssistances(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestCostAssistancesComponent, { patient_request: patientRequest, permissions: this.currentUser?.roles }, '1200px');
  }

  protected patientRequestHistory(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestHistoryComponent, { patient_request: patientRequest }, '1000px', 'auto', false);
  }

  protected patientRequestDetail(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestDetailComponent, { patient_request: patientRequest }, '1000px', 'auto', false);
  }

  protected patientRequestMoveFromOthers(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestMoveFromOthersComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestFinishBack(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestFinishBackComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestProcessToPayment(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestProcessToPaymentComponent, { patient_request: patientRequest }, '800px');
  }

  protected patientRequestArchive(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestArchiveComponent, { patient_request: patientRequest }, '400px');
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(
      () => {
        const ownerSort = this.ownerSort();
        const ownerPaginator = this.ownerPaginator();

        if (ownerSort) this.ownerDataSource.sort = ownerSort;
        if (ownerPaginator) this.ownerDataSource.paginator = ownerPaginator;

        const othersSort = this.othersSort();
        const othersPaginator = this.othersPaginator();

        if (othersSort) this.othersDataSource.sort = othersSort;
        if (othersPaginator) this.othersDataSource.paginator = othersPaginator;
      },
      { injector: this.injector }
    );
  }

  private fetchPatientRequests(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.costAssistanceService
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
        next: (response: any) => {
          console.log(response)
          const rawData: any[] = response || [];

          const owners = rawData
            .filter((req) => req.cost_assistance)
            .map((item) => this.mapPatientRequestRow(item));

          const others = rawData
            .filter((req) => !req.cost_assistance)
            .map((item) => this.mapPatientRequestRow(item));

          this.ownerDataSource.data = owners;
          this.othersDataSource.data = others;
        },
        error: () => {
          this.ownerDataSource.data = [];
          this.othersDataSource.data = [];
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.costAssistancesChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPatientRequests(false);
      }
    };
  }

  private mapPatientRequestRow(item: any) {
    return {
      ...item,
      name: item.report?.patient_care?.patient?.name || '',
      cns: item.report?.patient_care?.patient?.cns || '',
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
        data,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && requiresRefresh) {
          this.handleRequestsChange();
        }
      });
  }

  private handleRequestsChange(): void {
    this.fetchPatientRequests(false);
    this.costAssistancesChannel.postMessage('update');
  }
}