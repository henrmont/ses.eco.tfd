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
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientCare } from '../../models/patient-care.model';
import { Permission } from '../../models/permission.model';
import { PatientService } from '../../services/patient.service';
import { Patient } from '../../models/patient.model';

// Dialog Components
import { PatientDetailComponent } from '../../components/patients/patient-detail/patient-detail.component';
import { PatientArchivedEscortsComponent } from '../../components/patients/patient-archived-escorts/patient-archived-escorts.component';
import { PatientArchivedReportsComponent } from '../../components/patients/patient-archived-reports/patient-archived-reports.component';
import { PatientMoveFromArchiveComponent } from '../../components/patients/patient-move-from-archive/patient-move-from-archive.component';

// Define o tipo aceito para as propriedades do Modal
type PatientDialogData =
  | { patient: Patient | undefined }
  | { patient_care: PatientCare };

@Component({
  selector: 'app-archive-patients-page',
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
    NgxMaskPipe
  ],
  templateUrl: './archive-patients.page.html',
  styleUrl: './archive-patients.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArchivePatientsPage implements OnInit, OnDestroy {
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
  private readonly archiveSort = viewChild<MatSort>('archiveSort');
  private readonly archivePaginator = viewChild<MatPaginator>('archivePaginator');

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  private loadingDialog!: MatDialogRef<LoadingComponent>;
  private readonly currentUser = this.route.parent?.parent?.snapshot.data['user'];

  protected readonly displayedColumns: string[] = ['name', 'cns', 'responsible', 'status', 'actions'];
  protected readonly archivedDataSource = new MatTableDataSource<PatientCare>([]);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchArchivePatients(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
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

    const hasPermission = this.currentUser.roles.some((role: any) =>
      role.permissions?.some((perm: Permission) => perm.name === permissionName)
    );

    return !hasPermission;
  }

  // Ações disparadas pelos botões da tabela
  protected patientDetail(patientCare: PatientCare): void {
    this.openDialog(PatientDetailComponent, { patient: patientCare.patient }, '1200px', '700px', false);
  }

  protected patientEscorts(patientCare: PatientCare): void {
    this.openDialog(PatientArchivedEscortsComponent, { patient_care: patientCare }, '800px', 'auto', false);
  }

  protected patientReports(patientCare: PatientCare): void {
    this.openDialog(PatientArchivedReportsComponent, { patient_care: patientCare }, '800px', 'auto', false);
  }

  protected patientMoveFromArchive(patientCare: PatientCare): void {
    this.openDialog(PatientMoveFromArchiveComponent, { patient_care: patientCare }, '400px');
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

  private fetchArchivePatients(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.patientService.getArchivePatients()
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
          const archivedPatients = rawData.map((item) => this.mapArchivedPatientRow(item));
          this.archivedDataSource.data = archivedPatients;
        },
        error: () => {
          this.archivedDataSource.data = [];
        }
      });
  }

  private listenToBroadcastChannel(): void {
    this.patientsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchArchivePatients(false);
      }
    };
  }

  private mapArchivedPatientRow(item: PatientCare) {
    return {
      ...item,
      name: item.patient?.name,
      cns: item.patient?.cns,
      responsible: item.user?.professional?.name
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
    this.fetchArchivePatients(false);
    this.patientsChannel.postMessage('update');
  }
}