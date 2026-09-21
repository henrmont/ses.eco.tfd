import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnDestroy, OnInit, effect, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { NgxMaskPipe } from 'ngx-mask';

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
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientCare } from '../../models/patient-care.model';
import { Permission } from '../../models/permission.model';
import { PatientService } from '../../services/patient.service';

// Dialog Components
import { PatientArchiveComponent } from '../../components/patients/patient-archive/patient-archive.component';
import { PatientDetailComponent } from '../../components/patients/patient-detail/patient-detail.component';
import { PatientEscortsComponent } from '../../components/patients/patient-escorts/patient-escorts.component';
import { PatientFinishBackComponent } from '../../components/patients/patient-finish-back/patient-finish-back.component';
import { PatientMoveFromOthersComponent } from '../../components/patients/patient-move-from-others/patient-move-from-others.component';
import { PatientReportsComponent } from '../../components/patients/patient-reports/patient-reports.component';
import { PatientUpdateComponent } from '../../components/patients/patient-update/patient-update.component';
import { PatientValidateComponent } from '../../components/patients/patient-validate/patient-validate.component';
import { Patient } from '../../models/patient.model';

// Define o tipo aceito para as propriedades do Modal
type PatientDialogData = 
  | { patient: Patient | undefined }
  | { patient_care: PatientCare };

@Component({
  selector: 'app-patients-page',
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
    MatTabsModule,
    MatTooltipModule,
    NgxMaskPipe
  ],
  templateUrl: './patients.page.html',
  styleUrl: './patients.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientsPage implements OnInit, OnDestroy {
  // ==========================================
  // Instância própria do canal
  // ==========================================
  private readonly patientsChannel = new BroadcastChannel('tfd-patients-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly patientService = inject(PatientService);
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

  protected readonly displayedOwnerColumns: string[] = ['name', 'cns', 'document', 'status', 'actions'];
  protected readonly displayedOthersColumns: string[] = ['name', 'cns', 'responsible', 'status', 'actions'];

  protected readonly ownerDataSource = new MatTableDataSource<PatientCare>([]);
  protected readonly othersDataSource = new MatTableDataSource<PatientCare>([]);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchPatients(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
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

    const hasPermission = this.currentUser.roles.some((role: any) =>
      role.permissions?.some((perm: Permission) => perm.name === permissionName)
    );

    return !hasPermission;
  }

  // Ações disparadas pelos botões da tabela
  protected patientDetail(patientCare: PatientCare): void {
    this.openDialog(PatientDetailComponent, { patient: patientCare.patient }, '1200px', '700px', false);
  }

  protected patientUpdate(patientCare: PatientCare): void {
    this.openDialog(PatientUpdateComponent, { patient_care: patientCare }, '1200px', '700px');
  }

  protected patientEscorts(patientCare: PatientCare): void {
    this.openDialog(PatientEscortsComponent, { patient_care: patientCare }, '1200px', 'auto', false);
  }

  protected patientReports(patientCare: PatientCare): void {
    this.openDialog(PatientReportsComponent, { patient_care: patientCare }, '1200px', 'auto', false);
  }

  protected patientArchive(patientCare: PatientCare): void {
    this.openDialog(PatientArchiveComponent, { patient_care: patientCare }, '400px');
  }

  protected patientMoveFromOthers(patientCare: PatientCare): void {
    this.openDialog(PatientMoveFromOthersComponent, { patient_care: patientCare }, '400px');
  }

  protected patientValidate(patientCare: PatientCare): void {
    this.openDialog(PatientValidateComponent, { patient_care: patientCare }, '400px');
  }

  protected patientFinishBack(patientCare: PatientCare): void {
    this.openDialog(PatientFinishBackComponent, { patient_care: patientCare }, '400px');
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

      const othersSort = this.othersSort();
      const othersPaginator = this.othersPaginator();

      if (othersSort) this.othersDataSource.sort = othersSort;
      if (othersPaginator) this.othersDataSource.paginator = othersPaginator;
    }, { injector: this.injector });
  }

  private fetchPatients(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.patientService.getPatients()
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
          const rawData: PatientCare[] = response || [];

          const owners = rawData
            .filter((item) => item.owner)
            .map((item) => this.mapOwnerPatientRow(item));

          const others = rawData
            .filter((item) => !item.owner)
            .map((item) => this.mapOthersPatientRow(item));

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
    this.patientsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPatients(false);
      }
    };
  }

  private mapOwnerPatientRow(item: PatientCare) {
    return {
      ...item,
      name: item.patient?.name,
      cns: item.patient?.cns,
      document: item.patient?.document,
      document_type: item.patient?.document_type
    };
  }

  private mapOthersPatientRow(item: PatientCare) {
    return {
      ...item,
      name: item.patient?.name,
      cns: item.patient?.cns,
      professional: item.user?.professional?.name
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
    data: PatientDialogData,
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
          this.handlePatientChange();
        }
      });
  }

  private handlePatientChange(): void {
    this.fetchPatients(false);
    this.patientsChannel.postMessage('update');
  }
}