import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { finalize } from 'rxjs';

// Angular Material & CDK
import { Overlay } from '@angular/cdk/overlay';
import { ComponentType } from '@angular/cdk/portal';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Core, Models e Serviços
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestTravel } from '../../../models/patient-request-travel.model';
import { Role } from '../../../models/role.model';
import { TravelPassenger } from '../../../models/travel-passenger.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

// Modais do Contexto de Passageiros
import { TravelPassengerCreateComponent } from '../travel-passenger-create/travel-passenger-create.component';
import { TravelPassengerDeleteComponent } from '../travel-passenger-delete/travel-passenger-delete.component';
import { TravelPassengerDetailComponent } from '../travel-passenger-detail/travel-passenger-detail.component';
import { TravelPassengerUpdateComponent } from '../travel-passenger-update/travel-passenger-update.component';

export type TravelPassengersDialogData = {
  travel?: PatientRequestTravel;
  passenger?: TravelPassenger;
  roles?: Role[];
  currentPassengers?: TravelPassenger[];
};

export interface MappedTravelPassenger extends TravelPassenger {
  total: number;
}

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
export class TravelPassengersComponent implements OnInit {
  // ==========================================
  // Instância do Broadcast Channel
  // ==========================================
  private readonly travelsChannel = new BroadcastChannel('tfd-travels-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<TravelPassengersDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

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
  protected readonly dataSource = new MatTableDataSource<MappedTravelPassenger>([]);

  // Define dinamicamente as colunas do rodapé para garantir a reatividade ao adicionar/remover itens
  protected readonly footerColumns = computed(() =>
    this.passengersList().length > 0 ? this.displayedColumns : []
  );

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

  // Calcula o valor total global exibido no rodapé/somatório
  protected readonly totalValue = computed(() =>
    this.mappedPassengers().reduce((acc, item) => acc + item.total, 0)
  );

  private readonly travelId = computed(() => this.data?.travel?.id ?? null);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchPassengers(true);
  }

  // ==========================================
  // Avaliação de Permissões
  // ==========================================
  protected checkPermissions(permissionName: string): boolean {
    const roles = this.data?.roles || [];
    return !roles.some((role) =>
      role?.permissions?.some((p) => p?.name === permissionName)
    );
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected travelPassengerCreate(): void {
    this.openDialog(TravelPassengerCreateComponent, { 
      travel: this.data?.travel, currentPassengers: this.dataSource?.data
    }, '800px');
  }

  protected travelPassengerDetail(passenger: TravelPassenger): void {
    this.openDialog(TravelPassengerDetailComponent, { 
      passenger 
    }, '800px', 'auto', false);
  }

  protected travelPassengerUpdate(passenger: TravelPassenger): void {
    this.openDialog(TravelPassengerUpdateComponent, { 
      passenger 
    }, '800px');
  }

  protected travelPassengerDelete(passenger: TravelPassenger): void {
    this.openDialog(TravelPassengerDeleteComponent, { 
      passenger 
    }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchPassengers(showLoading = false): void {
    const currentTravelId = this.travelId();

    if (!currentTravelId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.travelService.getPassengers(currentTravelId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.passengersList.set(response || []);
          this.dataSource.data = this.mappedPassengers();
        },
        error: (err) => {
          this.passengersList.set([]);
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar os passageiros da viagem.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private setupBroadcastChannel(): void {
    this.travelsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchPassengers(false);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.travelsChannel.close();
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: TravelPassengersDialogData,
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
          this.handlePassengerChange();
        }
      });
  }

  private handlePassengerChange(): void {
    this.fetchPassengers(false);
    this.travelsChannel.postMessage('update');
  }
}