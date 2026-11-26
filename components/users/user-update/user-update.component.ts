import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message.service';

// Services, Models, Enums & Local Components
import { Professionals } from '../../../enums/professionals';
import { ProfessionalType } from '../../../models/professional-type.model';
import { TfdUser as User } from '../../../models/user.model';
import { UserService } from '../../../services/user.service';
import { ProfessionalTypesComponent } from '../professional-types/professional-types.component';
import { CustomValidators } from '../../../../core/validators/custom.validator';

interface ProfessionalTypesDialogData {
  selectedTypes: string[];
}

interface UserUpdateDialogData {
  user?: User
}

interface ErrorMessage {
  type: string;
  message: string;
}

interface UserUpdateForm {
  name: FormControl<string>;
  email: FormControl<string>;
  types: FormControl<string[]>;
  cns: FormControl<string>;
  registration: FormControl<string>;
  professional_register: FormControl<string>;
  cbo: FormControl<string>;
}

@Component({
  selector: 'app-user-update',
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
  templateUrl: './user-update.component.html',
  styleUrl: './user-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<UserUpdateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<UserUpdateComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected userForm!: FormGroup<UserUpdateForm>;
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    name: [
      { type: 'required', message: 'O nome é obrigatório.' },
    ],
    email: [
      { type: 'required', message: 'O e-mail é obrigatório.' },
      { type: 'email', message: 'Formato de e-mail inválido.' },
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
    this.evaluateProfessionalControls(this.userForm.controls.types.value);
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected openProfessionalTypesDialog(): void {
    const currentTypes = this.userForm.controls.types.value;
    this.openDialog(ProfessionalTypesComponent, { selectedTypes: currentTypes });
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
    this.userForm.disable({ emitEvent: false });

    this.userService
      .updateUser(userId, this.userForm.getRawValue())
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.userForm.enable({ emitEvent: false });
          this.userForm.controls.email.disable({ emitEvent: false });
          this.evaluateProfessionalControls(this.userForm.controls.types.value);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(
            response?.message || 'Usuário atualizado com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar o usuário.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private initForm(): void {
    const user = this.data?.user;
    const professional = user?.professional;
    const initialEmail = user?.email ?? '';
    const initialCns = professional?.cns ?? '';

    const initialTypes: string[] = professional?.types
      ? professional.types.map((t: ProfessionalType | string) =>
        typeof t === 'string' ? t : t.type
      )
      : [];

    this.userForm = this.fb.group<UserUpdateForm>({
      name: this.fb.control(professional?.name ?? user?.name ?? '', [Validators.required]),
      email: this.fb.control(
        { value: initialEmail, disabled: true },
        [Validators.required, Validators.email]
      ),
      types: this.fb.control<string[]>(initialTypes, [Validators.required]),
      cns: this.fb.control(
        initialCns,
        [Validators.required, CustomValidators.cnsValidator()],
        [this.userService.cnsUserExistsValidator(initialCns || null)]
      ),
      registration: this.fb.control(professional?.registration ?? '', [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(6),
      ]),
      professional_register: this.fb.control({
        value: professional?.professional_register ?? '',
        disabled: true,
      }),
      cbo: this.fb.control({
        value: professional?.cbo ?? '',
        disabled: true,
      }),
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
          const typesControl = this.userForm.controls.types;

          typesControl.setValue(selectedTypes);
          typesControl.markAsTouched();
          typesControl.markAsDirty();
          this.userForm.markAsDirty();
        }
      });
  }
}