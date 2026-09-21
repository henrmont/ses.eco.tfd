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
  signal, 
  viewChild 
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { NgxMaskDirective, NgxMaskPipe } from 'ngx-mask';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Models e Serviços
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { PatientRequest } from '../../models/patient-request.model';
import { Permission } from '../../models/permission.model';
import { Role } from '../../models/role.model';
import { PatientRequestOpinionService } from '../../services/patient-request-opinion.service';

// Dialog Components
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestOpinionsComponent } from '../../components/patient-request-opinions/patient-request-opinions/patient-request-opinions.component';
import { PatientRequestMoveFromArchiveComponent } from '../../components/patient-request-opinions/patient-request-move-from-archive/patient-request-move-from-archive.component';

// Define o tipo aceito para as propriedades dos Modais
type PatientRequestDialogData =
  | { patient_request: PatientRequest }
  | { patient_request: PatientRequest; type: 'medical' | 'social' }
  | { patient_request: PatientRequest; permissions: Role[] };

@Component({
  selector: 'app-archive-patient-request-opinions-page',
  standalone: true,
  imports: [
    CommonModule,
    MatBadgeModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    NgxMaskDirective,
    NgxMaskPipe,
  ],
  templateUrl: './archive-patient-request-opinions.page.html',
  styleUrl: './archive-patient-request-opinions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArchivePatientRequestOpinionsPage implements OnInit, OnDestroy {
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
  private readonly currentUser = this.route.parent?.parent?.snapshot.data['user'];

  protected readonly profileType = signal<'medical' | 'social'>('medical');
  protected readonly displayedColumns: string[] = [
    'name',
    'cns',
    'type',
    'medical_responsible',
    'social_responsible',
    'actions',
  ];

  protected readonly archivedDataSource = new MatTableDataSource<any>([]);

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
  protected showPatientRequest(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestDetailComponent, { patient_request: patientRequest }, '1000px', 'auto', false);
  }

  protected movePatientRequestFromArchive(patientRequest: PatientRequest): void {
    this.openDialog(
      PatientRequestMoveFromArchiveComponent,
      { patient_request: patientRequest, type: this.profileType() },
      '400px'
    );
  }

  protected opinions(patientRequest: PatientRequest): void {
    this.openDialog(
      PatientRequestOpinionsComponent,
      { patient_request: patientRequest, permissions: this.currentUser?.roles },
      '800px',
      'auto',
      false
    );
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(
      () => {
        const sortRef = this.archiveSort();
        const paginatorRef = this.archivePaginator();

        if (sortRef) this.archivedDataSource.sort = sortRef;
        if (paginatorRef) this.archivedDataSource.paginator = paginatorRef;
      },
      { injector: this.injector }
    );
  }

  private fetchArchivePatientRequests(showLoading = false): void {
    if (showLoading) this.openLoading();

    this.opinionService
      .getType()
      .pipe(
        switchMap((profileResponse) => {
          const isMedical = profileResponse === 'Médico';
          this.profileType.set(isMedical ? 'medical' : 'social');
          return this.opinionService.getArchivePatientRequests();
        }),
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

          const archivedRequests = rawData.map((item) => this.mapPatientRequestRow(item));

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

  private mapPatientRequestRow(item: any) {
    return {
      ...item,
      name: item.report?.patient_care?.patient?.name || 'Não informado',
      cns: item.report?.patient_care?.patient?.cns || '',
      type: item.type,
      medical_responsible: item.medical_professional?.name || '-',
      social_responsible: item.social_professional?.name || '-',
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
    this.fetchArchivePatientRequests(false);
    this.opinionsChannel.postMessage('update');
  }
}