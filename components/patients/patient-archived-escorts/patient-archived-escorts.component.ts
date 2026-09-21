import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { saveAs } from 'file-saver';
import { NgxMaskPipe } from 'ngx-mask';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';

// Models, Services & Core
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';
import { StorageService } from '../../../../core/services/storage-service';

@Component({
  selector: 'app-patient-archived-escorts',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatCardModule,
    NgxMaskPipe
  ],
  templateUrl: './patient-archived-escorts.component.html',
  styleUrl: './patient-archived-escorts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientArchivedEscortsComponent implements OnInit {
  // Injeção de dependências
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly patientService = inject(PatientService);
  private readonly storageService = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  // Signals reativos
  protected readonly isLoading = signal<boolean>(true);
  protected readonly escorts = signal<PatientEscort[]>([]);

  ngOnInit(): void {
    this.fetchPatientEscorts();
  }

  private fetchPatientEscorts(): void {
    const patientCareId = this.data?.patient_care?.id;

    if (!patientCareId) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    this.patientService.getPatientEscorts(patientCareId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientEscort[]) => {
          this.escorts.set(response || []);
        },
        error: () => {
          this.escorts.set([]);
        }
      });
  }

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

  protected clickEvent(event: MouseEvent): void {
    event.stopPropagation();
  }
}