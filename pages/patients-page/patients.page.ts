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
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models (Padrão alias "as User")
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { Permission } from '../../../core/models/permission.model';
import { Role } from '../../../core/models/role.model';
import { PatientCare } from '../../models/patient-care.model';
import { Patient } from '../../models/patient.model';
import { TfdUser as User } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { PatientService } from '../../services/patient.service';

// Dialog Components
import { PatientArchiveComponent } from '../../components/patients/patient-archive/patient-archive.component';
import { PatientDetailComponent } from '../../components/patients/patient-detail/patient-detail.component';
import { PatientEscortsComponent } from '../../components/patients/patient-escorts/patient-escorts.component';
import { PatientFinishBackComponent } from '../../components/patients/patient-finish-back/patient-finish-back.component';
import { PatientMoveFromOthersComponent } from '../../components/patients/patient-move-from-others/patient-move-from-others.component';
import { PatientReportsComponent } from '../../components/patients/patient-reports/patient-reports.component';
import { PatientRequirementComponent } from '../../components/patients/patient-requirement/patient-requirement.component';
import { PatientUpdateComponent } from '../../components/patients/patient-update/patient-update.component';
import { PatientValidateComponent } from '../../components/patients/patient-validate/patient-validate.component';

// ============================================================================
// CONFIGURAÇÃO DO MÓDULO (Único bloco a ajustar ao replicar para outro módulo)
// ============================================================================
const PAGE_CONFIG = {
  channelName: 'tfd-patients-channel',
  permissionPrefix: 'tfd/',
} as const;

// Estrutura dos dados para exibição das tabelas
interface OwnerPatientTableRow extends PatientCare {
  name: string;
  fullName: string;
  cns: string;
  document: string;
  document_type: string;
}

interface OthersPatientTableRow extends PatientCare {
  name: string;
  fullName: string;
  cns: string;
  document: string;
  document_type: string;
  professional: string;
  fullProfessional: string;
}

interface PatientDialogData {
  patient?: Patient;
  patient_care?: PatientCare;
}

@Component({
  selector: 'app-patients-page',
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
    MatTabsModule,
    MatTooltipModule,
    NgxMaskPipe,
  ],
  providers: [provideNgxMask()],
  templateUrl: './patients.page.html',
  styleUrl: './patients.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientsPage implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(PAGE_CONFIG.channelName);

  // Injeção de Dependências
  private readonly patientService = inject(PatientService);
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
    'name',
    'cns',
    'document',
    'status',
    'actions',
  ];

  protected readonly displayedOthersColumns: string[] = [
    'name',
    'cns',
    'document',
    'responsible',
    'status',
    'actions',
  ];

  protected readonly ownerDataSource = new MatTableDataSource<OwnerPatientTableRow>([]);
  protected readonly othersDataSource = new MatTableDataSource<OthersPatientTableRow>([]);

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
    this.fetchPatients(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
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
  protected patientDetail(patientCare: PatientCare): void {
    this.openDialog(PatientDetailComponent, { patient_care: patientCare }, '1200px', '700px', false);
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

  protected patientRequirement(patientCare: PatientCare): void {
    this.openDialog(PatientRequirementComponent, { patient_care: patientCare }, '500px');
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private fetchPatients(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.patientService
      .getPatients()
      .pipe(
        finalize(() => {
          if (showLoading && this.loadingDialog) {
            this.loadingDialog.close();
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientCare[]) => {
          const rawData = response || [];

          this.ownerDataSource.data = rawData
            .filter((item) => item.owner)
            .map((item) => this.mapOwnerPatientRow(item));

          this.othersDataSource.data = rawData
            .filter((item) => !item.owner)
            .map((item) => this.mapOthersPatientRow(item));
        },
        error: () => {
          this.ownerDataSource.data = [];
          this.othersDataSource.data = [];
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.patientsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPatients(false);
      }
    };
  }

  private mapOwnerPatientRow(item: PatientCare): OwnerPatientTableRow {
    const rawName = item.patient?.name?.trim() || '-';

    return {
      ...item,
      name: this.formatPatientName(rawName),
      fullName: rawName,
      cns: item.patient?.cns || '-',
      document: item.patient?.document || '-',
      document_type: item.patient?.document_type || '-',
    };
  }

  private mapOthersPatientRow(item: PatientCare): OthersPatientTableRow {
    const rawName = item.patient?.name?.trim() || '-';
    const rawProfessional = item.user?.professional?.name?.trim() || '-';

    return {
      ...item,
      name: this.formatPatientName(rawName),
      fullName: rawName,
      cns: item.patient?.cns || '-',
      document: item.patient?.document || '-',
      document_type: item.patient?.document_type || '-',
      professional: this.formatResponsibleName(rawProfessional),
      fullProfessional: rawProfessional,
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
    data: PatientDialogData,
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
          this.handlePatientChange();
        }
      });
  }

  private handlePatientChange(): void {
    this.fetchPatients(false);
    this.patientsChannel.postMessage('update');
  }
}