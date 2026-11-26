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
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestService } from '../../../services/patient-request.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patient-requests-channel',
} as const;

export interface PatientRequestAttachmentCreateDialogData {
  patient_request?: PatientRequest;
}

interface AttachmentForm {
  name: FormControl<string>;
}

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-request-attachment-create',
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
  templateUrl: './patient-request-attachment-create.component.html',
  styleUrl: './patient-request-attachment-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestAttachmentCreateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly requestsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestAttachmentCreateDialogData | null>(
    MAT_DIALOG_DATA,
    { optional: true }
  );
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAttachmentCreateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected attachmentForm!: FormGroup<AttachmentForm>;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly selectedFile = signal<File | null>(null);

  protected readonly hasFile = computed<boolean>(() => this.selectedFile() !== null);
  protected readonly fileLabel = computed<string>(
    () => this.selectedFile()?.name ?? 'Nenhum arquivo selecionado'
  );

  private readonly patientRequestId = computed<number | null>(() => {
    const id = this.data?.patient_request?.id;
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
      this.attachmentForm.controls.name.markAsDirty();
    }

    input.value = '';
  }

  protected onSubmit(): void {
    const requestId = this.patientRequestId();

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    const file = this.selectedFile();
    if (this.isFormInvalidOrPending || !file) {
      this.attachmentForm.markAllAsTouched();
      if (!file) {
        this.messageService.showMessage('A seleção de um arquivo anexo é obrigatória.');
      }
      return;
    }

    this.isSubmitting.set(true);
    this.attachmentForm.disable({ emitEvent: false });

    const payload = this.getCreatePayload(file);

    this.patientRequestService
      .createPatientRequestAttachment(requestId, payload)
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
          this.messageService.showMessage(response?.message || 'Arquivo anexado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Erro ao processar o upload do anexo.';
          this.messageService.showMessage(fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    this.attachmentForm = this.fb.group<AttachmentForm>({
      name: this.fb.control('', [Validators.required]),
    });
  }

  private getCreatePayload(file: File): PatientRequestAttachment {
    return {
      name: this.attachmentForm.controls.name.getRawValue().trim(),
      file,
    } as unknown as PatientRequestAttachment;
  }
}