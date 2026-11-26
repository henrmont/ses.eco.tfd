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
import { PatientCare } from '../../../models/patient-care.model';
import { PatientReport } from '../../../models/patient-report.model';
import { ReportAttachment } from '../../../models/report-attachment.model';
import { PatientService } from '../../../services/patient.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
} as const;

export interface ReportAttachmentUpdateDialogData {
  patient_care?: PatientCare;
  patient_report?: PatientReport;
  report_attachment?: ReportAttachment;
}

interface AttachmentForm {
  name: FormControl<string>;
}

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-report-attachment-update',
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
  templateUrl: './report-attachment-update.component.html',
  styleUrl: './report-attachment-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportAttachmentUpdateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<ReportAttachmentUpdateDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly storageService = inject(StorageService);
  private readonly dialogRef = inject(MatDialogRef<ReportAttachmentUpdateComponent>);
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

  private readonly patientCareId = this.data?.patient_care?.id ?? null;
  private readonly reportId = this.data?.patient_report?.id ?? null;
  private readonly attachmentId = this.data?.report_attachment?.id ?? null;

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
    this.patientsChannel.close();
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
            saveAs(response.archive, name || `anexo-${archiveId}`);
          }
        },
        error: (err) => {
          const fallbackError = 'Erro ao realizar o download do arquivo.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  protected onSubmit(): void {
    if (!this.patientCareId || !this.reportId || !this.attachmentId) {
      this.messageService.showMessage(
        'Identificadores do atendimento, laudo ou anexo não encontrados.'
      );
      return;
    }

    if (this.isFormInvalidOrPending) {
      this.attachmentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.attachmentForm.disable({ emitEvent: false });

    const payload = this.getUpdatePayload();

    this.patientService
      .updateReportAttachment(this.patientCareId, this.reportId, this.attachmentId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.attachmentForm.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.patientsChannel.postMessage('update');
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
    const currentName = this.data?.report_attachment?.name ?? '';
    this.attachmentForm = this.fb.group<AttachmentForm>({
      name: this.fb.control(currentName, [Validators.required]),
    });
  }

  private getUpdatePayload(): ReportAttachment {
    const payload: Record<string, unknown> = {
      name: this.attachmentForm.controls.name.getRawValue().trim(),
    };

    const file = this.selectedFile();
    if (file) {
      payload['file'] = file;
    }

    return payload as unknown as ReportAttachment;
  }
}