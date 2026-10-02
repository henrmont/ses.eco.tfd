import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { MessageService } from '../../../../core/services/message-service';
import { Role } from '../../../models/role.model';
import { RoleService } from '../../../services/role.service';

interface RoleDeleteDialogData {
  role?: Role;
}

@Component({
  selector: 'app-role-delete',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule, 
    MatProgressSpinnerModule
  ],
  templateUrl: './role-delete.component.html',
  styleUrl: './role-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<RoleDeleteDialogData>(MAT_DIALOG_DATA, { optional: true });
  private readonly roleService = inject(RoleService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<RoleDeleteComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Métodos Acessíveis pelo Template
  // ==========================================
  protected formatRoleName(name?: string): string {
    if (!name) return '';
    return name.split('/').pop() || name;
  }

  protected onSubmit(): void {
    const roleId = this.data?.role?.id;
    if (!roleId) {
      this.messageService.showMessage('Identificador da regra inválido.');
      return;
    }

    this.isSubmitting.set(true);

    this.roleService.deleteRole(roleId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.messageService.showMessage(response?.message || 'Regra removida com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar remover a regra.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}