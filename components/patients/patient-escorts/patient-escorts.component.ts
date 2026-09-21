import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { NgxMaskPipe } from 'ngx-mask';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';

// Dialog Components
import { PatientEscortCreateComponent } from '../patient-escort-create/patient-escort-create.component';
import { PatientEscortDeleteComponent } from '../patient-escort-delete/patient-escort-delete.component';
import { PatientEscortDetailComponent } from '../patient-escort-detail/patient-escort-detail.component';
import { PatientEscortUpdateComponent } from '../patient-escort-update/patient-escort-update.component';

// Define o tipo aceito para as propriedades dos Modais de Acompanhante
type PatientEscortDialogData =
  | { patient_escort: PatientEscort }
  | { patient_care: PatientCare | undefined }
  | { patient_care: PatientCare | undefined; patient_escort: PatientEscort };

// Constantes Locais
const TFD_PATIENTS_CHANNEL = new BroadcastChannel('tfd-patients-channel');

@Component({
  selector: 'app-patient-escorts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    NgxMaskPipe
  ],
  templateUrl: './patient-escorts.component.html',
  styleUrl: './patient-escorts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientEscortsComponent implements OnInit, OnDestroy {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly patientService = inject(PatientService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'document', 'cns', 'status', 'actions'];
  protected readonly dataSource = new MatTableDataSource<PatientEscort>([]);
  protected readonly isLoading = signal<boolean>(true);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchPatientEscorts(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    TFD_PATIENTS_CHANNEL.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected patientEscortDetail(patientEscort: PatientEscort): void {
    this.openDialog(PatientEscortDetailComponent, { patient_escort: patientEscort }, '800px', 'auto', false);
  }

  protected patientEscortCreate(): void {
    this.openDialog(PatientEscortCreateComponent, { patient_care: this.data?.patient_care });
  }

  protected patientEscortUpdate(patientEscort: PatientEscort): void {
    this.openDialog(PatientEscortUpdateComponent, {
      patient_care: this.data?.patient_care,
      patient_escort: patientEscort
    });
  }

  protected patientEscortDelete(patientEscort: PatientEscort): void {
    this.openDialog(PatientEscortDeleteComponent, { patient_escort: patientEscort }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchPatientEscorts(showLoading = false): void {
    const patientCareId = this.data?.patient_care?.id;

    if (!patientCareId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.patientService.getPatientEscorts(patientCareId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const rawData: PatientEscort[] = response || [];

          this.dataSource.data = rawData;
        },
        error: () => {
          this.dataSource.data = [];
        }
      });

      
  }

  private listenToBroadcastChannel(): void {
    TFD_PATIENTS_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPatientEscorts(false);
      }
    };
  }

  private openDialog<T>(
    component: new (...args: any[]) => T,
    data: PatientEscortDialogData,
    width = '800px',
    height = 'auto',
    requiresRefresh = true
  ): void {
    this.dialog.open(component, {
      width,
      height,
      disableClose: true,
      autoFocus: false,
      scrollStrategy: this.overlay.scrollStrategies.noop(),
      data
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result && requiresRefresh) {
          this.handleEscortChange();
        }
      });
  }

  private handleEscortChange(): void {
    this.fetchPatientEscorts(false);
    TFD_PATIENTS_CHANNEL.postMessage('update');
  }
}