import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { saveAs } from 'file-saver';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Models e Enums
import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// Dialog Components
import { PatientRequestAttachmentCreateComponent } from '../patient-request-attachment-create/patient-request-attachment-create.component';
import { PatientRequestAttachmentDeleteComponent } from '../patient-request-attachment-delete/patient-request-attachment-delete.component';
import { PatientRequestAttachmentUpdateComponent } from '../patient-request-attachment-update/patient-request-attachment-update.component';

// Define o tipo aceito para as propriedades dos Modais de Anexos
type PatientRequestAttachmentDialogData =
  | { patient_request_attachment: PatientRequestAttachment }
  | { patient_request: PatientRequest | undefined };

  // Nomes dos canais do módulo TFD
type TfdChannelKey = 'REQUESTS' | 'TRAVELS' | 'OPINIONS' | 'COST_ASSISTANCES';

const TFD_CHANNEL_NAMES: Record<TfdChannelKey, string> = {
  REQUESTS: 'tfd-patient-requests-channel',
  TRAVELS: 'tfd-travels-channel',
  OPINIONS: 'tfd-opinions-channel',
  COST_ASSISTANCES: 'tfd-cost-assistances-channel'
};


@Component({
  selector: 'app-patient-request-attachments',
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
  templateUrl: './patient-request-attachments.component.html',
  styleUrl: './patient-request-attachments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAttachmentsComponent implements OnInit{
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly storageService = inject(StorageService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'actions'];
  protected readonly dataSource = new MatTableDataSource<PatientRequestAttachment>([]);
  protected readonly isLoading = signal<boolean>(true);

  // ==========================================
  // Mapa de instâncias dos BroadcastChannels do TFD
  // ==========================================
  private readonly channels = new Map<TfdChannelKey, BroadcastChannel>();

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchPatientRequestAttachments(true);

    // Instancia todos os canais quando o layout é carregado
    (Object.keys(TFD_CHANNEL_NAMES) as TfdChannelKey[]).forEach(key => {
      this.channels.set(key, new BroadcastChannel(TFD_CHANNEL_NAMES[key]));
    });
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd',archiveId)
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
    this.openDialog(PatientRequestAttachmentCreateComponent, { patient_request: this.data?.patient_request });
  }

  protected patientRequestAttachmentUpdate(patientRequestAttachment: PatientRequestAttachment): void {
    this.openDialog(PatientRequestAttachmentUpdateComponent, { patient_request_attachment: patientRequestAttachment });
  }

  protected patientRequestAttachmentDelete(patientRequestAttachment: PatientRequestAttachment): void {
    this.openDialog(PatientRequestAttachmentDeleteComponent, { patient_request_attachment: patientRequestAttachment }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchPatientRequestAttachments(showLoading = false): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.isLoading.set(false);
      this.cdr.markForCheck();
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.patientRequestService.getPatientRequestAttachments(requestId)
      .pipe(
        finalize(() => {
          this.isLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const rawData: PatientRequestAttachment[] = response || [];
          this.dataSource.data = rawData;
        },
        error: (err) => {
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar os anexos da solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  /**
   * Método auxiliar para emitir mensagens com segurança no canal especificado
   */
  public postMessage(channelKey: TfdChannelKey, message: any = 'update'): void {
    const channel = this.channels.get(channelKey);
    if (channel) {
      channel.postMessage(message);
    }
  }

  private openDialog<T>(
    component: new (...args: any[]) => T,
    data: PatientRequestAttachmentDialogData,
    width = '400px',
    height = 'auto',
    requiresRefresh = true,
    emitGlobalBroadcast = true,
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
          this.fetchPatientRequestAttachments(requiresRefresh);
          
          if (emitGlobalBroadcast) {
            for (const channelKey of Object.keys(TFD_CHANNEL_NAMES) as TfdChannelKey[]) {
              this.postMessage(channelKey, 'update');
            }
          }
          this.cdr.markForCheck();
        }
        if (result) {
        }
      });
  }
}