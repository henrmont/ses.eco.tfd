import { ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Enums, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { TravelCompany } from '../../../enums/travel-company';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestTravel } from '../../../models/patient-request-travel.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

// Dialog Components
import { PatientRequestTravelCreateComponent } from '../patient-request-travel-create/patient-request-travel-create.component';
import { PatientRequestTravelDeleteComponent } from '../patient-request-travel-delete/patient-request-travel-delete.component';
import { PatientRequestTravelDetailComponent } from '../patient-request-travel-detail/patient-request-travel-detail.component';
import { PatientRequestTravelUpdateComponent } from '../patient-request-travel-update/patient-request-travel-update.component';
import { TravelPassengersComponent } from '../travel-passengers/travel-passengers.component';
import { TravelRoutesComponent } from '../travel-routes/travel-routes.component';

// Define o tipo aceito para as propriedades dos Modais de Viagens
type PatientRequestTravelDialogData =
  | { travel: PatientRequestTravel }
  | { patient_request: PatientRequest | undefined };

// Constantes Locais
const TFD_TRAVELS_CHANNEL = new BroadcastChannel('tfd-travels-channel');

@Component({
  selector: 'app-patient-request-travels',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './patient-request-travels.component.html',
  styleUrl: './patient-request-travels.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestTravelsComponent implements OnInit, OnDestroy {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = [
    'os',
    'type',
    'route',
    'company',
    'departure_date',
    'return_date',
    'status',
    'actions'
  ];
  protected readonly dataSource = new MatTableDataSource<PatientRequestTravel>([]);
  protected readonly isLoading = signal<boolean>(true);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.fetchTravels(true);
    this.listenToBroadcastChannel();
  }

  ngOnDestroy(): void {
    TFD_TRAVELS_CHANNEL.close();
  }

  // ==========================================
  // Avaliação de Permissões
  // ==========================================
  protected checkPermissions(permissionName: string): boolean {
    const roles = this.data?.permissions || [];
    return !roles.some((role: { permissions?: { name: string }[] }) =>
      role?.permissions?.some((p) => p?.name === permissionName)
    );
  }

  // ==========================================
  // Helpers de Exibição
  // ==========================================
  /**
   * Converte a Key do Enum vinda do banco (ex: "LATAM") no seu Value de exibição (ex: "LATAM Airlines").
   */
  protected getAirlineCompanyLabel(key?: string): string {
    if (!key) return 'Não informada';
    return TravelCompany[key as keyof typeof TravelCompany] || key;
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected patientRequestTravelCreate(): void {
    this.openDialog(PatientRequestTravelCreateComponent, { patient_request: this.data?.patient_request }, '800px');
  }

  protected patientRequestTravelDetail(travel: PatientRequestTravel): void {
    this.openDialog(PatientRequestTravelDetailComponent, { travel }, '1000px', 'auto', false, false);
  }

  protected patientRequestTravelUpdate(travel: PatientRequestTravel): void {
    this.openDialog(PatientRequestTravelUpdateComponent, { travel }, '800px');
  }

  protected patientRequestTravelDelete(travel: PatientRequestTravel): void {
    this.openDialog(PatientRequestTravelDeleteComponent, { travel }, '400px', 'auto', true);
  }

  protected travelPassengers(travel: PatientRequestTravel): void {
    this.openDialog(TravelPassengersComponent, { travel }, '1200px', 'auto', false, false);
  }

  protected travelRoutes(travel: PatientRequestTravel): void {
    this.openDialog(TravelRoutesComponent, { travel }, '1000px', 'auto', false, false);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchTravels(showLoading = false): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.travelService.getTravels(requestId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PatientRequestTravel[]) => {
          this.dataSource.data = response || [];
        },
        error: (err) => {
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar as passagens da solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private listenToBroadcastChannel(): void {
    TFD_TRAVELS_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchTravels(false);
      }
    };
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: PatientRequestTravelDialogData,
    width = '800px',
    height = 'auto',
    requiresRefresh = true,
    emitGlobalBroadcast = true
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
        if (result) {
          this.fetchTravels(requiresRefresh);

          if (emitGlobalBroadcast) {
            TFD_TRAVELS_CHANNEL.postMessage('update');
          }
        }
      });
  }
}