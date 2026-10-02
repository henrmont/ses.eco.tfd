import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { MessageService } from '../../../../core/services/message-service';

// Services, Enums & Local Components
import { Professionals } from '../../../enums/professionals';
import { UserService } from '../../../services/user.service';
import { ProfessionalTypesComponent } from '../professional-types/professional-types.component';
import { ProfessionalType } from '../../../models/professional-type.model';

type ProfessionalTypesDialogData = {
  selectedTypes: string[];
};

type UserUpdateDialogData = {
  user?: {
    id: number;
    email?: string;
    professional?: {
      name?: string;
      cns?: string;
      registration?: string;
      professional_register?: string;
      cbo?: string;
      types?: Array<ProfessionalType | string>;
    };
  };
};

interface ErrorMessage {
  type: string;
  message: string;
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
  protected userForm!: FormGroup;
  protected readonly isSubmitting = signal<boolean>(false);

  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    name: [
      { type: 'required', message: 'O nome é obrigatório.' }
    ],
    email: [
      { type: 'required', message: 'O e-mail é obrigatório.' },
      { type: 'email', message: 'Formato de e-mail inválido.' }
    ],
    types: [
      { type: 'required', message: 'Selecione ao menos um tipo de profissional.' }
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
    this.setupProfessionalTypesListener();
    this.loadInitialPermissions();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected openProfessionalTypesDialog(): void {
    const currentTypes: string[] = this.userForm.get('types')?.value || [];
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

    this.userService.updateUser(userId, this.userForm.getRawValue())
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.userForm.enable({ emitEvent: false });
          this.userForm.get('email')?.disable({ emitEvent: false });
          this.evaluateProfessionalControls(this.userForm.get('types')?.value || []);
        }),
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

    const initialTypes: string[] = professional?.types
      ? professional.types.map((t: ProfessionalType | string) => typeof t === 'string' ? t : t.type)
      : [];

    this.userForm = this.fb.group({
      name: [professional ? professional.name : '', [Validators.required]],
      email: [{ value: initialEmail, disabled: true }, [Validators.required, Validators.email]],
      types: [initialTypes, [Validators.required]],
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
    const initialTypes = this.userForm.get('types')?.value || [];
    this.evaluateProfessionalControls(initialTypes);
  }

  private setupProfessionalTypesListener(): void {
    this.userForm.get('types')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedTypes: string[]) => {
        this.evaluateProfessionalControls(selectedTypes || []);
      });
  }

  private evaluateProfessionalControls(selectedTypes: string[]): void {
    const hasMedico = selectedTypes.includes(Professionals.MEDICO);
    const hasAssistenteSocial = selectedTypes.includes(Professionals.ASSISTENTE_SOCIAL);

    const professionalRegisterCtrl = this.userForm.get('professional_register');
    const cboCtrl = this.userForm.get('cbo');

    if (hasMedico || hasAssistenteSocial) {
      professionalRegisterCtrl?.enable();
    } else {
      professionalRegisterCtrl?.disable();
      professionalRegisterCtrl?.reset();
    }

    if (hasMedico) {
      cboCtrl?.enable();
    } else {
      cboCtrl?.disable();
      cboCtrl?.reset();
    }
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: ProfessionalTypesDialogData,
    width = '600px',
    height = 'auto'
  ): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      data
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedTypes: string[]) => {
        if (selectedTypes) {
          const typesControl = this.userForm.get('types');

          typesControl?.setValue(selectedTypes);
          typesControl?.markAsTouched();
          typesControl?.markAsDirty();
          this.userForm.markAsDirty();
        }
      });
  }
}