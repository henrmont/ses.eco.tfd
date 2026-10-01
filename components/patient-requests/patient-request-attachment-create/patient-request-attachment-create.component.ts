import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  Injector,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { PatientRequestService } from '../../../services/patient-request.service';

interface AttachedFileState {
  file: File | null;
  label: ReturnType<typeof signal<string>>;
  hasFile: ReturnType<typeof signal<boolean>>;
}

@Component({
  selector: 'app-patient-request-attachment-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-attachment-create.component.html',
  styleUrl: './patient-request-attachment-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAttachmentCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAttachmentCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected attachmentForm!: FormGroup;

  protected readonly isSubmitting = signal<boolean>(false);

  // Gerenciamento de Anexos/Arquivos
  protected readonly attachmentFile: AttachedFileState = {
    file: null,
    label: signal('Nenhum arquivo selecionado'),
    hasFile: signal(false)
  };

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    name: [
      { type: 'required', message: 'O nome do anexo é obrigatório.' }
    ]
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  /**
   * Captura e processa o arquivo carregado no input nativo.
   */
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.attachmentFile.file = file;
      this.attachmentFile.label.set(file.name);
      this.attachmentFile.hasFile.set(true);

      const currentName = this.attachmentForm.get('name')?.value;
      if (!currentName) {
        const sanitizedName = file.name.split('.').slice(0, -1).join('.');
        this.attachmentForm.get('name')?.setValue(sanitizedName);
        this.attachmentForm.get('name')?.markAsDirty();
      }

      this.cdr.markForCheck();
    }
  }

  /**
   * Processa a submissão e upload do anexo vinculado à solicitação do paciente.
   */
  protected onSubmit(): void {
    const patientRequestId = this.data?.patient_request?.id || this.data?.patientRequest?.id;

    if (!patientRequestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    if (this.attachmentForm.invalid || !this.attachmentFile.file) {
      this.attachmentForm.markAllAsTouched();

      if (!this.attachmentFile.file) {
        this.messageService.showMessage('A seleção de um arquivo anexo é obrigatória.');
      }
      return;
    }

    this.isSubmitting.set(true);

    const attachmentPayload = {
      ...this.attachmentForm.getRawValue(),
      file: this.attachmentFile.file
    };

    this.patientRequestService.createPatientRequestAttachment(patientRequestId, attachmentPayload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Arquivo anexado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Erro ao processar o upload do anexo.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    this.attachmentForm = this.fb.group({
      name: [null, [Validators.required]]
    });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.attachmentForm.disable({ emitEvent: false });
        } else {
          this.attachmentForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }
}