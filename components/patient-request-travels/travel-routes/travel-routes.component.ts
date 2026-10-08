import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DecimalPipe } from '@angular/common';
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
import { TravelRoute } from '../../../models/travel-route.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

// Modais do Contexto de Rotas
import { TravelRouteCreateComponent } from '../travel-route-create/travel-route-create.component';
import { TravelRouteDeleteComponent } from '../travel-route-delete/travel-route-delete.component';
import { TravelRouteDetailComponent } from '../travel-route-detail/travel-route-detail.component';
import { TravelRouteUpdateComponent } from '../travel-route-update/travel-route-update.component';

export type TravelRoutesDialogData = {
  travel?: PatientRequestTravel;
  route?: TravelRoute;
  roles?: Role[];
};

@Component({
  selector: 'app-travel-routes',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
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
export class TravelRoutesComponent implements OnInit {
  // ==========================================
  // Instância do Broadcast Channel
  // ==========================================
  private readonly travelsChannel = new BroadcastChannel('tfd-travels-channel');

  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<TravelRoutesDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

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
  protected readonly dataSource = new MatTableDataSource<TravelRoute>([]);

  // Define dinamicamente as colunas do rodapé para garantir reatividade
  protected readonly footerColumns = computed(() =>
    this.routesList().length > 0 ? this.displayedColumns : []
  );

  // Calcula a distância total global somando de maneira automática sempre que a lista mudar
  protected readonly totalDistance = computed(() =>
    this.routesList().reduce((acc, item) => acc + (Number(item.distance) || 0), 0)
  );

  private readonly travelId = computed(() => this.data?.travel?.id ?? null);

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupBroadcastChannel();
    this.fetchRoutes(true);
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
  protected travelRouteCreate(): void {
    this.openDialog(TravelRouteCreateComponent, { 
      travel: this.data?.travel 
    }, '800px');
  }

  protected travelRouteDetail(route: TravelRoute): void {
    this.openDialog(TravelRouteDetailComponent, { 
      route 
    }, '800px', 'auto', false);
  }

  protected travelRouteUpdate(route: TravelRoute): void {
    this.openDialog(TravelRouteUpdateComponent, { 
      route 
    }, '800px');
  }

  protected travelRouteDelete(route: TravelRoute): void {
    this.openDialog(TravelRouteDeleteComponent, { 
      route 
    }, '400px', 'auto', true);
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private fetchRoutes(showLoading = false): void {
    const currentTravelId = this.travelId();

    if (!currentTravelId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.travelService.getRoutes(currentTravelId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          const routes = response || [];
          this.routesList.set(routes);
          this.dataSource.data = routes;
        },
        error: (err) => {
          this.routesList.set([]);
          this.dataSource.data = [];
          const fallbackError = 'Não foi possível carregar as rotas da viagem.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private setupBroadcastChannel(): void {
    this.travelsChannel.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchRoutes(false);
      }
    };

    this.destroyRef.onDestroy(() => {
      this.travelsChannel.close();
    });
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: TravelRoutesDialogData,
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
          this.handleRouteChange();
        }
      });
  }

  private handleRouteChange(): void {
    this.fetchRoutes(false);
    this.travelsChannel.postMessage('update');
  }
}