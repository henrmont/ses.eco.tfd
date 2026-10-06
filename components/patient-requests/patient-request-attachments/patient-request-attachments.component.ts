import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { saveAs } from 'file-saver';

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
import { StorageService } from '../../../../core/services/storage-service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// Dialog Components
import { PatientRequestAttachmentCreateComponent } from '../patient-request-attachment-create/patient-request-attachment-create.component';
import { PatientRequestAttachmentDeleteComponent } from '../patient-request-attachment-delete/patient-request-attachment-delete.component';
import { PatientRequestAttachmentUpdateComponent } from '../patient-request-attachment-update/patient-request-attachment-update.component';

type PatientRequestAttachmentDialogData = {
  patient_request?: PatientRequest;
  patient_request_attachment?: PatientRequestAttachment;
};

@Component({
  selector: 'app-patient-request-attachments',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-attachments.component.html',
  styleUrl: './patient-request-attachments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAttachmentsComponent implements OnInit {
  // ==========================================
  // Instância do Broadcast Channel
  // ==========================================
  private readonly patientRequestsChannel = new BroadcastChannel('tfd-patient-requests-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAttachmentDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly storageService = inject(StorageService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'actions'];
  protected readonly dataSource = new MatTableDataSource<PatientRequestAttachment>([]);
  protected readonly isLoading = signal<boolean>(true);

  private readonly patientRequestId = computed(() => this.data?.patient_request?.id ?? null);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchPatientRequestAttachments(true);
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd', archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        }
      });
  }

  protected patientRequestAttachmentCreate(): void {
    this.openDialog(PatientRequestAttachmentCreateComponent, {
      patient_request: this.data?.patient_request
    });
  }

  protected patientRequestAttachmentUpdate(patientRequestAttachment: PatientRequestAttachment): void {
    this.openDialog(PatientRequestAttachmentUpdateComponent, {
      patient_request: this.data?.patient_request,
      patient_request_attachment: patientRequestAttachment
    });
  }

  protected patientRequestAttachmentDelete(patientRequestAttachment: PatientRequestAttachment): void {
    this.openDialog(PatientRequestAttachmentDeleteComponent, {
      patient_request: this.data?.patient_request,
      patient_request_attachment: patientRequestAttachment
    }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchPatientRequestAttachments(showLoading = false): void {
    const requestId = this.patientRequestId();

    if (!requestId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.patientRequestService.getPatientRequestAttachments(requestId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientRequestAttachment[]) => {
          this.dataSource.data = response || [];
        },
        error: (err) => {
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar os anexos da solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private setupBroadcastChannel(): void {
    this.patientRequestsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPatientRequestAttachments(false);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.patientRequestsChannel.close();
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: PatientRequestAttachmentDialogData,
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
          this.handleAttachmentChange();
        }
      });
  }

  private handleAttachmentChange(): void {
    this.fetchPatientRequestAttachments(false);
    this.patientRequestsChannel.postMessage('update');
  }
}