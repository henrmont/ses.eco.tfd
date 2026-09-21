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
import { PatientRequest } from '../../models/patient-request.model';
import { Payment } from '../../models/payment.model';
import { Permission } from '../../models/permission.model';
import { Role } from '../../models/role.model';
import { PaymentService } from '../../services/payment.service';

// Dialog Components
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PaymentArchiveComponent } from '../../components/payments/payment-archive/payment-archive.component';
import { PaymentHaltedComponent } from '../../components/payments/payment-halted/payment-halted.component';
import { PaymentMemoComponent } from '../../components/payments/payment-memo/payment-memo.component';
import { PaymentUpdateComponent } from '../../components/payments/payment-update/payment-update.component';
import { PatientRequestUndoComponent } from '../../components/payments/patient-request-undo/patient-request-undo.component';

// Types locais para entrada de dados nos modais
type PaymentDialogData =
  | { patient_request: PatientRequest }
  | { payment: Payment };


@Component({
  selector: 'app-payments-page',
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
  templateUrl: './payments.page.html',
  styleUrl: './payments.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsPage implements OnInit, OnDestroy {
  // ==========================================
  // Instância própria do canal
  // ==========================================
  private readonly paymentsChannel = new BroadcastChannel('tfd-payments-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly paymentService = inject(PaymentService);
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
    this.fetchPayments(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.paymentsChannel.close();
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
  protected downloadMergedPdf(patientRequest: PatientRequest): void {
    this.openLoading();

    this.paymentService
      .downloadMergedPdf(patientRequest.id!)
      .pipe(
        finalize(() => {
          if (this.loadingDialog) {
            this.loadingDialog.close();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (blobData: Blob) => {
          const file = new Blob([blobData], { type: 'application/pdf' });
          const fileURL = URL.createObjectURL(file);

          const anchor = document.createElement('a');
          anchor.href = fileURL;
          anchor.download = `processo_${patientRequest.id}_completo.pdf`;
          anchor.click();

          URL.revokeObjectURL(fileURL);
        },
        error: (err) => {
          console.error('Erro ao realizar o download do arquivo mesclado:', err);
        },
      });
  }

  protected patientRequestDetail(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestDetailComponent, { patient_request: patientRequest }, '1000px', 'auto', false);
  }

  protected paymentUpdate(payment: Payment): void {
    this.openDialog(PaymentUpdateComponent, { payment }, '400px');
  }

  protected paymentMemo(payment: Payment): void {
    this.openDialog(PaymentMemoComponent, { payment }, '800px', '800px');
  }

  protected patientRequestUndo(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestUndoComponent, { patient_request: patientRequest }, '500px');
  }

  protected paymentArchive(payment: Payment): void {
    this.openDialog(PaymentArchiveComponent, { payment }, '400px');
  }

  protected paymentHalted(payment: Payment): void {
    this.openDialog(PaymentHaltedComponent, { payment }, '400px');
  }

  protected paymentMoveFromOthers(payment: Payment): void {
    this.openDialog(PaymentUpdateComponent, { payment }, '400px');
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

  private fetchPayments(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.paymentService
      .getPayments()
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
          const rawList = response?.payments ?? [];
          const budgetAllocation = response?.budget_allocation ?? null;

          const normalizedRequests = rawList.map((item: any) =>
            this.mapPaymentRow(item, budgetAllocation)
          );

          const owners = normalizedRequests.filter((req: any) => req.payment);
          const others = normalizedRequests.filter((req: any) => !req.payment);

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
    this.paymentsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPayments(false);
      }
    };
  }

  private mapPaymentRow(item: any, budgetAllocation: any) {
    return {
      ...item,
      name: item.patient_request?.report?.patient_care?.patient?.name || '',
      cns: item.patient_request?.report?.patient_care?.patient?.cns || '',
      type: item.patient_request?.type,
      consultation_date: item.patient_request?.consultation_date,
      budget_allocation: budgetAllocation,
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
    data: PaymentDialogData,
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
    this.fetchPayments(false);
    this.paymentsChannel.postMessage('update');
  }
}