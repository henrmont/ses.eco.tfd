import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';

// Services
import { UserService } from '../../../services/user.service';

type UserValidateDialogData = {
  user?: {
    id: number;
    name?: string;
    professional?: {
      name?: string;
    };
    module?: {
      pivot?: {
        is_valid?: boolean;
      };
    };
  };
};

@Component({
  selector: 'app-user-validate',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './user-validate.component.html',
  styleUrl: './user-validate.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserValidateComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<UserValidateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<UserValidateComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get isValid(): boolean {
    return !!this.data?.user?.module?.pivot?.is_valid;
  }

  protected get userName(): string {
    return this.data?.user?.professional?.name || this.data?.user?.name || 'Usuário';
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSubmit(): void {
    const userId = this.data?.user?.id;

    if (!userId) {
      this.messageService.showMessage('Identificador do usuário inválido.');
      return;
    }

    this.isSubmitting.set(true);

    this.userService.validateUser(userId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Status do usuário atualizado com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar alterar a validação do usuário.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}