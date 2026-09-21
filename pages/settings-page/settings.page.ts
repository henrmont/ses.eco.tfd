import { ChangeDetectionStrategy, Component } from '@angular/core';

// Componentes Filhos
import { DailiesCostComponent } from '../../components/setting/dailies-cost/dailies-cost.component';
import { BudgetAllocationComponent } from '../../components/setting/budget-allocation/budget-allocation.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    DailiesCostComponent,
    BudgetAllocationComponent
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage {}