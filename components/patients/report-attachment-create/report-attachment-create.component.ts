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

// Core & Services
import { MessageService } from '../../../../core/services/message-service';
import { PatientService } from '../../../services/patient.service';

@Component({
  selector: 'app-report-attachment-create',
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
  templateUrl: './report-attachment-create.component.html',
  styleUrl: './report-attachment-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportAttachmentCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<ReportAttachmentCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Formulários e Estados Reativos
  // ==========================================
  protected attachmentForm!: FormGroup;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly hasFile = signal<boolean>(false);
  protected readonly fileLabel = signal<string>('Nenhum arquivo selecionado');

  private selectedFile: File | null = null;

  // ==========================================
  // Dicionários e Mensagens de Erro
  // ==========================================
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
   * Manipula a seleção do arquivo via input do tipo file.
   */
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

  /**
   * Envia o formulário e realiza a criação do anexo do laudo.
   */
  protected onSubmit(): void {
    const patientReportId = this.data?.patient_report?.id;

    if (!patientReportId) {
      this.messageService.showMessage('Identificador do laudo não encontrado.');
      return;
    }

    if (this.attachmentForm.invalid || !this.selectedFile) {
      this.attachmentForm.markAllAsTouched();

      if (!this.selectedFile) {
        this.messageService.showMessage('A seleção de um arquivo anexo é obrigatória.');
      }
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      ...this.attachmentForm.getRawValue(),
      file: this.selectedFile
    };

    this.patientService.createReportAttachment(patientReportId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
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