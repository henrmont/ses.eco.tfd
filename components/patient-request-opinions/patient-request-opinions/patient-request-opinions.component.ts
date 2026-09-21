import { ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestOpinion } from '../../../models/patient-request-opinion.model';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';

// Dialog Components
import { PatientRequestOpinionCreateComponent } from '../patient-request-opinion-create/patient-request-opinion-create.component';
import { PatientRequestOpinionDeleteComponent } from '../patient-request-opinion-delete/patient-request-opinion-delete.component';
import { PatientRequestOpinionDetailComponent } from '../patient-request-opinion-detail/patient-request-opinion-detail.component';
import { PatientRequestOpinionUpdateComponent } from '../patient-request-opinion-update/patient-request-opinion-update.component';

// Define o tipo aceito para as propriedades dos Modais de Pareceres
type PatientRequestOpinionDialogData =
  | { opinion: PatientRequestOpinion }
  | { patient_request: PatientRequest | undefined };

// Constantes Locais
const TFD_OPINIONS_CHANNEL = new BroadcastChannel('tfd-opinions-channel');

@Component({
  selector: 'app-patient-request-opinions',
  standalone: true,
  imports: [
    CommonModule,
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
export class PatientRequestOpinionsComponent implements OnInit, OnDestroy {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
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

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchOpinions(true);
  }

  ngOnDestroy(): void {
    TFD_OPINIONS_CHANNEL.close();
  }

  // ==========================================
  // Avaliação de Permissões
  // ==========================================
  protected checkPermissions(permissionName: string): boolean {
    const roles = this.data?.permissions || [];
    return !roles.some((role: { permissions?: { name: string }[] }) =>
      role?.permissions?.some((p) => p?.name === permissionName)
    );
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected opinionCreate(): void {
    this.openDialog(PatientRequestOpinionCreateComponent, { patient_request: this.data?.patient_request }, '1200px');
  }

  protected opinionDetail(opinion: PatientRequestOpinion): void {
    this.openDialog(PatientRequestOpinionDetailComponent, { opinion }, '1200px', 'auto', false, false);
  }

  protected opinionUpdate(opinion: PatientRequestOpinion): void {
    this.openDialog(PatientRequestOpinionUpdateComponent, { opinion }, '1200px');
  }

  protected opinionDelete(opinion: PatientRequestOpinion): void {
    this.openDialog(PatientRequestOpinionDeleteComponent, { opinion }, '400px', 'auto', false);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchOpinions(showLoading = false): void {
    const requestId = this.data?.patient_request?.id;

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

  private openDialog<T>(
    component: ComponentType<T>,
    data: PatientRequestOpinionDialogData,
    width = '800px',
    height = 'auto',
    requiresRefresh = true,
    emitGlobalBroadcast = true
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
        if (result) {
          this.fetchOpinions(requiresRefresh);

          if (emitGlobalBroadcast) {
            TFD_OPINIONS_CHANNEL.postMessage('update');
          }
        }
      });
  }
}