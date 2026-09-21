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
import { saveAs } from 'file-saver';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MessageService } from '../../../../core/services/message-service';
import { StorageService } from '../../../../core/services/storage-service';
import { PatientService } from '../../../services/patient.service';

@Component({
  selector: 'app-report-attachment-update',
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
  templateUrl: './report-attachment-update.component.html',
  styleUrl: './report-attachment-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportAttachmentUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly storageService = inject(StorageService);
  private readonly dialogRef = inject(MatDialogRef<ReportAttachmentUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    name: [
      { type: 'required', message: 'O nome do anexo é obrigatório.' }
    ]
  };

  // ==========================================
  // Propriedades e Dados Internos
  // ==========================================
  private selectedFile: File | null = null;

  // ==========================================
  // Gerenciamento de Anexos/Arquivos
  // ==========================================
  protected readonly fileLabel = signal<string>(
    this.data?.report_attachment?.archive_id 
      ? 'Arquivo já cadastrado (Clique para alterar)' 
      : 'Nenhum arquivo selecionado'
  );

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly hasFile = signal<boolean>(false);

  // ==========================================
  // FormGroups e Controles Expostos
  // ==========================================
  protected attachmentForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Inicialização de Formulários
  // ==========================================
  private initForm(): void {
    const currentName = this.data?.report_attachment?.name || null;
    this.attachmentForm = this.fb.group({
      name: [currentName, [Validators.required]]
    });
  }

  // ==========================================
  // Métodos de Interação
  // ==========================================
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFile = file;
      this.fileLabel.set(file.name);
      this.hasFile.set(true);

      const currentName = this.attachmentForm.get('name')?.value;
      if (!currentName) {
        const sanitizedName = file.name.split('.').slice(0, -1).join('.');
        this.attachmentForm.get('name')?.setValue(sanitizedName);
        this.attachmentForm.get('name')?.markAsDirty();
      }

      this.cdr.markForCheck();
    }
  }

  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd',archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        }
      });
  }

  protected isFormsPristine(): boolean {
    return this.attachmentForm.pristine && !this.hasFile();
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const attachmentId = this.data?.report_attachment?.id;

    if (!attachmentId) {
      this.messageService.showMessage('Identificador do anexo não encontrado.');
      return;
    }

    if (this.attachmentForm.invalid) {
      this.attachmentForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      ...this.attachmentForm.getRawValue(),
      file: this.selectedFile
    };

    this.patientService.updateReportAttachment(attachmentId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Anexo atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = err?.error?.message || 'Erro ao processar a atualização do anexo.';
          this.messageService.showMessage(fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
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