import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { saveAs } from 'file-saver';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';

// Modelos, Serviços e Componentes Relacionados
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestOpinion } from '../../../models/patient-request-opinion.model';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';
import { StorageService } from '../../../../core/services/storage-service';
import { PatientRequestDetailComponent } from '../../patient-requests/patient-request-detail/patient-request-detail.component';
import { PatientRequestOpinionDetailComponent } from '../patient-request-opinion-detail/patient-request-opinion-detail.component';

@Component({
  selector: 'app-patient-request-history',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatCardModule
  ],
  templateUrl: './patient-request-history.component.html',
  styleUrl: './patient-request-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestHistoryComponent implements OnInit {
  // Injeções de dependência modernas via inject()
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly opinionService = inject(PatientRequestOpinionService);
  private readonly storageService = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  // Propriedades reativas expostas para o Template via Signals
  protected readonly isLoading = signal<boolean>(true);
  protected readonly patient_requests = signal<PatientRequest[]>([]);

  ngOnInit(): void {
    this.getHistoryPatientRequests();
  }

  /**
   * Busca o histórico de requisições de forma reativa e segura.
   */
  private getHistoryPatientRequests(): void {
    const reportId = this.data?.patient_request?.report?.id;
    const requestId = this.data?.patient_request?.id;

    if (!reportId || !requestId) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    this.opinionService.getHistoryPatientRequests(reportId, requestId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.patient_requests.set(response || []);
        },
        error: () => {}
      });
  }

  /**
   * Centraliza a abertura de modais com tipagem genérica básica para reutilização limpa.
   */
  private openDialog(component: any, data: any, options: { width?: string; height?: string } = {}): void {
    this.dialog.open(component, {
      width: options.width || '1200px',
      height: options.height || '700px',
      disableClose: true,
      autoFocus: false,
      data
    });
  }

  // Métodos de ação disparados pelo template HTML (Modificadores Protected)
  protected download(archiveId: number | null | undefined, name: string): void {
    if (!archiveId) return;

    this.storageService.download('tfd',archiveId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.archive) {
            saveAs(response.archive, name);
          }
        },
        error: () => {}
      });
  }

  protected clickEvent(event: MouseEvent): void {
    event.stopPropagation();
  }

  protected showPatientRequest(patient_request: PatientRequest): void {
    this.openDialog(PatientRequestDetailComponent, { patient_request }, { width: '1000px', height: 'auto' });
  }

  protected showOpinion(opinion: PatientRequestOpinion): void {
    this.openDialog(PatientRequestOpinionDetailComponent, { opinion });
  }
}