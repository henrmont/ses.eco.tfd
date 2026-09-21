import { ChangeDetectionStrategy, Component, DestroyRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { NgxMaskDirective } from 'ngx-mask';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
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
  selector: 'app-user-create',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    NgxMaskDirective,
    ReactiveFormsModule
  ],
  templateUrl: './user-create.component.html',
  styleUrl: './user-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<UserCreateComponent>);
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
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template
  // ==========================================
  protected onSelection(event: MatSelectChange): void {
    this.evaluateProfessionalControls(event.value);
  }

  protected onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.userService.createUser(this.userForm.getRawValue())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Usuário cadastrado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao criar o usuário.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private initForm(): void {
    this.userForm = this.fb.group({
      name: ['', [Validators.required]],
      email: [
        '', 
        [Validators.required, Validators.email], 
        [this.userService.emailUserExistsValidator(null)]
      ],
      type: ['', [Validators.required]],
      cns: [
        '', 
        [Validators.required], 
        [this.userService.cnsUserExistsValidator(null)]
      ],
      registration: ['', [Validators.required]],
      professional_register: [{ value: '', disabled: true }],
      cbo: [{ value: '', disabled: true }]
    });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.userForm.disable({ emitEvent: false });
        } else {
          this.userForm.enable({ emitEvent: false });
          // Reavalia para manter o estado disabled correto dos campos condicionais após o submit
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