import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { finalize, startWith } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { Role } from '../../../../core/models/role.model';
import { MessageService } from '../../../../core/services/message.service';

// Services & Models
import { TfdUser as User } from '../../../models/user.model';
import { RoleService } from '../../../services/role.service';
import { UserService } from '../../../services/user.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-users-channel',
} as const;

export interface UserRolesDialogData {
  user?: User;
}

interface UserRolesForm {
  roles: FormControl<number[]>;
}

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
    ReactiveFormsModule,
  ],
  templateUrl: './user-roles.component.html',
  styleUrl: './user-roles.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserRolesComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly usersChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<UserRolesDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly userService = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<UserRolesComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly userRolesForm: FormGroup<UserRolesForm>;

  protected readonly isLoading = signal<boolean>(true);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly roles = signal<Role[]>([]);

  private readonly selectedRoleIdsSignal;
  private readonly selectedRoleSet = computed<Set<number>>(
    () => new Set(this.selectedRoleIdsSignal())
  );

  // ==========================================
  // Getters Utilitários
  // ==========================================
  protected get user(): User | undefined {
    return this.data?.user;
  }

  protected get userName(): string {
    return this.user?.professional?.name || this.user?.name || 'Usuário';
  }

  constructor() {
    const initialRoleIds =
      this.user?.roles
        ?.map((item: Role) => item.id)
        .filter((id): id is number => id !== undefined) ?? [];

    this.userRolesForm = this.fb.group<UserRolesForm>({
      roles: this.fb.control<number[]>(initialRoleIds),
    });

    this.selectedRoleIdsSignal = toSignal(
      this.userRolesForm.controls.roles.valueChanges.pipe(startWith(initialRoleIds)),
      { initialValue: initialRoleIds }
    );
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchRoles();
  }

  ngOnDestroy(): void {
    this.usersChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected toggleRole(item: Role): void {
    if (!item.id || this.isSubmitting() || this.userRolesForm.disabled) return;

    const rolesControl = this.userRolesForm.controls.roles;
    const currentSet = new Set(rolesControl.value);

    if (currentSet.has(item.id)) {
      currentSet.delete(item.id);
    } else {
      currentSet.add(item.id);
    }

    this.userRolesForm.markAsDirty();
    rolesControl.setValue(Array.from(currentSet));
    rolesControl.updateValueAndValidity();
  }

  protected checkRole(id?: number): boolean {
    if (!id) return false;
    return this.selectedRoleSet().has(id);
  }

  protected formatRoleName(roleName?: string): string {
    if (!roleName) return 'Sem nome';
    return roleName.split('/').pop() || roleName;
  }

  protected onSubmit(): void {
    const userId = this.user?.id;
    if (!userId) {
      this.messageService.showMessage('Identificador do usuário inválido.');
      return;
    }

    if (this.userRolesForm.invalid || this.isSubmitting()) {
      this.userRolesForm.markAllAsTouched();
      return;
    }

    const selectedIds = this.selectedRoleSet();
    const selectedRoles = this.roles().filter(
      (role): role is Role => role.id !== undefined && selectedIds.has(role.id)
    );

    this.isSubmitting.set(true);
    this.userRolesForm.disable({ emitEvent: false });

    this.userService
      .rolesUser(userId, selectedRoles)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.userRolesForm.enable({ emitEvent: false });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.usersChannel.postMessage('update');
          this.messageService.showMessage(
            response?.message || 'Permissões atualizadas com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar permissões.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchRoles(): void {
    this.roleService
      .getRoles()
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
        },
      });
  }
}