import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { saveAs } from 'file-saver';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
} as const;

export interface PatientRequestAttachmentUpdateDialogData {
  patient_request?: PatientRequest;
  patient_request_attachment?: PatientRequestAttachment;
}

interface AttachmentForm {
  name: FormControl<string>;
}

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-request-attachment-update',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  templateUrl: './patient-request-attachment-update.component.html',
  styleUrl: './patient-request-attachment-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestAttachmentUpdateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAttachmentUpdateDialogData | null>(
    MAT_DIALOG_DATA,
    { optional: true }
  );
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly storageService = inject(StorageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAttachmentUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected attachmentForm!: FormGroup<AttachmentForm>;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isDownloading = signal<boolean>(false);
  protected readonly selectedFile = signal<File | null>(null);

  protected readonly hasFile = computed<boolean>(() => this.selectedFile() !== null);
  protected readonly fileLabel = computed<string>(
    () => this.selectedFile()?.name ?? 'Nenhum arquivo selecionado'
  );

  private readonly attachmentId = computed<number | null>(() => {
    const id = this.data?.patient_request_attachment?.id;
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
  });

  // Mapeamento de Mensagens de Erro
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    name: [
      { type: 'required', message: 'O nome do anexo é obrigatório.' },
    ],
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
  }

  ngOnDestroy(): void {
    this.requestsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected get isFormInvalidOrPending(): boolean {
    return this.attachmentForm.invalid || this.attachmentForm.pending;
  }

  protected isFormPristine(): boolean {
    return this.attachmentForm.pristine && !this.hasFile();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) return;

    this.selectedFile.set(file);

    const currentName = this.attachmentForm.controls.name.value.trim();
    if (!currentName) {
      const lastDotIndex = file.name.lastIndexOf('.');
      const sanitizedName = lastDotIndex > 0 ? file.name.slice(0, lastDotIndex) : file.name;
      this.attachmentForm.controls.name.setValue(sanitizedName);
    }

    this.attachmentForm.markAsDirty();
    input.value = '';
  }

  protected download(archiveId: number | null | undefined, name?: string): void {
    if (!archiveId || this.isDownloading()) return;

    this.isDownloading.set(true);

    this.storageService
      .download('tfd', archiveId)
      .pipe(
        finalize(() => this.isDownloading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, name?.trim() || `anexo-${archiveId}`);
          }
        },
        error: (err) => {
          const fallbackError = 'Erro ao realizar o download do arquivo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  protected onSubmit(): void {
    const id = this.attachmentId();

    if (!id) {
      this.messageService.showMessage('Identificador do anexo não encontrado.');
      return;
    }

    if (this.isFormInvalidOrPending) {
      this.attachmentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.attachmentForm.disable({ emitEvent: false });

    const payload = this.getUpdatePayload();

    this.patientRequestService
      .updatePatientRequestAttachment(id, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.attachmentForm.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.requestsChannel.postMessage('update');
          this.messageService.showMessage(response?.message || 'Anexo atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao processar a atualização do anexo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const currentName = this.data?.patient_request_attachment?.name ?? '';
    this.attachmentForm = this.fb.group<AttachmentForm>({
      name: this.fb.control(currentName, [Validators.required]),
    });
  }

  private getUpdatePayload(): PatientRequestAttachment {
    const payload: Record<string, unknown> = {
      name: this.attachmentForm.controls.name.getRawValue().trim(),
    };

    const file = this.selectedFile();
    if (file) {
      payload['file'] = file;
    }

    return payload as unknown as PatientRequestAttachment;
  }
}