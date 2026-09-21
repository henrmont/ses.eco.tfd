import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { saveAs } from 'file-saver';

// Material Modules
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// Services e Enums
import { StorageService } from '../../../../core/services/storage-service';
import { Specialty } from '../../../enums/specialties';

@Component({
  selector: 'app-patient-report-detail',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './patient-report-detail.component.html',
  styleUrl: './patient-report-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientReportDetailComponent {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly storageService = inject(StorageService);

  // ==========================================
  // Getters & Propriedades Computadas
  // ==========================================
  protected get specialtyLabel(): string {
    const rawSpecialty = this.data?.patient_report?.specialty;
    return Specialty[rawSpecialty as keyof typeof Specialty] ?? rawSpecialty ?? 'Não informado';
  }

  // ==========================================
  // Métodos Públicos / Eventos
  // ==========================================
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) {
      return;
    }

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