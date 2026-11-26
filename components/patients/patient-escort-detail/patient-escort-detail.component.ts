import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// Bibliotecas de Terceiros
import { saveAs } from 'file-saver';
import { NgxMaskPipe, provideNgxMask } from 'ngx-mask';

// Core, Services & Models
import { StorageService } from '../../../../core/services/storage.service';
import { PatientEscort } from '../../../models/patient-escort.model';

interface PatientEscortDetailDialogData {
  patient_escort?: PatientEscort;
}

@Component({
  selector: 'app-patient-escort-detail',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule,
    NgxMaskPipe,
  ],
  providers: [provideNgxMask()],
  templateUrl: './patient-escort-detail.component.html',
  styleUrl: './patient-escort-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientEscortDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientEscortDetailDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly storageService = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly isDownloading = signal<boolean>(false);

  protected readonly escort = computed<PatientEscort | null>(
    () => this.data?.patient_escort ?? null
  );

  protected readonly formattedBirthDate = computed<string>(() => {
    const rawDate = this.escort()?.birth_date;
    if (!rawDate) return 'Não informado';

    return this.formatIsoToBrDate(String(rawDate));
  });

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId || this.isDownloading()) return;

    this.isDownloading.set(true);

    this.storageService
      .download('tfd', archiveId)
      .pipe(
        finalize(() => this.isDownloading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        },
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private formatIsoToBrDate(rawDate: string): string {
    const cleanDate = rawDate.split(' ')[0].split('T')[0];
    const [year, month, day] = cleanDate.split('-');

    if (!year || !month || !day) return 'Não informado';
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
}