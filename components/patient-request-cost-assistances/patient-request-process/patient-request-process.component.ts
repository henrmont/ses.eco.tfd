import { AsyncPipe, CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, Injector, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
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
import { MatStepperModule } from '@angular/material/stepper';

// Core, Models e Serviços
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { TravelCompany } from '../../../enums/travel-company';

export type PatientRequestProcessCostAssistanceDialogData = {
  patient_request?: PatientRequest & {
    payment_professional?: any;
    cost_assistance?: any;
    travel?: any;
  };
  cost_assistances?: any[];
  travels?: any[];
};

export interface FixedSlot {
  key: string;
  title: string;
  required: boolean;
  assignedFile: PatientRequestAttachment[];
}

@Component({
  selector: 'app-patient-request-process',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    MatStepperModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatIconModule
  ],
  providers: [
    { provide: STEPPER_GLOBAL_OPTIONS, useValue: { showError: true } }
  ],
  templateUrl: './patient-request-process.component.html',
  styleUrl: './patient-request-process.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestProcessComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<PatientRequestProcessCostAssistanceDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestProcessComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected step1FormGroup!: FormGroup;
  protected step2FormGroup!: FormGroup;
  protected tramitPatientRequestForm!: FormGroup;

  // Form Controls específicos para Autocomplete UI
  protected paymentProfessionalControl = new FormControl<string | any>('');
  protected costAssistanceControl = new FormControl<string | any>('');
  protected travelControl = new FormControl<string | any>('');

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly isLoadingProfessionals = signal<boolean>(false);
  protected readonly isReadOnly = signal<boolean>(false);

  // Drag & Drop e Slots
  protected readonly availableFiles = signal<PatientRequestAttachment[]>([]);
  protected readonly fixedSlots = signal<FixedSlot[]>([
    { key: 'cost_assistance_request', title: 'Requerimento de ajuda de custo', required: true, assignedFile: [] },
    { key: 'medical_declaration', title: 'Declaração médica', required: false, assignedFile: [] },
    { key: 'bank_statement', title: 'Comprovante bancário', required: true, assignedFile: [] },
    { key: 'registration_status', title: 'Situação cadastral', required: true, assignedFile: [] }
  ]);

  protected readonly areSlotsValid = computed(() => {
    return this.fixedSlots().every(
      slot => !slot.required || slot.assignedFile.length > 0
    );
  });

  protected readonly availableListId = 'available-files-list';
  protected readonly slotListIds = computed(() => this.fixedSlots().map((_, index) => `slot-${index}`));

  // Mensagens de Erro por Controle
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    payment_professional_id: [
      { type: 'required', message: 'A seleção do profissional é obrigatória.' }
    ],
    cost_assistance_id: [
      { type: 'required', message: 'A seleção da ajuda de custo é obrigatória.' }
    ],
    travel_id: [
      { type: 'required', message: 'A seleção da viagem é obrigatória.' }
    ]
  };

  // Autocomplete e Observables
  private paymentProfessionalOptions: any[] = [];
  protected filteredPaymentProfessionalOptions!: Observable<any[]>;

  private costAssistanceOptions: any[] = [];
  protected filteredCostAssistanceOptions!: Observable<any[]>;

  private travelOptions: any[] = [];
  protected filteredTravelOptions!: Observable<any[]>;

  // ==========================================
  // Construtor
  // ==========================================
  constructor() {
    effect(() => {
      const loading = this.isLoadingProfessionals();
      const submitting = this.isSubmitting();

      if (loading || submitting) {
        this.step1FormGroup?.disable({ emitEvent: false });
        this.step2FormGroup?.disable({ emitEvent: false });
        this.paymentProfessionalControl.disable({ emitEvent: false });
        this.costAssistanceControl.disable({ emitEvent: false });
        this.travelControl.disable({ emitEvent: false });
      } else {
        this.step1FormGroup?.enable({ emitEvent: false });
        this.step2FormGroup?.enable({ emitEvent: false });
        this.paymentProfessionalControl.enable({ emitEvent: false });
        this.costAssistanceControl.enable({ emitEvent: false });
        this.travelControl.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForms();
    this.loadArchives();
    this.loadCostAssistanceOptions();
    this.loadTravelOptions();
    this.fetchPaymentProfessionals();
    this.patchInitialValues();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected displayPaymentProfessional(professional: any): string {
    return professional?.name || '';
  }

  protected displayCostAssistance(item: any): string {
    if (!item) return '';
    return item.description ? `${item.description} R$ ${item.value || '0,00'}` : (item.name || '');
  }

  protected displayTravel = (item: any): string => {
    if (!item) return '';
    if (typeof item === 'string') return item;

    const origin = item.origin || item.departure_location || '';
    const destination = item.destination || item.arrival_location || '';
    
    const rawCompany = item.company || item.airline || item.travel_company || '';
    const company = this.getCompanyLabel(rawCompany);

    const rawDate = item.departure_date || item.travel_date || item.date || '';
    const departureDate = this.formatDepartureDate(rawDate);

    return `TRECHO: (${origin}-${destination}) / COMPANHIA ÁEREA: ${company} / DATA DA VIAGEM: ${departureDate}`;
  };

  protected setPaymentProfessional(option: any): void {
    if (option) {
      this.paymentProfessionalControl.setValue(option, { emitEvent: false });
      this.step1FormGroup.patchValue({ payment_professional_id: option.id ?? null });
      this.step1FormGroup.get('payment_professional_id')?.markAsTouched();
      this.cdr.markForCheck();
    }
  }

  protected setCostAssistance(option: any): void {
    if (option) {
      this.costAssistanceControl.setValue(option, { emitEvent: false });
      this.step1FormGroup.patchValue({ cost_assistance_id: option.id ?? null });
      this.step1FormGroup.get('cost_assistance_id')?.markAsTouched();
      this.cdr.markForCheck();
    }
  }

  protected setTravel(option: any): void {
    if (option) {
      this.travelControl.setValue(option, { emitEvent: false });
      this.step1FormGroup.patchValue({ travel_id: option.id ?? null });
      this.step1FormGroup.get('travel_id')?.markAsTouched();
      this.cdr.markForCheck();
    }
  }

  protected isFormInvalid(): boolean {
    return this.tramitPatientRequestForm.invalid || !this.areSlotsValid() || this.isSubmitting() || this.isLoadingProfessionals();
  }

  protected onSubmit(): void {
    if (this.isFormInvalid()) {
      this.tramitPatientRequestForm.markAllAsTouched();
      this.step1FormGroup.markAllAsTouched();
      return;
    }

    const requestId = this.data?.patient_request?.id;

    if (!requestId) {
      this.messageService.showMessage('Identificador da solicitação não encontrado.');
      return;
    }

    this.isSubmitting.set(true);

    const payload = {
      payment_professional_id: this.step1FormGroup.value.payment_professional_id,
      cost_assistance_id: this.step1FormGroup.value.cost_assistance_id,
      travel_id: this.step1FormGroup.value.travel_id,
      attachments: this.fixedSlots().map(slot => ({
        slot_key: slot.key,
        id: slot.assignedFile[0]?.id || null
      }))
    };

    this.costAssistanceService.processPatientRequestToPayment(requestId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Solicitação processada para pagamento com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar processar a solicitação para pagamento.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Drag and Drop
  // ==========================================
  protected dropToAvailable(event: CdkDragDrop<PatientRequestAttachment[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }
    this.validateSlots();
  }

  protected isSlotAvailable = (drag: any, drop: any): boolean => {
    return drop.data && drop.data.length === 0;
  };

  protected dropToSlot(event: CdkDragDrop<PatientRequestAttachment[]>, slotIndex: number): void {
    const slots = [...this.fixedSlots()];

    if (event.previousContainer !== event.container) {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        0
      );
    } else {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    }

    this.fixedSlots.set(slots);
    this.validateSlots();
  }

  protected removeFileFromSlot(slotIndex: number): void {
    const slots = [...this.fixedSlots()];
    const targetSlot = slots[slotIndex];

    if (targetSlot.assignedFile.length > 0) {
      const removedFile = targetSlot.assignedFile.pop();
      if (removedFile) {
        this.availableFiles.update(files => [...files, removedFile]);
      }
    }

    this.fixedSlots.set(slots);
    this.validateSlots();
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForms(): void {
    this.step1FormGroup = this.fb.group({
      payment_professional_id: [null, [Validators.required]],
      cost_assistance_id: [null, [Validators.required]],
      travel_id: [null, [Validators.required]]
    });

    this.step2FormGroup = this.fb.group({});

    this.tramitPatientRequestForm = this.fb.group({
      step1: this.step1FormGroup,
      step2: this.step2FormGroup
    });

    this.configureFilters();
    this.validateSlots();
  }

  private loadArchives(): void {
    const rawArchives: PatientRequestAttachment[] = this.data?.patient_request?.attachments || [];
    this.availableFiles.set([...rawArchives]);
  }

  private loadCostAssistanceOptions(): void {
    const rawCostAssistances = this.data?.patient_request?.cost_assistances || this.data?.cost_assistances || [];
    this.costAssistanceOptions = rawCostAssistances.filter((item: any) => item?.status === true);
  }

  private loadTravelOptions(): void {
    const rawTravels = this.data?.patient_request?.travels || this.data?.travels || [];
    this.travelOptions = rawTravels.filter((item: any) => item?.status === true);
  }

  private patchInitialValues(): void {
    const req = this.data?.patient_request;
    if (!req) return;

    if (req.payment_professional) {
      this.setPaymentProfessional(req.payment_professional);
    }
    if (req.cost_assistance) {
      this.setCostAssistance(req.cost_assistance);
    }
    if (req.travel) {
      this.setTravel(req.travel);
    }
  }

  private fetchPaymentProfessionals(): void {
    this.isLoadingProfessionals.set(true);

    this.costAssistanceService.getPaymentProfessionals()
      .pipe(
        finalize(() => {
          this.isLoadingProfessionals.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          if (response && Array.isArray(response.payment_professionals)) {
            this.paymentProfessionalOptions = response.payment_professionals;
          } else if (Array.isArray(response)) {
            this.paymentProfessionalOptions = response;
          } else {
            this.paymentProfessionalOptions = [];
          }

          this.isReadOnly.set(false);

          // Força a atualização do autocomplete
          this.paymentProfessionalControl.updateValueAndValidity({ emitEvent: true });

          const initialProf = this.data?.patient_request?.payment_professional;
          if (initialProf) {
            const matched = this.paymentProfessionalOptions.find(p => p.id === initialProf.id);
            this.setPaymentProfessional(matched || initialProf);
          }

          this.cdr.markForCheck();
        },
        error: () => {
          this.isReadOnly.set(true);
          this.paymentProfessionalOptions = [];
          this.cdr.markForCheck();
        }
      });
  }

  private configureFilters(): void {
    this.filteredPaymentProfessionalOptions = this.paymentProfessionalControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const term = typeof value === 'string' ? value : value?.name || '';
        return term ? this._filterOptions(term, this.paymentProfessionalOptions, 'professional') : this.paymentProfessionalOptions.slice(0, 10);
      }),
      takeUntilDestroyed(this.destroyRef)
    );

    this.filteredCostAssistanceOptions = this.costAssistanceControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const term = typeof value === 'string' ? value : this.displayCostAssistance(value);
        return term ? this._filterOptions(term, this.costAssistanceOptions, 'cost') : this.costAssistanceOptions.slice(0, 10);
      }),
      takeUntilDestroyed(this.destroyRef)
    );

    this.filteredTravelOptions = this.travelControl.valueChanges.pipe(
      startWith(''),
      map(value => {
        const term = typeof value === 'string' ? value : this.displayTravel(value);
        return term ? this._filterOptions(term, this.travelOptions, 'travel') : this.travelOptions.slice(0, 10);
      }),
      takeUntilDestroyed(this.destroyRef)
    );

    this.paymentProfessionalControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        const id = typeof val === 'object' && val !== null ? val.id : null;
        this.step1FormGroup.get('payment_professional_id')?.setValue(id);
        this.step1FormGroup.get('payment_professional_id')?.markAsTouched();
      });

    this.costAssistanceControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        const id = typeof val === 'object' && val !== null ? val.id : null;
        this.step1FormGroup.get('cost_assistance_id')?.setValue(id);
        this.step1FormGroup.get('cost_assistance_id')?.markAsTouched();
      });

    this.travelControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        const id = typeof val === 'object' && val !== null ? val.id : null;
        this.step1FormGroup.get('travel_id')?.setValue(id);
        this.step1FormGroup.get('travel_id')?.markAsTouched();
      });
  }

  private _filterOptions(searchTerm: string, options: any[], type: 'professional' | 'cost' | 'travel'): any[] {
    if (!searchTerm) {
      return options.slice(0, 10);
    }
    const filterValue = searchTerm.toLowerCase().trim();
    return options
      .filter(option => {
        let text = '';
        if (type === 'professional') {
          text = option.name || '';
        } else if (type === 'cost') {
          text = this.displayCostAssistance(option);
        } else if (type === 'travel') {
          text = this.displayTravel(option);
        }
        return text.toLowerCase().includes(filterValue);
      })
      .slice(0, 10);
  }

  private validateSlots(): void {
    const isValid = this.areSlotsValid();

    if (!isValid) {
      this.step2FormGroup.setErrors({ incompleteSlots: true });
    } else {
      this.step2FormGroup.setErrors(null);
    }
  }

  private getCompanyLabel(companyValue: string): string {
    if (!companyValue) return '';

    const upperValue = companyValue.trim().toUpperCase();

    if (upperValue in TravelCompany) {
      return TravelCompany[upperValue as keyof typeof TravelCompany];
    }

    const enumValues = Object.values(TravelCompany) as string[];
    if (enumValues.includes(upperValue)) {
      return upperValue;
    }

    return companyValue;
  }

  private formatDepartureDate(dateVal: any): string {
    if (!dateVal) return '';

    if (
      typeof dateVal === 'string' &&
      (/^\d{2}\/\d{4}$/.test(dateVal) || /^\d{2}\/\d{2}\/\d{4}$/.test(dateVal))
    ) {
      return dateVal;
    }

    const dateObj = new Date(dateVal);
    if (!isNaN(dateObj.getTime())) {
      const userOffset = dateObj.getTimezoneOffset() * 60000;
      const adjustedDate = new Date(dateObj.getTime() + userOffset);

      const day = String(adjustedDate.getDate()).padStart(2, '0');
      const month = String(adjustedDate.getMonth() + 1).padStart(2, '0');
      const year = adjustedDate.getFullYear();

      return `${day}/${month}/${year}`;
    }

    return String(dateVal);
  }
}