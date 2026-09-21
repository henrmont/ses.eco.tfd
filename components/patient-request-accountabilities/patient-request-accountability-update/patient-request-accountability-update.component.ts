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
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';

@Component({
  selector: 'app-patient-request-accountability-update',
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
    MatIconModule
  ],
  templateUrl: './patient-request-accountability-update.component.html',
  styleUrl: './patient-request-accountability-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestAccountabilityUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestAccountabilityUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Formulário Principal
  // ==========================================
  protected updateAccountabilityForm!: FormGroup;

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Dicionário de Mensagens de Erro
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    name: [
      { type: 'required', message: 'O nome da prestação de contas é obrigatório.' }
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
  // Inicialização do Formulário
  // ==========================================
  private initForm(): void {
    const accountability = this.data?.accountability;

    this.updateAccountabilityForm = this.fb.group({
      name: [accountability?.name ?? null, [Validators.required]],
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
          this.updateAccountabilityForm.disable({ emitEvent: false });
        } else {
          this.updateAccountabilityForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Submissão do Formulário
  // ==========================================
  /**
   * Submete o formulário para atualização da prestação de contas.
   */
  protected onSubmit(): void {
    const accountabilityId = this.data?.accountability?.id;

    if (!accountabilityId) {
      this.messageService.showMessage('Identificador da prestação de contas não encontrado.');
      return;
    }

    if (this.updateAccountabilityForm.invalid) {
      this.updateAccountabilityForm.markAllAsTouched();
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.updateAccountabilityForm.getRawValue();

    this.accountabilityService.updateAccountability(accountabilityId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Prestação de contas atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Ocorreu um erro ao atualizar a prestação de contas.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}