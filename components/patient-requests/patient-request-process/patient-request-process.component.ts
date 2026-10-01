import { CommonModule } from '@angular/common';
import { 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  Component, 
  DestroyRef, 
  Injector,
  OnInit, 
  inject, 
  signal 
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { Observable, finalize, map, startWith } from 'rxjs';

// Angular Material
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Services & Models
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestService } from '../../../services/patient-request.service';

export interface ProfessionalOption {
  id: number | string;
  name: string;
  requests_count?: number;
  [key: string]: unknown;
}

export interface GroupedProfessionalsResponse {
  medical_professionals?: ProfessionalOption[];
  social_professionals?: ProfessionalOption[];
  travel_professionals?: ProfessionalOption[];
  cost_assistance_professionals?: ProfessionalOption[];
  medicos?: ProfessionalOption[];
  assistentes_sociais?: ProfessionalOption[];
  passagens?: ProfessionalOption[];
  ajuda_custo?: ProfessionalOption[];
}

@Component({
  selector: 'app-patient-request-process',
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
    MatChipsModule,
    MatIconModule
  ],
  templateUrl: './patient-request-process.component.html',
  styleUrl: './patient-request-process.component.scss',
  providers: [
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestProcessComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly patientRequestService = inject(PatientRequestService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestProcessComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected processForm!: FormGroup;

  // Form Controls específicos para Autocomplete UI
  protected medicalProfessionalControl = new FormControl<string | ProfessionalOption>('');
  protected socialProfessionalControl = new FormControl<string | ProfessionalOption>('');
  protected travelProfessionalControl = new FormControl<string | ProfessionalOption>('');
  protected costAssistanceProfessionalControl = new FormControl<string | ProfessionalOption>('');

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isLoadingProfessionals = signal<boolean>(false);
  protected readonly isReadOnly = signal<boolean>(false);

  // Mensagens de Erro por Controle
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    medical_professional_id: [
      { type: 'required', message: 'A seleção do profissional médico é obrigatória.' }
    ],
    social_professional_id: [
      { type: 'required', message: 'A seleção do assistente social é obrigatória.' }
    ],
    travel_professional_id: [
      { type: 'required', message: 'A seleção do responsável por passagens é obrigatória.' }
    ],
    cost_assistance_professional_id: [
      { type: 'required', message: 'A seleção do responsável por ajuda de custo é obrigatória.' }
    ]
  };

  // Autocomplete e Observables
  private medicalOptions: ProfessionalOption[] = [];
  protected filteredMedicalOptions!: Observable<ProfessionalOption[]>;

  private socialOptions: ProfessionalOption[] = [];
  protected filteredSocialOptions!: Observable<ProfessionalOption[]>;

  private travelOptions: ProfessionalOption[] = [];
  protected filteredTravelOptions!: Observable<ProfessionalOption[]>;

  private costAssistanceOptions: ProfessionalOption[] = [];
  protected filteredCostAssistanceOptions!: Observable<ProfessionalOption[]>;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupTypeChangeListener();
    this.fetchAllProfessionals();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected displayProfessionalFn(professional: ProfessionalOption): string {
    return professional?.name || '';
  }

  protected isEntranceType(): boolean {
    return this.processForm.get('type')?.value === 'Entrada';
  }

  protected isFormInvalid(): boolean {
    return this.processForm.invalid || this.processForm.pending || this.isSubmitting();
  }

  protected onSubmit(): void {
    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Identificador do anexo não encontrado.');
      return;
    }

    if (this.processForm.invalid) {
      this.processForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.cdr.markForCheck();

    const payload = this.processForm.getRawValue();

    this.patientRequestService.processPatientRequest(requestId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Solicitação processada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Houve um erro operacional ao processar a solicitação.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const initialType = this.data?.patient_request?.type;

    this.processForm = this.fb.group({
      type: [initialType],
      medical_professional_id: [null, [Validators.required]],
      social_professional_id: [null, [Validators.required]],
      travel_professional_id: [null],
      cost_assistance_professional_id: [null]
    });

    if (initialType !== 'Entrada') {
      this.processForm.get('travel_professional_id')?.setValidators([Validators.required]);
      this.processForm.get('cost_assistance_professional_id')?.setValidators([Validators.required]);
    }
  }

  private setupTypeChangeListener(): void {
    this.processForm.get('type')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((typeValue: string) => {
        const isEntrada = typeValue === 'Entrada';

        const travelCtrl = this.processForm.get('travel_professional_id');
        const costCtrl = this.processForm.get('cost_assistance_professional_id');

        if (isEntrada) {
          travelCtrl?.clearValidators();
          travelCtrl?.setValue(null);

          costCtrl?.clearValidators();
          costCtrl?.setValue(null);

          this.travelProfessionalControl.setValue('');
          this.costAssistanceProfessionalControl.setValue('');
        } else {
          travelCtrl?.setValidators([Validators.required]);
          costCtrl?.setValidators([Validators.required]);
        }

        travelCtrl?.updateValueAndValidity();
        costCtrl?.updateValueAndValidity();
        this.cdr.markForCheck();
      });
  }

  private fetchAllProfessionals(): void {
    this.isLoadingProfessionals.set(true);
    this.cdr.markForCheck();

    this.patientRequestService.getProfessionals()
      .pipe(
        finalize(() => {
          this.isLoadingProfessionals.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: GroupedProfessionalsResponse | any) => {
          if (response) {
            const data = response as GroupedProfessionalsResponse;

            this.medicalOptions = data.medical_professionals || data.medicos || [];
            this.socialOptions = data.social_professionals || data.assistentes_sociais || [];
            this.travelOptions = data.travel_professionals || data.passagens || [];
            this.costAssistanceOptions = data.cost_assistance_professionals || data.ajuda_custo || [];

            this.configureFilters();
            this.isReadOnly.set(false);
          }
        },
        error: () => {
          this.isReadOnly.set(true);
          this.clearAllOptions();
        }
      });
  }

  private configureFilters(): void {
    this.filteredMedicalOptions = this.medicalProfessionalControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const term = typeof value === 'string' ? value : value?.name || '';
        return term ? this._filterOptions(term, this.medicalOptions) : this.medicalOptions;
      }),
      takeUntilDestroyed(this.destroyRef)
    );

    this.filteredSocialOptions = this.socialProfessionalControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const term = typeof value === 'string' ? value : value?.name || '';
        return term ? this._filterOptions(term, this.socialOptions) : this.socialOptions;
      }),
      takeUntilDestroyed(this.destroyRef)
    );

    this.filteredTravelOptions = this.travelProfessionalControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const term = typeof value === 'string' ? value : value?.name || '';
        return term ? this._filterOptions(term, this.travelOptions) : this.travelOptions;
      }),
      takeUntilDestroyed(this.destroyRef)
    );

    this.filteredCostAssistanceOptions = this.costAssistanceProfessionalControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const term = typeof value === 'string' ? value : value?.name || '';
        return term ? this._filterOptions(term, this.costAssistanceOptions) : this.costAssistanceOptions;
      }),
      takeUntilDestroyed(this.destroyRef)
    );

    this.medicalProfessionalControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        const id = typeof val === 'object' && val !== null ? val.id : null;
        this.processForm.get('medical_professional_id')?.setValue(id);
      });

    this.socialProfessionalControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        const id = typeof val === 'object' && val !== null ? val.id : null;
        this.processForm.get('social_professional_id')?.setValue(id);
      });

    this.travelProfessionalControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        const id = typeof val === 'object' && val !== null ? val.id : null;
        this.processForm.get('travel_professional_id')?.setValue(id);
      });

    this.costAssistanceProfessionalControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        const id = typeof val === 'object' && val !== null ? val.id : null;
        this.processForm.get('cost_assistance_professional_id')?.setValue(id);
      });
  }

  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.processForm.disable({ emitEvent: false });
          this.medicalProfessionalControl.disable({ emitEvent: false });
          this.socialProfessionalControl.disable({ emitEvent: false });
          this.travelProfessionalControl.disable({ emitEvent: false });
          this.costAssistanceProfessionalControl.disable({ emitEvent: false });
        } else {
          this.processForm.enable({ emitEvent: false });
          this.medicalProfessionalControl.enable({ emitEvent: false });
          this.socialProfessionalControl.enable({ emitEvent: false });
          this.travelProfessionalControl.enable({ emitEvent: false });
          this.costAssistanceProfessionalControl.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  private clearAllOptions(): void {
    this.medicalOptions = [];
    this.socialOptions = [];
    this.travelOptions = [];
    this.costAssistanceOptions = [];
    this.cdr.markForCheck();
  }

  private _filterOptions(term: string, options: ProfessionalOption[]): ProfessionalOption[] {
    const filterValue = term.toLowerCase();
    return options.filter(option =>
      option.name?.toLowerCase().includes(filterValue)
    );
  }
}