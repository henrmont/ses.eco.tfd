import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Observable, finalize, map, startWith } from 'rxjs';

// Angular Material e Módulos Externos
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
import { MessageService } from '../../../../core/services/message-service';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestCostAssistanceService } from '../../../services/patient-request-cost-assistance.service';
import { TravelCompany } from '../../../enums/travel-company';

interface FixedSlot {
  key: string;
  title: string;
  required: boolean;
  assignedFile: PatientRequestAttachment[];
}

@Component({
  selector: 'app-patient-request-process-to-payment',
  standalone: true,
  imports: [
    CommonModule,
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
  templateUrl: './patient-request-process-to-payment.component.html',
  styleUrl: './patient-request-process-to-payment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestProcessToPaymentComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly costAssistanceService = inject(PatientRequestCostAssistanceService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestProcessToPaymentComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
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

  // ==========================================
  // Estados Reativos via Signals e Computeds
  // ==========================================
  protected readonly paymentProfessionalReadOnly = signal<boolean>(true);
  protected readonly paymentProfessionalLoading = signal<boolean>(false);
  protected readonly isSubmitting = signal<boolean>(false);
  
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

  // ==========================================
  // FormGroups
  // ==========================================
  protected step1FormGroup!: FormGroup;
  protected step2FormGroup!: FormGroup;
  protected tramitPatientRequestForm!: FormGroup;

  // ==========================================
  // Autocomplete e Observables
  // ==========================================
  protected paymentProfessionalOptions: any[] = [];
  protected filteredPaymentProfessionalOptions!: Observable<any[]>;

  protected costAssistanceOptions: any[] = [];
  protected filteredCostAssistanceOptions!: Observable<any[]>;

  protected travelOptions: any[] = [];
  protected filteredTravelOptions!: Observable<any[]>;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForms();
    this.loadArchives();
    this.getPaymentProfessionals();
    this.loadCostAssistanceOptions();
    this.loadTravelOptions();
  }

  // ==========================================
  // Inicialização de Formulários
  // ==========================================
  private initForms(): void {
    this.step1FormGroup = this.fb.group({
      payment_professional_search: ['', [Validators.required]],
      payment_professional_id: [null, [Validators.required]],
      cost_assistance_search: ['', [Validators.required]],
      cost_assistance_id: [null, [Validators.required]],
      travel_search: ['', [Validators.required]],
      travel_id: [null, [Validators.required]]
    });

    this.step2FormGroup = this.fb.group({});

    this.tramitPatientRequestForm = this.fb.group({
      step1: this.step1FormGroup,
      step2: this.step2FormGroup
    });

    this.registerCleaners();
    this.validateSlots();
  }

  private registerCleaners(): void {
    const profSearchControl = this.step1FormGroup.get('payment_professional_search');
    const profIdControl = this.step1FormGroup.get('payment_professional_id');

    profSearchControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        if (!val || typeof val !== 'object') {
          profIdControl?.setValue(null);
          profIdControl?.markAsTouched();
        }
      });

    const costSearchControl = this.step1FormGroup.get('cost_assistance_search');
    const costIdControl = this.step1FormGroup.get('cost_assistance_id');

    costSearchControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        if (!val || typeof val !== 'object') {
          costIdControl?.setValue(null);
          costIdControl?.markAsTouched();
        }
      });

    const travelSearchControl = this.step1FormGroup.get('travel_search');
    const travelIdControl = this.step1FormGroup.get('travel_id');

    travelSearchControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(val => {
        if (!val || typeof val !== 'object') {
          travelIdControl?.setValue(null);
          travelIdControl?.markAsTouched();
        }
      });
  }

  private loadArchives(): void {
    const rawArchives: PatientRequestAttachment[] = this.data?.patient_request?.attachments || [];
    this.availableFiles.set([...rawArchives]);
  }

  // ==========================================
  // Configuração e Filtros dos Autocompletes
  // ==========================================
  private setPaymentProfessionalOptions(): void {
    const control = this.step1FormGroup.get('payment_professional_search');
    if (!control) return;

    this.filteredPaymentProfessionalOptions = control.valueChanges.pipe(
      startWith(control.value),
      map(value => {
        if (value && typeof value === 'object') {
          return this._filterOptions(value.name || '', this.paymentProfessionalOptions, 'professional');
        }
        return value ? this._filterOptions(value as string, this.paymentProfessionalOptions, 'professional') : this.paymentProfessionalOptions.slice(0, 10);
      })
    );
  }

  private loadCostAssistanceOptions(): void {
    const rawCostAssistances = this.data?.patient_request?.cost_assistances || this.data?.cost_assistances || [];
    this.costAssistanceOptions = rawCostAssistances.filter((item: any) => item?.status === true);
    
    const control = this.step1FormGroup.get('cost_assistance_search');
    if (!control) return;

    this.filteredCostAssistanceOptions = control.valueChanges.pipe(
      startWith(control.value),
      map(value => {
        if (value && typeof value === 'object') {
          return this._filterOptions(this.displayCostAssistance(value), this.costAssistanceOptions, 'cost');
        }
        return value ? this._filterOptions(value as string, this.costAssistanceOptions, 'cost') : this.costAssistanceOptions.slice(0, 10);
      })
    );
  }

  private loadTravelOptions(): void {
    const rawTravels = this.data?.patient_request?.travels || this.data?.travels || [];
    this.travelOptions = rawTravels.filter((item: any) => item?.status === true);

    const control = this.step1FormGroup.get('travel_search');
    if (!control) return;

    this.filteredTravelOptions = control.valueChanges.pipe(
      startWith(control.value),
      map(value => {
        if (value && typeof value === 'object') {
          return this._filterOptions(this.displayTravel(value), this.travelOptions, 'travel');
        }
        return value ? this._filterOptions(value as string, this.travelOptions, 'travel') : this.travelOptions.slice(0, 10);
      })
    );
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

  // ==========================================
  // Helpers de Exibição e Seleção
  // ==========================================
  protected displayPaymentProfessional(professional: any): string {
    return professional?.name || '';
  }

  protected setPaymentProfessional(option: any): void {
    if (option?.id) {
      this.step1FormGroup.patchValue({
        payment_professional_id: option.id,
        payment_professional_search: option
      });
      this.step1FormGroup.markAsDirty();
      this.cdr.markForCheck();
    }
  }

  protected displayCostAssistance(item: any): string {
    if (!item) return '';
    return item.description ? `${item.description} - R$ ${item.value || '0,00'}` : (item.name || '');
  }

  protected setCostAssistance(option: any): void {
    if (option?.id) {
      this.step1FormGroup.patchValue({
        cost_assistance_id: option.id,
        cost_assistance_search: option
      });
      this.step1FormGroup.markAsDirty();
      this.cdr.markForCheck();
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

    if (typeof dateVal === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateVal)) {
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

  protected setTravel(option: any): void {
    if (option?.id) {
      this.step1FormGroup.patchValue({
        travel_id: option.id,
        travel_search: option
      });
      this.step1FormGroup.markAsDirty();
      this.cdr.markForCheck();
    }
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
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  private validateSlots(): void {
    const isValid = this.areSlotsValid();

    if (!isValid) {
      this.step2FormGroup.setErrors({ incompleteSlots: true });
    } else {
      this.step2FormGroup.setErrors(null);
    }
  }

  // ==========================================
  // Helpers e Métodos Auxiliares
  // ==========================================
  protected getPaymentProfessionals(): void {
    this.paymentProfessionalLoading.set(true);

    this.costAssistanceService.getPaymentProfessionals()
      .pipe(
        finalize(() => {
          this.paymentProfessionalLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          if (response) {
            this.paymentProfessionalOptions = response.map((item: any) => ({
              ...item?.patient,
              ...item
            }));
            this.setPaymentProfessionalOptions();
            this.paymentProfessionalReadOnly.set(false);
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.paymentProfessionalReadOnly.set(true);
        }
      });
  }

  // ==========================================
  // Submissão do Formulário
  // ==========================================
  protected onSubmit(): void {
    if (this.tramitPatientRequestForm.invalid || !this.areSlotsValid() || this.isSubmitting()) {
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
    this.cdr.markForCheck();

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
        finalize(() => {
          this.isSubmitting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Solicitação processada para pagamento com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao tentar processar a solicitação para pagamento.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}