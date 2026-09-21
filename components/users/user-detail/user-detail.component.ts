import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { NgxMaskPipe } from 'ngx-mask';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    NgxMaskPipe
  ],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDetailComponent {
  // ==========================================
  // Injeção de Dependências e Dados
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
}