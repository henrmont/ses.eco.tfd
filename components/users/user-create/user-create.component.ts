import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
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
import { NgxMaskDirective } from 'ngx-mask';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';

// Services, Enums & Local Components
import { Professionals } from '../../../enums/professionals';
import { UserService } from '../../../services/user.service';
import { ProfessionalTypesComponent } from '../professional-types/professional-types.component';
import { CustomValidators } from '../../../../core/validators/custom.validator';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-users-channel',
} as const;

interface ProfessionalTypesDialogData {
  selectedTypes: string[];
}

interface ErrorMessage {
  type: string;
  message: string;
}

interface UserCreateForm {
  name: FormControl<string>;
  email: FormControl<string>;
  types: FormControl<string[]>;
  cns: FormControl<string>;
  registration: FormControl<string>;
  professional_register: FormControl<string>;
  cbo: FormControl<string>;
}

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NgxMaskDirective,
    ReactiveFormsModule,
  ],
  templateUrl: './user-create.component.html',
  styleUrl: './user-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCreateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly usersChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<UserCreateComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected userForm!: FormGroup<UserCreateForm>;
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    name: [
      { type: 'required', message: 'O nome é obrigatório.' },
    ],
    email: [
      { type: 'required', message: 'O e-mail é obrigatório.' },
      { type: 'email', message: 'Formato de e-mail inválido.' },
      { type: 'emailExists', message: 'O e-mail informado já está em uso.' },
    ],
    types: [
      { type: 'required', message: 'Selecione ao menos um tipo de profissional.' },
    ],
    cns: [
      { type: 'required', message: 'O CNS é obrigatório.' },
      { type: 'cnsInvalid', message: 'Número de CNS inválido.' },
      { type: 'cnsExists', message: 'O CNS informado já está em uso.' },
    ],
    registration: [
      { type: 'required', message: 'A matrícula é obrigatória.' },
      { type: 'minlength', message: 'A matrícula deve ter no mínimo 5 dígitos.' },
      { type: 'maxlength', message: 'A matrícula deve ter no máximo 6 dígitos.' },
    ],
    professional_register: [
      { type: 'required', message: 'O registro profissional é obrigatório.' },
    ],
    cbo: [
      { type: 'required', message: 'O CBO é obrigatório.' },
    ],
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupProfessionalTypesListener();
  }

  ngOnDestroy(): void {
    this.usersChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected openProfessionalTypesDialog(): void {
    const currentTypes = this.userForm.controls.types.value;
    this.openDialog(ProfessionalTypesComponent, { selectedTypes: currentTypes });
  }

  protected onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.userForm.disable({ emitEvent: false });

    this.userService
      .createUser(this.userForm.getRawValue())
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.userForm.enable({ emitEvent: false });
          this.evaluateProfessionalControls(this.userForm.controls.types.value);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.usersChannel.postMessage('update');
          this.messageService.showMessage(
            response?.message || 'Usuário cadastrado com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao criar o usuário.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    this.userForm = this.fb.group<UserCreateForm>({
      name: this.fb.control('', [Validators.required]),
      email: this.fb.control(
        '',
        [Validators.required, Validators.email],
        [this.userService.emailUserExistsValidator()]
      ),
      types: this.fb.control<string[]>([], [Validators.required]),
      cns: this.fb.control(
        '',
        [Validators.required, CustomValidators.cnsValidator()],
        [this.userService.cnsUserExistsValidator()]
      ),
      registration: this.fb.control('', [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(6),
      ]),
      professional_register: this.fb.control({ value: '', disabled: true }),
      cbo: this.fb.control({ value: '', disabled: true }),
    });
  }

  private setupProfessionalTypesListener(): void {
    this.userForm.controls.types.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedTypes) => {
        this.evaluateProfessionalControls(selectedTypes);
      });
  }

  private evaluateProfessionalControls(selectedTypes: string[]): void {
    const hasMedico = selectedTypes.includes(Professionals.MEDICO);
    const hasAssistenteSocial = selectedTypes.includes(Professionals.ASSISTENTE_SOCIAL);

    const professionalRegisterCtrl = this.userForm.controls.professional_register;
    const cboCtrl = this.userForm.controls.cbo;

    if (hasMedico || hasAssistenteSocial) {
      professionalRegisterCtrl.setValidators([Validators.required]);
      professionalRegisterCtrl.enable({ emitEvent: false });
    } else {
      professionalRegisterCtrl.clearValidators();
      professionalRegisterCtrl.disable({ emitEvent: false });
      professionalRegisterCtrl.reset('', { emitEvent: false });
    }
    professionalRegisterCtrl.updateValueAndValidity({ emitEvent: false });

    if (hasMedico) {
      cboCtrl.setValidators([Validators.required]);
      cboCtrl.enable({ emitEvent: false });
    } else {
      cboCtrl.clearValidators();
      cboCtrl.disable({ emitEvent: false });
      cboCtrl.reset('', { emitEvent: false });
    }
    cboCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: ProfessionalTypesDialogData,
    width = '600px',
    height = 'auto'
  ): void {
    this.dialog
      .open(component, {
        width,
        height,
        disableClose: true,
        autoFocus: false,
        scrollStrategy: this.overlay.scrollStrategies.noop(),
        data,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedTypes: string[] | undefined) => {
        if (selectedTypes) {
          const typesCtrl = this.userForm.controls.types;
          typesCtrl.setValue(selectedTypes);
          typesCtrl.markAsTouched();
        }
      });
  }
}