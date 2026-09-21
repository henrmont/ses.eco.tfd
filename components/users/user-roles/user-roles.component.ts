import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';

// Services, Models & Local Components
import { Role } from '../../../models/role.model';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-user-roles',
  standalone: true,
  imports: [
    FormsModule, 
    MatButtonModule, 
    MatCardModule,
    MatDialogModule, 
    MatListModule, 
    MatProgressSpinnerModule,
    MatSlideToggleModule, 
    ReactiveFormsModule
  ],
  templateUrl: './user-roles.component.html',
  styleUrl: './user-roles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserRolesComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<UserRolesComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected userRolesForm!: FormGroup;
  
  protected readonly isLoading = signal<boolean>(true);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly roles = signal<Role[]>([]);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.fetchRoles();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected toggleRole(item: Role): void {
    // Evita modificações caso o formulário esteja submetendo ou desativado
    if (this.isSubmitting() || this.userRolesForm.disabled) return;

    const rolesControl = this.userRolesForm.get('roles');
    if (!rolesControl) return;

    const currentRoles: number[] = [...rolesControl.value];
    const index = currentRoles.indexOf(item.id!);

    if (index !== -1) {
      currentRoles.splice(index, 1);
    } else {
      currentRoles.push(item.id!);
    }

    this.userRolesForm.markAsDirty();
    rolesControl.setValue(currentRoles);
    rolesControl.updateValueAndValidity();
  }

  protected checkRole(id: number): boolean {
    const currentRoles: number[] = this.userRolesForm?.get('roles')?.value || [];
    return currentRoles.includes(id);
  }

  protected formatRoleName(roleName: string): string {
    if (!roleName) return '';
    return roleName.split('/').pop() || roleName;
  }

  protected onSubmit(): void {
    const userId = this.data?.user?.id;
    if (!userId) {
      this.messageService.showMessage('Identificador do usuário inválido.');
      return;
    }

    if (this.userRolesForm.invalid || this.isSubmitting()) {
      this.userRolesForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.userService.rolesUser(userId, this.userRolesForm.getRawValue())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Permissões atualizadas com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar permissões.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const initialRoleIds = this.data?.user?.roles?.map((item: Role) => item.id) || [];

    this.userRolesForm = this.fb.group({
      id: [this.data?.user?.id, [Validators.required]],
      roles: [initialRoleIds]
    });
  }

  private fetchRoles(): void {
    this.userService.getRoles()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: Role[]) => {
          this.roles.set(response || []);
        },
        error: (err) => {
          const fallbackError = 'Erro ao carregar a lista de permissões.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}