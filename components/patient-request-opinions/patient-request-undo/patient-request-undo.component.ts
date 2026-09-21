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

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

// Services, Models e Interfaces
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';

@Component({
  selector: 'app-patient-request-undo',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatSelectModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-undo.component.html',
  styleUrl: './patient-request-undo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestUndoComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly opinionService = inject(PatientRequestOpinionService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestUndoComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    reason: [
      { type: 'required', message: 'A justificativa do retorno é obrigatória.' }
    ],
    to: [
      { type: 'required', message: 'A definição do setor de destino é obrigatória.' }
    ]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // FormGroups
  // ==========================================
  protected undoForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Inicialização de Formulário
  // ==========================================
  private initForm(): void {
    this.undoForm = this.fb.group({
      reason: [null, [Validators.required]],
      to: [null, [Validators.required]]
    });
  }

  // ==========================================
  // Handlers Reativos
  // ==========================================
  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.undoForm.disable({ emitEvent: false });
        } else {
          this.undoForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    if (this.undoForm.invalid) {
      this.undoForm.markAllAsTouched();
      return;
    }

    const requestId = this.data?.patient_request?.id;
    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.undoForm.getRawValue();

    this.opinionService.undoPatientRequest(requestId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Solicitação devolvida com sucesso!');
          this.dialogRef.close(true);
        },
        error: err => {
          const fallbackError = 'Erro ao tentar devolver a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}