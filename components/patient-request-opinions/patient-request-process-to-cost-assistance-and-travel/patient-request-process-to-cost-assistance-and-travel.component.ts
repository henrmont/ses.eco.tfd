import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize, map, startWith } from 'rxjs';

// Material Modules
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services, Models e Interfaces
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestOpinionService } from '../../../services/patient-request-opinion.service';

interface CostAssistanceProfessional {
  id: number | string;
  name: string;
  patient_cost_assistance_requests_count?: number;
  [key: string]: any;
}

interface TravelProfessional {
  id: number | string;
  name: string;
  patient_travel_requests_count?: number;
  [key: string]: any;
}

@Component({
  selector: 'app-patient-request-process-to-cost-assistance-and-travel',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    MatAutocompleteModule,
    MatDialogModule, 
    MatButtonModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatProgressSpinnerModule, 
    MatChipsModule
  ],
  templateUrl: './patient-request-process-to-cost-assistance-and-travel.component.html',
  styleUrl: './patient-request-process-to-cost-assistance-and-travel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestProcessToCostAssistanceAndTravelComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly opinionService = inject(PatientRequestOpinionService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestProcessToCostAssistanceAndTravelComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    cost_assistance_professional_search: [
      { type: 'required', message: 'A escolha de um profissional de ajuda de custo é obrigatória.' }
    ],
    travel_professional_search: [
      { type: 'required', message: 'A escolha de um profissional de passagem é obrigatória.' }
    ]
  };

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // Estados Ajuda de Custo
  protected readonly costAssistanceProfessionalLoading = signal<boolean>(false);
  protected readonly costAssistanceProfessionalReadOnly = signal<boolean>(true);

  // Estados Viagem / TFD
  protected readonly travelProfessionalLoading = signal<boolean>(false);
  protected readonly travelProfessionalReadOnly = signal<boolean>(true);

  // ==========================================
  // FormGroups
  // ==========================================
  protected processForm!: FormGroup;

  // ==========================================
  // Autocomplete e Observables
  // ==========================================
  private costAssistanceProfessionalOptions: CostAssistanceProfessional[] = [];
  protected filteredCostAssistanceProfessionalOptions!: Observable<CostAssistanceProfessional[]>;

  private travelProfessionalOptions: TravelProfessional[] = [];
  protected filteredTravelProfessionalOptions!: Observable<TravelProfessional[]>;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.fetchCostAssistanceProfessionals();
    this.fetchTravelProfessionals();
    this.registerCleaners();
  }

  // ==========================================
  // Inicialização de Formulário
  // ==========================================
  private initForm(): void {
    this.processForm = this.fb.group({
      cost_assistance_professional_id: [null, [Validators.required]],
      cost_assistance_professional_search: [null, [Validators.required]],
      travel_professional_id: [null, [Validators.required]],
      travel_professional_search: [null, [Validators.required]]
    });
  }

  // ==========================================
  // Autocomplete e Filtros
  // ==========================================
  private configureCostAssistanceProfessionalFilter(): void {
    const ctrl = this.processForm.get('cost_assistance_professional_search');
    if (ctrl) {
      this.filteredCostAssistanceProfessionalOptions = ctrl.valueChanges.pipe(
        startWith(''),
        map(value => {
          const name = typeof value === 'string' ? value : value?.name;
          return name ? this._filterCostAssistance(name) : this.costAssistanceProfessionalOptions.slice(0, 10);
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private configureTravelProfessionalFilter(): void {
    const ctrl = this.processForm.get('travel_professional_search');
    if (ctrl) {
      this.filteredTravelProfessionalOptions = ctrl.valueChanges.pipe(
        startWith(''),
        map(value => {
          const name = typeof value === 'string' ? value : value?.name;
          return name ? this._filterTravel(name) : this.travelProfessionalOptions.slice(0, 10);
        }),
        takeUntilDestroyed(this.destroyRef)
      );
    }
  }

  private registerCleaners(): void {
    this.processForm.get('cost_assistance_professional_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.processForm.get('cost_assistance_professional_id')?.setValue(null);
          this.processForm.get('cost_assistance_professional_id')?.markAsDirty();
          this.cdr.markForCheck();
        }
      });

    this.processForm.get('travel_professional_search')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        if (!value || typeof value !== 'object') {
          this.processForm.get('travel_professional_id')?.setValue(null);
          this.processForm.get('travel_professional_id')?.markAsDirty();
          this.cdr.markForCheck();
        }
      });
  }

  private _filterCostAssistance(name: string): CostAssistanceProfessional[] {
    const filterValue = name.toLowerCase().trim();
    return this.costAssistanceProfessionalOptions
      .filter(option => option.name && option.name.toLowerCase().includes(filterValue))
      .slice(0, 10);
  }

  private _filterTravel(name: string): TravelProfessional[] {
    const filterValue = name.toLowerCase().trim();
    return this.travelProfessionalOptions
      .filter(option => option.name && option.name.toLowerCase().includes(filterValue))
      .slice(0, 10);
  }

  // ==========================================
  // Carregamento de Dados
  // ==========================================
  protected fetchCostAssistanceProfessionals(): void {
    this.costAssistanceProfessionalLoading.set(true);
    this.cdr.markForCheck();

    this.opinionService.getCostAssistanceProfessionals()
      .pipe(
        finalize(() => {
          this.costAssistanceProfessionalLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          if (response) {
            this.costAssistanceProfessionalOptions = response.map((item: any) => ({
              ...item?.patient,
              ...item
            }));
            this.configureCostAssistanceProfessionalFilter();
            this.costAssistanceProfessionalReadOnly.set(false);
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.costAssistanceProfessionalReadOnly.set(true);
          this.costAssistanceProfessionalOptions = [];
          this.cdr.markForCheck();
        }
      });
  }

  protected fetchTravelProfessionals(): void {
    this.travelProfessionalLoading.set(true);
    this.cdr.markForCheck();

    this.opinionService.getTravelProfessionals()
      .pipe(
        finalize(() => {
          this.travelProfessionalLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          if (response) {
            this.travelProfessionalOptions = response.map((item: any) => ({
              ...item?.patient,
              ...item
            }));
            this.configureTravelProfessionalFilter();
            this.travelProfessionalReadOnly.set(false);
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.travelProfessionalReadOnly.set(true);
          this.travelProfessionalOptions = [];
          this.cdr.markForCheck();
        }
      });
  }

  // ==========================================
  // Helpers de Exibição e Seleção
  // ==========================================
  protected displayCostAssistanceProfessional(option: CostAssistanceProfessional): string {
    return option?.name || '';
  }

  protected displayTravelProfessional(option: TravelProfessional): string {
    return option?.name || '';
  }

  protected setCostAssistanceProfessional(option: CostAssistanceProfessional): void {
    if (option?.id) {
      this.processForm.get('cost_assistance_professional_id')?.setValue(option.id);
      this.processForm.get('cost_assistance_professional_id')?.markAsDirty();
      this.cdr.markForCheck();
    }
  }

  protected setTravelProfessional(option: TravelProfessional): void {
    if (option?.id) {
      this.processForm.get('travel_professional_id')?.setValue(option.id);
      this.processForm.get('travel_professional_id')?.markAsDirty();
      this.cdr.markForCheck();
    }
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    if (this.processForm.invalid) {
      this.processForm.markAllAsTouched();
      return;
    }

    const requestId = this.data?.patient_request?.id;
    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    const payload = this.processForm.getRawValue();

    this.opinionService.processPatientRequestToCostAssistanceAndTravel(requestId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Solicitação encaminhada com sucesso!');
          this.dialogRef.close(true);
        },
        error: err => {
          const fallbackError = 'Erro ao tentar encaminhar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}