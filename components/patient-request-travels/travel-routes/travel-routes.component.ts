import { ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
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
import { TravelRoute } from '../../../models/travel-route.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

// Modais do Contexto de Rotas
import { TravelRouteCreateComponent } from '../travel-route-create/travel-route-create.component';
import { TravelRouteDeleteComponent } from '../travel-route-delete/travel-route-delete.component';
import { TravelRouteDetailComponent } from '../travel-route-detail/travel-route-detail.component';
import { TravelRouteUpdateComponent } from '../travel-route-update/travel-route-update.component';

// Define o tipo aceito para os dados do modal de rotas
type TravelRoutesDialogData =
  | { travel: PatientRequestTravel }
  | { route: TravelRoute };

// Constantes Locais
const TFD_TRAVELS_CHANNEL = new BroadcastChannel('tfd-travels-channel');

@Component({
  selector: 'app-travel-routes',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './travel-routes.component.html',
  styleUrl: './travel-routes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelRoutesComponent implements OnInit, OnDestroy {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
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
    'route',
    'departure',
    'arrival',
    'distance',
    'actions'
  ];
  protected readonly routesList = signal<TravelRoute[]>([]);
  protected readonly isLoading = signal<boolean>(true);

  // Instância ÚNICA/ESTÁTICA do MatTableDataSource
  protected readonly dataSource = new MatTableDataSource<TravelRoute>([]);

  // Calcula a distância total global somando de maneira automática sempre que a lista mudar
  protected readonly totalDistance = computed(() =>
    this.routesList().reduce((acc, item) => acc + (Number(item.distance) || 0), 0)
  );

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchRoutes(true);
  }

  ngOnDestroy(): void {
    TFD_TRAVELS_CHANNEL.close();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected travelRouteCreate(): void {
    this.openDialog(TravelRouteCreateComponent, { travel: this.data?.travel }, '800px');
  }

  protected travelRouteDetail(route: TravelRoute): void {
    this.openDialog(TravelRouteDetailComponent, { route }, '800px', 'auto', false, false);
  }

  protected travelRouteUpdate(route: TravelRoute): void {
    this.openDialog(TravelRouteUpdateComponent, { route }, '800px');
  }

  protected travelRouteDelete(route: TravelRoute): void {
    this.openDialog(TravelRouteDeleteComponent, { route }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(() => {
      this.dataSource.data = this.routesList();
    }, { injector: this.injector });
  }

  private fetchRoutes(showLoading = false): void {
    const travelId = this.data?.travel?.id;

    if (!travelId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.travelService.getRoutes(travelId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.routesList.set(response || []);
        },
        error: (err) => {
          this.routesList.set([]);
          const fallbackError = 'Não foi possível carregar as rotas da viagem.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: TravelRoutesDialogData,
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
          this.fetchRoutes(requiresRefresh);

          if (emitGlobalBroadcast) {
            TFD_TRAVELS_CHANNEL.postMessage('update');
          }
        }
      });
  }
}