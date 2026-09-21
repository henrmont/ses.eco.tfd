import { CommonModule } from '@angular/common';
import { 
  ChangeDetectionStrategy, 
  ChangeDetectorRef, 
  Component, 
  DestroyRef, 
  Injector, 
  OnInit, 
  effect, 
  inject, 
  signal 
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

// Material Modules
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';

// Importação segura do Moment
import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

// Services, Enums e Validators
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { TravelCompany } from '../../../enums/travel-company';
import { TravelTransportation } from '../../../enums/travel-transportation';
import { TravelType } from '../../../enums/travel-type';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

@Component({
  selector: 'app-patient-request-travel-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatSelectModule
  ],
  templateUrl: './patient-request-travel-create.component.html',
  styleUrl: './patient-request-travel-create.component.scss',
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestTravelCreateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<PatientRequestTravelCreateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // Data de referência vinda da requisição
  private readonly consultationDate = this.data?.patient_request?.consultation_date;

  // ==========================================
  // Mensagens de Erro por Controle
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
    transportation: [
      { type: 'required', message: 'O meio de transporte é obrigatório.' }
    ],
    type: [],
    company: [],
    origin: [],
    destination: [],
    departure_date: [
      { type: 'required', message: 'A data de partida é obrigatória.' },
      { type: 'invalidDate', message: 'Data de partida inválida.' },
      { type: 'dateBefore', message: 'A data de partida posterior à data da consulta.' }
    ],
    return_date: [
      { type: 'required', message: 'A data de retorno é obrigatória.' },
      { type: 'invalidDate', message: 'Data de retorno inválida.' },
      { type: 'dateAfter', message: 'A data de retorno anterior à data da consulta.' }
    ]
  };

  // ==========================================
  // Listagens Estáticas (Enums)
  // ==========================================
  protected readonly transportations = Object.values(TravelTransportation);
  protected readonly types = Object.values(TravelType);
  protected readonly airlines = Object.entries(TravelCompany).map(([key, value]) => ({ key, value }));

  // ==========================================
  // Estados Reativos via Signals
  // ==========================================
  protected readonly disableDepartureDate = signal<boolean>(true);
  protected readonly disableReturnDate = signal<boolean>(true);
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // FormGroups
  // ==========================================
  protected createTravelForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
    this.configureReactiveDateEffects();
  }

  // ==========================================
  // Inicialização de Formulário
  // ==========================================
  private initForm(): void {
    this.createTravelForm = this.fb.group({
      transportation: [null, [Validators.required]],
      type: [null],
      company: [null],
      origin: [null],
      destination: [null],
      departure_date: [
        { value: null, disabled: true },
        [
          CustomValidators.dateValidator(),
          CustomValidators.dateBeforeValidator(this.consultationDate)
        ]
      ],
      return_date: [
        { value: null, disabled: true },
        [
          CustomValidators.dateValidator(),
          CustomValidators.dateAfterValidator(this.consultationDate)
        ]
      ],
      description: [null],
      os: [null],
      locator: [null]
    });
  }

  // ==========================================
  // Handlers e Effects Reativos
  // ==========================================
  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.createTravelForm.disable({ emitEvent: false });
        } else {
          this.createTravelForm.enable({ emitEvent: false });
          // Re-aplica as regras dinâmicas de desabilitação das datas caso precise reabilitar o formulário
          this.applyDateControlsState();
        }
        this.cdr.markForCheck();
      });
  }

  private configureReactiveDateEffects(): void {
    effect(() => {
      this.disableDepartureDate();
      this.disableReturnDate();

      // Executa a atualização dos estados apenas se o formulário não estiver bloqueado por submissão
      if (!this.isSubmitting()) {
        this.applyDateControlsState();
      }
    }, { injector: this.injector });
  }

  private applyDateControlsState(): void {
    const departureCtrl = this.createTravelForm.get('departure_date');
    const baseDepartureValidators = [
      CustomValidators.dateValidator(),
      CustomValidators.dateBeforeValidator(this.consultationDate)
    ];

    if (this.disableDepartureDate()) {
      departureCtrl?.disable({ emitEvent: false });
      departureCtrl?.setValue(null, { emitEvent: false });
      departureCtrl?.setValidators(baseDepartureValidators);
    } else {
      departureCtrl?.enable({ emitEvent: false });
      departureCtrl?.setValidators([Validators.required, ...baseDepartureValidators]);
    }
    departureCtrl?.updateValueAndValidity({ emitEvent: false });

    const returnCtrl = this.createTravelForm.get('return_date');
    const baseReturnValidators = [
      CustomValidators.dateValidator(),
      CustomValidators.dateAfterValidator(this.consultationDate)
    ];

    if (this.disableReturnDate()) {
      returnCtrl?.disable({ emitEvent: false });
      returnCtrl?.setValue(null, { emitEvent: false });
      returnCtrl?.setValidators(baseReturnValidators);
    } else {
      returnCtrl?.enable({ emitEvent: false });
      returnCtrl?.setValidators([Validators.required, ...baseReturnValidators]);
    }
    returnCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  // ==========================================
  // Helpers de Seleção e Manipulação de Datas
  // ==========================================
  protected onSelection(event: MatSelectChange): void {
    this.setType(event.value);
  }

  private setType(type: string): void {
    if (type === 'Ida') {
      this.disableDepartureDate.set(false);
      this.disableReturnDate.set(true);
    } else if (type === 'Volta') {
      this.disableDepartureDate.set(true);
      this.disableReturnDate.set(false);
    } else if (type === 'Ida e Volta') {
      this.disableDepartureDate.set(false);
      this.disableReturnDate.set(false);
    } else {
      this.disableDepartureDate.set(true);
      this.disableReturnDate.set(true);
    }
  }

  protected setDepartureDate(event: MatDatepickerInputEvent<any>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        this.createTravelForm.get('departure_date')?.setValue(parsedDate, { emitEvent: true });
        this.createTravelForm.get('departure_date')?.markAsDirty();
      }
    }
  }

  protected setReturnDate(event: MatDatepickerInputEvent<any>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        this.createTravelForm.get('return_date')?.setValue(parsedDate, { emitEvent: true });
        this.createTravelForm.get('return_date')?.markAsDirty();
      }
    }
  }

  protected onlyNumbersAndSlashes(event: KeyboardEvent): boolean {
    const charCode = event.key;
    const allowedCharacters = /^[0-9\/]$/;

    if (!allowedCharacters.test(charCode)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // ==========================================
  // Submissão
  // ==========================================
  protected onSubmit(): void {
    const requestId = this.data?.patient_request?.id;

    if (this.createTravelForm.invalid || !requestId) {
      this.createTravelForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const rawValue = this.createTravelForm.getRawValue();
    const payload = {
      ...rawValue,
      departure_date: rawValue.departure_date && moment.isMoment(rawValue.departure_date)
        ? rawValue.departure_date.format('YYYY-MM-DD')
        : rawValue.departure_date,
      return_date: rawValue.return_date && moment.isMoment(rawValue.return_date)
        ? rawValue.return_date.format('YYYY-MM-DD')
        : rawValue.return_date
    };

    this.travelService.createTravel(requestId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: any) => {
          this.messageService.showMessage(response?.message || 'Viagem criada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao processar a criação da viagem.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }
}