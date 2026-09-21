import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Core & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';

// Services & Local Components
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-user-delete',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './user-delete.component.html',
  styleUrl: './user-delete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDeleteComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly userService = inject(UserService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<UserDeleteComponent>);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

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

    this.userService.deleteUser(userId)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Usuário removido com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar remover o usuário.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}