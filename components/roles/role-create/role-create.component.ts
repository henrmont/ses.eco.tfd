import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
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
  Validators,
} from '@angular/forms';
import { finalize, startWith } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { Permission } from '../../../../core/models/permission.model';
import { Role } from '../../../../core/models/role.model';
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';

// Services
import { RoleService } from '../../../services/role.service';

// ============================================================================
// CONFIGURAÇÃO DO COMPONENTE
// ============================================================================
const COMPONENT_CONFIG = {
  channelName: 'tfd-roles-channel',
} as const;

interface ErrorMessage {
  type: string;
  message: string;
}

interface PermissionGroup {
  label: string;
  icon: string;
  filter: string;
}

interface RoleCreateForm {
  name: FormControl<string>;
  permissions: FormControl<number[]>;
}

@Component({
  selector: 'app-role-create',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
  ],
  templateUrl: './role-create.component.html',
  styleUrl: './role-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleCreateComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly rolesChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly roleService = inject(RoleService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<RoleCreateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly roleForm: FormGroup<RoleCreateForm>;

  protected readonly isLoading = signal<boolean>(true);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly permissions = signal<Permission[]>([]);

  private readonly selectedPermissionIdsSignal;
  private readonly selectedPermissionSet = computed<Set<number>>(
    () => new Set(this.selectedPermissionIdsSignal())
  );

  protected readonly permissionGroups: readonly PermissionGroup[] = [
    { label: 'USUÁRIOS', icon: 'people', filter: 'usuário' },
    { label: 'REGRAS', icon: 'security', filter: 'regra' },
    { label: 'CONFIGURAÇÕES', icon: 'settings', filter: 'configuração' },
    { label: 'PACIENTES', icon: 'personal_injury', filter: 'paciente' },
    { label: 'SOLICITAÇÕES', icon: 'assignment', filter: 'solicitação' },
    { label: 'PARECERES', icon: 'grading', filter: 'parecer' },
    { label: 'PASSAGENS', icon: 'luggage', filter: 'passagem' },
    { label: 'AJUDAS DE CUSTO', icon: 'price_check', filter: 'ajuda de custo' },
    { label: 'PAGAMENTOS', icon: 'payments', filter: 'pagamento' },
  ];

  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    name: [
      { type: 'required', message: 'O nome da regra é obrigatório.' },
    ],
    permissions: [
      { type: 'invalidPermissions', message: 'Selecione as permissões válidas para esta regra.' },
    ],
  };

  // ==========================================
  // Getters Utilitários
  // ==========================================
  protected get selectedPermissions(): number[] {
    return this.roleForm.controls.permissions.value;
  }

  constructor() {
    this.roleForm = this.fb.group<RoleCreateForm>({
      name: this.fb.control('', [Validators.required]),
      permissions: this.fb.control<number[]>([], [CustomValidators.permissionsValidator()]),
    });

    this.selectedPermissionIdsSignal = toSignal(
      this.roleForm.controls.permissions.valueChanges.pipe(startWith<number[]>([])),
      { initialValue: [] }
    );

    effect(() => {
      if (this.isSubmitting()) {
        this.roleForm.disable({ emitEvent: false });
      } else {
        this.roleForm.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchPermissions();
  }

  ngOnDestroy(): void {
    this.rolesChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected getFilteredRole(groupFilter: string): Permission[] {
    const target = groupFilter.trim().toLowerCase();

    return this.permissions().filter((permission: Permission) => {
      const name = permission.name || '';
      const slashIndex = name.indexOf('/');
      const lastSpaceIndex = name.lastIndexOf(' ');

      if (slashIndex === -1) return false;

      const intermediateWord =
        lastSpaceIndex > slashIndex
          ? name.substring(slashIndex + 1, lastSpaceIndex)
          : name.substring(slashIndex + 1);

      return intermediateWord.trim().toLowerCase() === target;
    });
  }

  protected isPermissionSelected(id?: number): boolean {
    if (!id) return false;
    return this.selectedPermissionSet().has(id);
  }

  protected formatPermissionName(name?: string): string {
    if (!name) return '';
    return name.split('/').pop() || name;
  }

  protected togglePermission(item: Permission): void {
    if (!item.id || this.isSubmitting() || this.roleForm.disabled) return;

    const permissionsControl = this.roleForm.controls.permissions;
    const currentSet = new Set(permissionsControl.value);

    if (currentSet.has(item.id)) {
      currentSet.delete(item.id);
    } else {
      currentSet.add(item.id);
    }

    permissionsControl.setValue(Array.from(currentSet));
    permissionsControl.markAsDirty();
    permissionsControl.updateValueAndValidity();
  }

  protected onSubmit(): void {
    if (this.roleForm.invalid || this.isSubmitting()) {
      this.roleForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const payload = this.roleForm.getRawValue() as unknown as Role;

    this.roleService
      .createRole(payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.rolesChannel.postMessage('update');
          this.messageService.showMessage(
            response?.message || 'Regra criada com sucesso!'
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao criar a regra.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private fetchPermissions(): void {
    this.roleService
      .getPermissions()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: Permission[]) => {
          this.permissions.set(response || []);
        },
        error: (err) => {
          const fallbackError = 'Erro ao carregar lista de permissões.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        },
      });
  }
}