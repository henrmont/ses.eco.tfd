import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import { NgxMaskDirective, NgxMaskPipe } from 'ngx-mask';

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
import { PatientRequestOpinionService } from '../../services/patient-request-opinion.service';

// Dialog Components
import { PatientRequestArchiveComponent } from '../../components/patient-request-opinions/patient-request-archive/patient-request-archive.component';
import { PatientRequestFinishBackComponent } from '../../components/patient-request-opinions/patient-request-finish-back/patient-request-finish-back.component';
import { PatientRequestHaltedComponent } from '../../components/patient-request-opinions/patient-request-halted/patient-request-halted.component';
import { PatientRequestHistoryComponent } from '../../components/patient-request-opinions/patient-request-history/patient-request-history.component';
import { PatientRequestMoveFromOthersComponent } from '../../components/patient-request-opinions/patient-request-move-from-others/patient-request-move-from-others.component';
import { PatientRequestMoveFromProcessesComponent } from '../../components/patient-request-opinions/patient-request-move-from-processes/patient-request-move-from-processes.component';
import { PatientRequestOpinionsComponent } from '../../components/patient-request-opinions/patient-request-opinions/patient-request-opinions.component';
import { PatientRequestProcessToCostAssistanceAndTravelComponent } from '../../components/patient-request-opinions/patient-request-process-to-cost-assistance-and-travel/patient-request-process-to-cost-assistance-and-travel.component';
import { PatientRequestProcessToSocialComponent } from '../../components/patient-request-opinions/patient-request-process-to-social/patient-request-process-to-social.component';
import { PatientRequestUndoComponent } from '../../components/patient-request-opinions/patient-request-undo/patient-request-undo.component';
import { PatientRequestAttachmentsComponent } from '../../components/patient-requests/patient-request-attachments/patient-request-attachments.component';
import { PatientRequestDetailComponent } from '../../components/patient-requests/patient-request-detail/patient-request-detail.component';

// Define o tipo aceito para as propriedades do Modal
type PatientRequestDialogData = 
  | { patient_request: PatientRequest }
  | { patient_request: PatientRequest; type: 'medical' | 'social' }
  | { patient_request: PatientRequest; permissions: any };


@Component({
  selector: 'app-patient-request-opinions-page',
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
    NgxMaskDirective,
    NgxMaskPipe
  ],
  templateUrl: './patient-request-opinions.page.html',
  styleUrl: './patient-request-opinions.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestOpinionsPage implements OnInit, OnDestroy {
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

  protected readonly profileType = signal<'medical' | 'social'>('medical');

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
    this.opinionsChannel.close();
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

  // Ações disparadas pelos botões da tabela
  protected patientRequestDetail(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestDetailComponent, { patient_request: patientRequest }, '1000px', 'auto', false);
  }

  protected patientRequestMoveFromOthers(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestMoveFromOthersComponent, { patient_request: patientRequest, type: this.profileType() }, '400px');
  }

  protected patientRequestMoveFromProcesses(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestMoveFromProcessesComponent, { patient_request: patientRequest, type: this.profileType() }, '400px');
  }

  protected patientRequestOpinions(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestOpinionsComponent, { patient_request: patientRequest, permissions: this.currentUser?.roles }, '800px', 'auto', false);
  }

  protected patientRequestHistory(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestHistoryComponent, { patient_request: patientRequest, type: this.profileType() }, '800px', 'auto', false);
  }

  protected patientRequestProcessToSocial(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestProcessToSocialComponent, { patient_request: patientRequest }, '500px');
  }

  protected patientRequestProcessToCostAssistanceAndTravel(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestProcessToCostAssistanceAndTravelComponent, { patient_request: patientRequest }, '500px');
  }

  protected patientRequestUndo(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestUndoComponent, { patient_request: patientRequest, type: this.profileType() }, '500px');
  }

  protected patientRequestHalted(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestHaltedComponent, { patient_request: patientRequest, type: this.profileType() }, '400px');
  }

  protected patientRequestArchive(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestArchiveComponent, { patient_request: patientRequest }, '400px');
  }

  protected patientRequestFinishBack(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestFinishBackComponent, { patient_request: patientRequest, type: this.profileType() }, '400px');
  }

  protected patientRequestAttachments(patientRequest: PatientRequest): void {
    this.openDialog(PatientRequestAttachmentsComponent, { patient_request: patientRequest }, '600px', 'auto', false);
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

    this.opinionService.getType()
      .pipe(
        switchMap((profileResponse) => {
          const isMedical = profileResponse === 'Médico';
          this.profileType.set(isMedical ? 'medical' : 'social');
          return this.opinionService.getPatientRequests();
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
          const isMedical = this.profileType() === 'medical';

          const normalizedRequests = rawData.map((item) => this.mapPatientRequestRow(item));

          // 1. Caixa de Entrada (Owner)
          const owners = normalizedRequests.filter((item) =>
            isMedical
              ? (!item.social_professional || item.back_to_medical) && item.medical
              : (!item.cost_assistance_professional || item.back_to_social) && item.social
          );

          // 2. Em Processamento (Process)
          const processes = normalizedRequests.filter((item) =>
            isMedical
              ? (item.social_professional && !item.back_to_medical) && item.medical
              : (item.cost_assistance_professional && !item.back_to_social) && item.social
          );

          // 3. Outros Pareceres (Others)
          const others = normalizedRequests.filter((item) =>
            isMedical
              ? item.medical_professional && !item.medical
              : item.social_professional && !item.social
          );

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
    this.opinionsChannel.onmessage = (message: MessageEvent<string>) => {
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
      professional: item.social_professional?.name || item.medical_professional?.name
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
          this.handleOpinionChange();
        }
      });
  }

  private handleOpinionChange(): void {
    this.fetchPatientRequests(false);
    this.opinionsChannel.postMessage('update');
  }
}