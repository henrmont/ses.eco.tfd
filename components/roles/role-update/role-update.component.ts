import { ChangeDetectionStrategy, Component, DestroyRef, inject, Injector, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

// Core & Models
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';

// Services, Enums & Local Components
import { Permission } from '../../../models/permission.model';
import { RoleService } from '../../../services/role.service';

@Component({
  selector: 'app-role-update',
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
    ReactiveFormsModule
  ],
  templateUrl: './role-update.component.html',
  styleUrl: './role-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<RoleUpdateComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected roleForm!: FormGroup;

  protected readonly isLoading = signal<boolean>(true);
  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly permissions = signal<Permission[]>([]);

  protected readonly permissionGroups = [
    { label: 'USUÁRIOS', icon: 'people', filter: 'usuário' },
    { label: 'REGRAS', icon: 'security', filter: 'regra' },
    { label: 'UNIDADES HOSPITALARES', icon: 'domain', filter: 'unidade hospitalar' },
    { label: 'DATASUS', icon: 'medical_services', filter: 'datasus' },
    { label: 'CONFIGURAÇÕES', icon: 'settings', filter: 'configuração' },
    { label: 'PACIENTES', icon: 'personal_injury', filter: 'paciente' },
    { label: 'SOLICITAÇÕES', icon: 'assignment', filter: 'solicitação' },
    { label: 'PARECERES', icon: 'grading', filter: 'parecer' },
    { label: 'PASSAGENS', icon: 'luggage', filter: 'passagem' },
    { label: 'AJUDAS DE CUSTO', icon: 'price_check', filter: 'ajuda de custo' },
    { label: 'PAGAMENTOS', icon: 'payments', filter: 'pagamento' }
  ];

  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    name: [{ type: 'required', message: 'O nome da regra é obrigatório.' }],
    permissions: [{ type: 'invalidPermissions', message: 'Selecione as permissões válidas para esta regra.' }]
  };

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.fetchPermissions();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template
  // ==========================================
  protected getFilteredRole(groupFilter: string): Permission[] {
    return this.permissions().filter((permission: Permission) => {
      const name = permission.name;
      const slashIndex = name.indexOf('/');
      const lastSpaceIndex = name.lastIndexOf(' ');

      if (slashIndex === -1) return false;

      const intermediateWord = lastSpaceIndex > slashIndex 
        ? name.substring(slashIndex + 1, lastSpaceIndex) 
        : name.substring(slashIndex + 1);

      return intermediateWord.trim().toLowerCase() === groupFilter.toLowerCase();
    });
  }

  protected togglePermission(item: Permission): void {
    // Evita modificações caso o formulário esteja submetendo ou desativado
    if (this.isSubmitting() || this.roleForm.disabled) return;

    const permissionsControl = this.roleForm.get('permissions');
    if (!permissionsControl) return;

    const currentPermissions: number[] = [...(permissionsControl.value || [])];
    const index = currentPermissions.indexOf(item.id);

    if (index !== -1) {
      currentPermissions.splice(index, 1);
    } else {
      currentPermissions.push(item.id);
    }

    permissionsControl.setValue(currentPermissions);
    permissionsControl.markAsDirty();
    permissionsControl.updateValueAndValidity();
  }

  protected checkPermission(id: number): boolean {
    const permissions = this.roleForm.get('permissions')?.value;
    return Array.isArray(permissions) ? permissions.includes(id) : false;
  }

  protected onSubmit(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.roleService.updateRole(this.data?.role?.id, this.roleForm.getRawValue())
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.messageService.showMessage(response?.message || 'Regra atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao atualizar a regra.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados
  // ==========================================
  private initForm(): void {
    const roleName = this.data?.role?.name ? this.data.role.name.split('/')[1] : '';
    const rolePermissions = this.data?.role?.permissions 
      ? this.data.role.permissions.map((item: Permission) => item.id) 
      : [];

    this.roleForm = this.fb.group({
      name: [roleName, [Validators.required]],
      permissions: [rolePermissions, [CustomValidators.permissionsValidator(2)]]
    });
  }

  private fetchPermissions(): void {
    this.roleService.getPermissions()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.permissions.set(response || []);
        },
        error: (err) => {
          const fallbackError = 'Erro ao carregar lista de permissões.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.roleForm.disable({ emitEvent: false });
        } else {
          this.roleForm.enable({ emitEvent: false });
        }
      });
  }
}