import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

// Angular Material
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';

// Importação segura do Moment
import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

// Services, Enums, Models & Validators
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { TravelCompany } from '../../../enums/travel-company';
import { TravelTransportation } from '../../../enums/travel-transportation';
import { TravelType } from '../../../enums/travel-type';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-patient-request-travel-update',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSelectModule
  ],
  templateUrl: './patient-request-travel-update.component.html',
  styleUrl: './patient-request-travel-update.component.scss',
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PatientRequestTravelUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<PatientRequestTravelUpdateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // Data de referência vinda da requisição ou viagem
  private readonly consultationDate =
    this.data?.travel?.patient_request?.consultation_date || this.data?.consultation_date;

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected updateTravelForm!: FormGroup;

  protected readonly isSubmitting = signal<boolean>(false);
  protected readonly disableDepartureDate = signal<boolean>(true);
  protected readonly disableReturnDate = signal<boolean>(true);

  // Listagens Estáticas (Enums)
  protected readonly transportations = Object.values(TravelTransportation);
  protected readonly types = Object.values(TravelType);
  protected readonly airlines = Object.entries(TravelCompany).map(([key, value]) => ({ key, value }));

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
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
      { type: 'dateBefore', message: 'A data de partida é posterior à data da consulta.' }
    ],
    return_date: [
      { type: 'required', message: 'A data de retorno é obrigatória.' },
      { type: 'invalidDate', message: 'Data de retorno inválida.' },
      { type: 'dateAfter', message: 'A data de retorno é anterior à data da consulta.' }
    ]
  };

  // ==========================================
  // Construtor com a lógica reativa do Effect
  // ==========================================
  constructor() {
    effect(() => {
      const submitting = this.isSubmitting();
      const disableDep = this.disableDepartureDate();
      const disableRet = this.disableReturnDate();

      if (!this.updateTravelForm) return;

      if (submitting) {
        this.updateTravelForm.disable({ emitEvent: false });
        return;
      }

      // Reabilita os campos gerais do formulário
      this.updateTravelForm.enable({ emitEvent: false });

      // Atualiza estado reativo do controle de Data de Ida
      this.applyDateControlState(
        'departure_date',
        disableDep,
        [CustomValidators.dateValidator(), CustomValidators.dateBeforeValidator(this.consultationDate)]
      );

      // Atualiza estado reativo do controle de Data de Volta
      this.applyDateControlState(
        'return_date',
        disableRet,
        [CustomValidators.dateValidator(), CustomValidators.dateAfterValidator(this.consultationDate)]
      );
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();

    // Sincroniza os estados de datas com base no valor vindo da API
    if (this.data?.travel?.type) {
      this.setType(this.data.travel.type);
    }
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected onSelection(event: MatSelectChange): void {
    this.setType(event.value);
  }

  protected setDepartureDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        const ctrl = this.updateTravelForm.get('departure_date');
        ctrl?.setValue(parsedDate, { emitEvent: true });
        ctrl?.markAsDirty();
      }
    }
  }

  protected setReturnDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        const ctrl = this.updateTravelForm.get('return_date');
        ctrl?.setValue(parsedDate, { emitEvent: true });
        ctrl?.markAsDirty();
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

  protected onSubmit(): void {
    const travelId = this.data?.travel?.id;

    if (!travelId) {
      this.messageService.showMessage('Identificador da viagem não encontrado.');
      return;
    }

    if (this.updateTravelForm.invalid) {
      this.updateTravelForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const rawValue = this.updateTravelForm.getRawValue();
    const payload = {
      ...rawValue,
      departure_date: rawValue.departure_date && moment.isMoment(rawValue.departure_date)
        ? rawValue.departure_date.format('YYYY-MM-DD')
        : rawValue.departure_date,
      return_date: rawValue.return_date && moment.isMoment(rawValue.return_date)
        ? rawValue.return_date.format('YYYY-MM-DD')
        : rawValue.return_date
    };

    this.travelService.updateTravel(travelId, payload)
      .pipe(
        finalize(() => {
          this.isSubmitting.set(false);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Viagem atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao processar a atualização da viagem.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const travel = this.data?.travel;

    const departureDate = travel?.departure_date ? moment(travel.departure_date) : null;
    const returnDate = travel?.return_date ? moment(travel.return_date) : null;

    this.updateTravelForm = this.fb.group({
      transportation: [travel?.transportation || null, [Validators.required]],
      type: [travel?.type || null],
      company: [travel?.company || null],
      origin: [travel?.origin || null],
      destination: [travel?.destination || null],
      departure_date: [
        { value: departureDate, disabled: true },
        [
          CustomValidators.dateValidator(),
          CustomValidators.dateBeforeValidator(this.consultationDate)
        ]
      ],
      return_date: [
        { value: returnDate, disabled: true },
        [
          CustomValidators.dateValidator(),
          CustomValidators.dateAfterValidator(this.consultationDate)
        ]
      ],
      description: [travel?.description || null],
      os: [travel?.os || null],
      locator: [travel?.locator || null]
    });
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

  private applyDateControlState(
    controlName: string,
    disabled: boolean,
    baseValidators: any[]
  ): void {
    const control = this.updateTravelForm.get(controlName);
    if (!control) return;

    if (disabled) {
      control.disable({ emitEvent: false });
      control.setValue(null, { emitEvent: false });
      control.setValidators(baseValidators);
    } else {
      control.enable({ emitEvent: false });
      control.setValidators([Validators.required, ...baseValidators]);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }
}