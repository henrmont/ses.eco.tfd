import { ChangeDetectionStrategy, Component, DestroyRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { NgxMaskDirective } from 'ngx-mask';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';

// Services, Enums & Local Components
import { Professionals } from '../../../enums/professionals';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-user-update',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    NgxMaskDirective,
    ReactiveFormsModule
  ],
  templateUrl: './user-update.component.html',
  styleUrl: './user-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<UserUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected userForm!: FormGroup;
  protected readonly types: string[] = Object.values(Professionals);
  protected readonly isSubmitting = signal<boolean>(false);

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    name: [
      { type: 'required', message: 'O nome é obrigatório.' }
    ],
    email: [
      { type: 'required', message: 'O e-mail é obrigatório.' },
      { type: 'email', message: 'Formato de e-mail inválido.' },
      { type: 'emailExists', message: 'O e-mail informado já está em uso.' }
    ],
    type: [
      { type: 'required', message: 'Selecione o tipo de profissional.' }
    ],
    cns: [
      { type: 'required', message: 'O CNS é obrigatório.' },
      { type: 'cnsExists', message: 'O CNS informado já está em uso.' }
    ],
    registration: [
      { type: 'required', message: 'A matrícula é obrigatória.' }
    ]
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.loadInitialPermissions();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template
  // ==========================================
  protected onSelection(event: MatSelectChange): void {
    this.evaluateProfessionalControls(event.value);
    this.userForm.markAsDirty();
  }

  protected onSubmit(): void {
    const userId = this.data?.user?.id;
    
    if (!userId) {
      this.messageService.showMessage('Identificador do usuário inválido.');
      return;
    }

    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.userService.updateUser(userId, this.userForm.getRawValue())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Usuário atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar o usuário.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private initForm(): void {
    const professional = this.data?.user?.professional;
    const initialEmail = this.data?.user?.email || null;
    const initialCns = professional ? professional.cns : null;

    this.userForm = this.fb.group({
      name: [professional ? professional.name : '', [Validators.required]],
      email: [
        initialEmail, 
        [Validators.required, Validators.email], 
        [this.userService.emailUserExistsValidator(initialEmail)]
      ],
      type: [professional ? professional.type : '', [Validators.required]],
      cns: [
        initialCns, 
        [Validators.required], 
        [this.userService.cnsUserExistsValidator(initialCns)]
      ],
      registration: [professional ? professional.registration : '', [Validators.required]],
      professional_register: [{ value: professional ? professional.professional_register : '', disabled: true }],
      cbo: [{ value: professional ? professional.cbo : '', disabled: true }]
    });
  }

  private loadInitialPermissions(): void {
    const initialType = this.userForm.get('type')?.value;
    if (initialType) {
      this.evaluateProfessionalControls(initialType);
    }
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.userForm.disable({ emitEvent: false });
        } else {
          this.userForm.enable({ emitEvent: false });
          this.evaluateProfessionalControls(this.userForm.get('type')?.value);
        }
      });
  }

  private evaluateProfessionalControls(selectedType: string): void {
    const isMedico = selectedType === Professionals.MEDICO;
    const isAssistenteSocial = selectedType === Professionals.ASSISTENTE_SOCIAL;

    const professionalRegisterCtrl = this.userForm.get('professional_register');
    const cboCtrl = this.userForm.get('cbo');

    if (isMedico || isAssistenteSocial) {
      professionalRegisterCtrl?.enable();
    } else {
      professionalRegisterCtrl?.disable();
      professionalRegisterCtrl?.reset();
    }

    if (isMedico) {
      cboCtrl?.enable();
    } else {
      cboCtrl?.disable();
      cboCtrl?.reset();
    }
  }
}