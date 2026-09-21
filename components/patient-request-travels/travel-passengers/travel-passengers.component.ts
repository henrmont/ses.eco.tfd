import { ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestTravel } from '../../../models/patient-request-travel.model';
import { TravelPassenger } from '../../../models/travel-passenger.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

// Modais do Contexto de Passageiros
import { TravelPassengerCreateComponent } from '../travel-passenger-create/travel-passenger-create.component';
import { TravelPassengerDeleteComponent } from '../travel-passenger-delete/travel-passenger-delete.component';
import { TravelPassengerDetailComponent } from '../travel-passenger-detail/travel-passenger-detail.component';
import { TravelPassengerUpdateComponent } from '../travel-passenger-update/travel-passenger-update.component';

// Define o tipo aceito para os dados do modal de passageiros
type TravelPassengersDialogData =
  | { travel: PatientRequestTravel }
  | { passenger: TravelPassenger };

// Interface estendida para exibição do cálculo do total do passageiro
interface MappedTravelPassenger extends TravelPassenger {
  total: number;
}

// Constantes Locais
const TFD_TRAVELS_CHANNEL = new BroadcastChannel('tfd-travels-channel');

@Component({
  selector: 'app-travel-passengers',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    PercentPipe,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './travel-passengers.component.html',
  styleUrl: './travel-passengers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelPassengersComponent implements OnInit, OnDestroy {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = [
    'passenger',
    'is_patient',
    'tariff',
    'tax',
    'discount',
    'total',
    'actions'
  ];
  protected readonly passengersList = signal<TravelPassenger[]>([]);
  protected readonly isLoading = signal<boolean>(true);

  // Mapeia a lista calculando o valor total individual: (Tarifa + Taxa) - Desconto%
  protected readonly mappedPassengers = computed<MappedTravelPassenger[]>(() =>
    this.passengersList().map((item) => {
      const tariff = Number(item.tariff) || 0;
      const tax = Number(item.tax) || 0;
      const discountPercent = Number(item.discount) || 0;

      const baseAmount = tariff + tax;
      const discountAmount = baseAmount * (discountPercent / 100);
      const total = baseAmount - discountAmount;

      return {
        ...item,
        total
      };
    })
  );

  // Instância ÚNICA/ESTÁTICA do MatTableDataSource
  protected readonly dataSource = new MatTableDataSource<MappedTravelPassenger>([]);

  // Calcula o valor total global exibido no rodapé/somatório
  protected readonly totalValue = computed(() =>
    this.mappedPassengers().reduce((acc, item) => acc + item.total, 0)
  );

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchPassengers(true);
  }

  ngOnDestroy(): void {
    TFD_TRAVELS_CHANNEL.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected travelPassengerCreate(): void {
    this.openDialog(TravelPassengerCreateComponent, { travel: this.data?.travel }, '800px');
  }

  protected travelPassengerDetail(passenger: TravelPassenger): void {
    this.openDialog(TravelPassengerDetailComponent, { passenger }, '800px', 'auto', false, false);
  }

  protected travelPassengerUpdate(passenger: TravelPassenger): void {
    this.openDialog(TravelPassengerUpdateComponent, { passenger }, '800px');
  }

  protected travelPassengerDelete(passenger: TravelPassenger): void {
    this.openDialog(TravelPassengerDeleteComponent, { passenger }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(() => {
      this.dataSource.data = this.mappedPassengers();
    }, { injector: this.injector });
  }

  private fetchPassengers(showLoading = false): void {
    const travelId = this.data?.travel?.id;

    if (!travelId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.travelService.getPassengers(travelId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.passengersList.set(response || []);
        },
        error: (err) => {
          this.passengersList.set([]);
          const fallbackError = 'Não foi possível carregar os passageiros da viagem.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: TravelPassengersDialogData,
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
          this.fetchPassengers(requiresRefresh);

          if (emitGlobalBroadcast) {
            TFD_TRAVELS_CHANNEL.postMessage('update');
          }
        }
      });
  }
}