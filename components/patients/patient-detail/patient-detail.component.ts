import { Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NgxMaskPipe } from 'ngx-mask';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { saveAs } from 'file-saver';
import { StorageService } from '../../../../core/services/storage-service';

@Component({
  selector: 'app-patient-detail',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule, 
    NgxMaskPipe
  ],
  templateUrl: './patient-detail.component.html',
  styleUrl: './patient-detail.component.scss'
})
export class PatientDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storageService = inject(StorageService);

  // ==========================================
  // Métodos de Ação
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd',archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        }
      });
  }
}