import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { NgxMaskPipe, provideNgxMask } from 'ngx-mask';

// Angular Material & CDK
import { ComponentType, Overlay } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core & Models
import { MessageService } from '../../../../core/services/message-service';
import { PatientCare } from '../../../models/patient-care.model';
import { PatientEscort } from '../../../models/patient-escort.model';
import { PatientService } from '../../../services/patient.service';

// Dialog Components
import { PatientEscortCreateComponent } from '../patient-escort-create/patient-escort-create.component';
import { PatientEscortDeleteComponent } from '../patient-escort-delete/patient-escort-delete.component';
import { PatientEscortDetailComponent } from '../patient-escort-detail/patient-escort-detail.component';
import { PatientEscortRequirementComponent } from '../patient-escort-requirement/patient-escort-requirement.component';
import { PatientEscortUpdateComponent } from '../patient-escort-update/patient-escort-update.component';

const COMPONENT_CONFIG = {
  channelName: 'tfd-patients-channel',
  defaultDialogWidth: '800px',
  requirementDialogWidth: '500px',
  confirmDialogWidth: '400px',
} as const;

export type PatientEscortDialogData = {
  patient_care?: PatientCare;
  patient_escort?: PatientEscort;
};

type EscortTableRow = PatientEscort & {
  name: string;
  fullName: string;
};

@Component({
  selector: 'app-patient-escorts',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    NgxMaskPipe,
  ],
  providers: [provideNgxMask()],
  templateUrl: './patient-escorts.component.html',
  styleUrl: './patient-escorts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientEscortsComponent implements OnInit, OnDestroy {
  // Canais de Comunicação Externa
  private readonly patientsChannel = new BroadcastChannel(COMPONENT_CONFIG.channelName);

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientEscortDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly patientService = inject(PatientService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: readonly string[] = [
    'name',
    'document',
    'cns',
    'status',
    'actions',
  ];
  protected readonly dataSource = new MatTableDataSource<EscortTableRow>([]);
  protected readonly isLoading = signal<boolean>(true);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchPatientEscorts(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    this.patientsChannel.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected patientEscortDetail(row: EscortTableRow): void {
    this.openDialog(
      PatientEscortDetailComponent,
      { patient_escort: this.toRawEscort(row) },
      COMPONENT_CONFIG.defaultDialogWidth,
      'auto',
      false
    );
  }

  protected patientEscortCreate(): void {
    this.openDialog(PatientEscortCreateComponent, {
      patient_care: this.data?.patient_care,
    });
  }

  protected patientEscortUpdate(row: EscortTableRow): void {
    this.openDialog(PatientEscortUpdateComponent, {
      patient_care: this.data?.patient_care,
      patient_escort: this.toRawEscort(row),
    });
  }

  protected patientEscortDelete(row: EscortTableRow): void {
    this.openDialog(
      PatientEscortDeleteComponent,
      {
        patient_care: this.data?.patient_care,
        patient_escort: this.toRawEscort(row),
      },
      COMPONENT_CONFIG.confirmDialogWidth,
      'auto',
      true
    );
  }

  protected patientEscortRequirement(row: EscortTableRow): void {
    this.openDialog(
      PatientEscortRequirementComponent,
      { patient_escort: this.toRawEscort(row) },
      COMPONENT_CONFIG.requirementDialogWidth,
      'auto',
      false
    );
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

    this.patientService
      .getPatientEscorts(patientCareId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientEscort[]) => {
          this.dataSource.data = (response || []).map((item) => this.mapEscortRow(item));
        },
        error: (err) => {
          this.dataSource.data = [];
          this.messageService.showMessage(
            err?.error?.message || 'Erro ao carregar os acompanhantes do paciente.'
          );
        },
      });
  }

  private listenToBroadcastChannel(): void {
    this.patientsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPatientEscorts(false);
      }
    };
  }

  private mapEscortRow(item: PatientEscort): EscortTableRow {
    const rawName = item.name?.trim() || 'Não informado';

    return {
      ...item,
      name: this.formatEscortName(rawName),
      fullName: rawName,
    };
  }

  private formatEscortName(name: string): string {
    if (name === 'Não informado' || name.length <= 30) {
      return name;
    }
    return `${name.slice(0, 30)} ...${name.slice(-5)}`;
  }

  private toRawEscort(row: EscortTableRow): PatientEscort {
    const { fullName, ...escort } = row;
    return {
      ...escort,
      name: fullName === 'Não informado' ? '' : fullName,
    };
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: PatientEscortDialogData,
    width: string = COMPONENT_CONFIG.defaultDialogWidth,
    height = 'auto',
    requiresRefresh = true
  ): void {
    this.dialog
      .open(component, {
        width,
        height,
        disableClose: true,
        autoFocus: false,
        scrollStrategy: this.overlay.scrollStrategies.noop(),
        data,
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
    this.patientsChannel.postMessage('update');
  }
}