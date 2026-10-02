import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { NgxMaskPipe } from 'ngx-mask';

// Models
import { ProfessionalType } from '../../../models/professional-type.model';

export type UserDetailDialogData = {
  user?: {
    id?: string;
    name?: string;
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

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
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
  protected readonly data = inject<UserDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get user() {
    return this.data?.user;
  }

  protected get professional() {
    return this.user?.professional;
  }

  protected get professionalTypes(): string[] {
    const rawTypes = this.professional?.types;
    if (!rawTypes || !Array.isArray(rawTypes)) return [];

    return rawTypes.map(t => (typeof t === 'string' ? t : t.type));
  }
}