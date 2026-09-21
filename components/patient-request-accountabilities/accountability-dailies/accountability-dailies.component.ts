import { ComponentType } from '@angular/cdk/portal';
import { Overlay } from '@angular/cdk/overlay';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Injector, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Models e Serviços
import { AccountabilityDaily } from '../../../models/accountability-daily.model';
import { PatientRequestAccountability } from '../../../models/patient-request-accountability.model';
import { PatientRequestAccountabilityService } from '../../../services/patient-request-accountability.service';
import { MessageService } from '../../../../core/services/message-service';

// Modais do Contexto de Diárias da Prestação de Contas
import { AccountabilityDailyCreateComponent } from '../accountability-daily-create/accountability-daily-create.component';
import { AccountabilityDailyDeleteComponent } from '../accountability-daily-delete/accountability-daily-delete.component';
import { AccountabilityDailyUpdateComponent } from '../accountability-daily-update/accountability-daily-update.component';

// Define o tipo aceito para os dados dos modais do contexto
type AccountabilityDailiesDialogData =
  | { accountability: PatientRequestAccountability }
  | { accountability_daily: AccountabilityDaily };

// Constantes Locais
const TFD_ACCOUNTABILITIES_CHANNEL = new BroadcastChannel('tfd-accountabilities-channel');

@Component({
  selector: 'app-accountability-dailies-component',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './accountability-dailies.component.html',
  styleUrl: './accountability-dailies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountabilityDailiesComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly dialog = inject(MatDialog);
  private readonly overlay = inject(Overlay);
  private readonly accountabilityService = inject(PatientRequestAccountabilityService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected readonly displayedColumns: string[] = ['name', 'value', 'amount', 'partial', 'actions'];
  protected readonly dailiesList = signal<AccountabilityDaily[]>([]);
  protected readonly isLoading = signal<boolean>(true);

  // Instância ÚNICA/ESTÁTICA do MatTableDataSource
  protected readonly dataSource = new MatTableDataSource<AccountabilityDaily>([]);

  // Mapeia a lista adicionando o valor computado 'partial' (subtotal) individual de forma reativa
  protected readonly mappedDailies = computed(() =>
    this.dailiesList().map(item => ({
      ...item,
      partial: (Number(item.amount) || 0) * (Number(item.daily_cost?.value) || 0)
    }))
  );

  // Computado que define se o rodapé deve exibir as colunas ou ficar escondido quando a lista estiver vazia
  protected readonly footerColumns = computed(() =>
    this.dailiesList().length > 0 ? this.displayedColumns : []
  );

  // Calcula o valor total global somando todos os parciais de maneira limpa e reativa
  protected readonly totalValue = computed(() =>
    this.mappedDailies().reduce((acc, item) => acc + item.partial, 0)
  );

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.setupTableBindings();
    this.fetchAccountabilityDailies(true);
    this.listenToBroadcastChannel();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected accountabilityDailyCreate(): void {
    this.openDialog(AccountabilityDailyCreateComponent, { accountability: this.data?.accountability }, '500px');
  }

  protected accountabilityDailyUpdate(accountabilityDaily: AccountabilityDaily): void {
    this.openDialog(AccountabilityDailyUpdateComponent, { accountability_daily: accountabilityDaily }, '500px');
  }

  protected accountabilityDailyDelete(accountabilityDaily: AccountabilityDaily): void {
    this.openDialog(AccountabilityDailyDeleteComponent, { accountability_daily: accountabilityDaily }, '400px');
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private setupTableBindings(): void {
    effect(() => {
      this.dataSource.data = this.mappedDailies();
    }, { injector: this.injector });
  }

  private fetchAccountabilityDailies(showLoading = false): void {
    const accountabilityId = this.data?.accountability?.id;

    if (!accountabilityId) {
      this.isLoading.set(false);
      return;
    }

    if (showLoading) {
      this.isLoading.set(true);
    }

    this.accountabilityService.getAccountabilityDailies(accountabilityId)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response) ? response : (response?.data || []);
          this.dailiesList.set(items);
        },
        error: (err) => {
          this.dailiesList.set([]);
          const fallbackError = 'Não foi possível carregar as diárias da prestação de contas.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  private listenToBroadcastChannel(): void {
    TFD_ACCOUNTABILITIES_CHANNEL.onmessage = (message: MessageEvent<string>) => {
      if (message.data === 'update') {
        this.fetchAccountabilityDailies(false);
      }
    };
  }

  private openDialog<T>(
    component: ComponentType<T>,
    data: AccountabilityDailiesDialogData,
    width = '500px',
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
          if (requiresRefresh) {
            this.fetchAccountabilityDailies(false);
          }

          if (emitGlobalBroadcast) {
            TFD_ACCOUNTABILITIES_CHANNEL.postMessage('update');
          }
        }
      });
  }
}