import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// File Handling & Utils
import { saveAs } from 'file-saver';
import { NgxMaskPipe } from 'ngx-mask';

// Services & Models
import { StorageService } from '../../../../core/services/storage-service';
import { PatientEscort } from '../../../models/patient-escort.model';

type PatientEscortDetailDialogData = {
  patient_escort?: PatientEscort;
};

@Component({
  selector: 'app-patient-escort-detail',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule,
    NgxMaskPipe
  ],
  templateUrl: './patient-escort-detail.component.html',
  styleUrl: './patient-escort-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientEscortDetailComponent {
  // ==========================================
  // Injeção de Dependências e Dados
  // ==========================================
  protected readonly data = inject<PatientEscortDetailDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly storageService = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Getters para Facilitação do Template
  // ==========================================
  protected get escort(): PatientEscort | undefined {
    return this.data?.patient_escort;
  }

  // ==========================================
  // Operações de Arquivo / Download
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd', archiveId)
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