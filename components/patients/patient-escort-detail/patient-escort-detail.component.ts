import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { saveAs } from 'file-saver';
import { NgxMaskPipe } from 'ngx-mask';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { StorageService } from '../../../../core/services/storage-service';

@Component({
  selector: 'app-patient-escort-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    NgxMaskPipe
  ],
  templateUrl: './patient-escort-detail.component.html',
  styleUrl: './patient-escort-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientEscortDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly storageService = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Métodos de Interação
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd',archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        }
      });
  }
}