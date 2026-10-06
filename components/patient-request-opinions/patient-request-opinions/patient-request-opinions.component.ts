import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Services & Models
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestOpinion } from '../../../models/patient-request-opinion.model';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';

// Dialog Components
import { PatientRequestOpinionCreateComponent } from '../patient-request-opinion-create/patient-request-opinion-create.component';
import { PatientRequestOpinionDeleteComponent } from '../patient-request-opinion-delete/patient-request-opinion-delete.component';
import { PatientRequestOpinionDetailComponent } from '../patient-request-opinion-detail/patient-request-opinion-detail.component';
import { PatientRequestOpinionUpdateComponent } from '../patient-request-opinion-update/patient-request-opinion-update.component';
import { Role } from '../../../models/role.model';

export type PatientRequestOpinionDialogData = {
  opinion?: PatientRequestOpinion;
  patient_request?: PatientRequest;
  roles?: Role[];
};

@Component({
  selector: 'app-patient-request-opinions',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-opinions.component.html',
  styleUrl: './patient-request-opinions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestOpinionsComponent implements OnInit {
  // ==========================================
  // Instância do Broadcast Channel
  // ==========================================
  private readonly opinionsChannel = new BroadcastChannel('tfd-opinions-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestOpinionDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly opinionService = inject(PatientRequestOpinionService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'owner', 'is_approved', 'actions'];
  protected readonly dataSource = new MatTableDataSource<PatientRequestOpinion>([]);
  protected readonly isLoading = signal<boolean>(true);

  private readonly patientRequestId = computed(() => this.data?.patient_request?.id ?? null);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchOpinions(true);
  }

  // ==========================================
  // Avaliação de Permissões
  // ==========================================
  protected checkPermissions(permissionName: string): boolean {
    const roles = this.data?.roles || [];
    return !roles.some((role) =>
      role?.permissions?.some((p) => p?.name === permissionName)
    );
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected opinionCreate(): void {
    this.openDialog(PatientRequestOpinionCreateComponent, { 
      patient_request: this.data?.patient_request 
    }, '1200px');
  }

  protected opinionDetail(opinion: PatientRequestOpinion): void {
    this.openDialog(PatientRequestOpinionDetailComponent, { 
      opinion 
    }, '1200px', 'auto', false);
  }

  protected opinionUpdate(opinion: PatientRequestOpinion): void {
    this.openDialog(PatientRequestOpinionUpdateComponent, { 
      opinion 
    }, '1200px');
  }

  protected opinionDelete(opinion: PatientRequestOpinion): void {
    this.openDialog(PatientRequestOpinionDeleteComponent, { 
      opinion 
    }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchOpinions(showLoading = false): void {
    const requestId = this.patientRequestId();

    if (!requestId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.opinionService.getOpinions(requestId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientRequestOpinion[]) => {
          this.dataSource.data = response || [];
        },
        error: (err) => {
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar os pareceres da solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private setupBroadcastChannel(): void {
    this.opinionsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchOpinions(false);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.opinionsChannel.close();
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: PatientRequestOpinionDialogData,
    width = '800px',
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
    this.fetchOpinions(false);
    this.opinionsChannel.postMessage('update');
  }
}