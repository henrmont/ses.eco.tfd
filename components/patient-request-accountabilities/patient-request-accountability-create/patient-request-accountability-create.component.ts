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

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

@Component({
  selector: 'app-patient-request-accountability-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './patient-request-accountability-create.component.html',
  styleUrl: './patient-request-accountability-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientRequestAccountabilityCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAccountabilityCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    name: [
      { type: 'required', message: 'O nome da prestação de contas é obrigatório.' }
    ]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // FormGroups
  // ==========================================
  protected createAccountabilityForm!: FormGroup;

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
    this.createAccountabilityForm = this.fb.group({
      name: [null, [Validators.required]]
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
          this.createAccountabilityForm.disable({ emitEvent: false });
        } else {
          this.createAccountabilityForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    if (this.createAccountabilityForm.invalid) {
      this.createAccountabilityForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.createAccountabilityForm.getRawValue();

    this.accountabilityService
      .createAccountability(requestId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Prestação de contas criada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao criar a prestação de contas.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}