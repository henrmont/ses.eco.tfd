import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Core, Models, Validators & Serviços
import { ApiResponse } from '../../../../core/models/api-response.model';
import { MessageService } from '../../../../core/services/message-service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { TravelRoute } from '../../../models/travel-route.model';
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

// ============================================================================
// Tipos e Interfaces
// ============================================================================

export type TravelRouteUpdateDialogData = {
  route?: TravelRoute;
};

interface ErrorMessage {
  type: string;
  message: string;
}

@Component({
  selector: 'app-travel-route-update',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }
  ],
  templateUrl: './travel-route-update.component.html',
  styleUrl: './travel-route-update.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TravelRouteUpdateComponent implements OnInit {
  // ==========================================
  // Injeção de Dependências
  // ==========================================
  protected readonly data = inject<TravelRouteUpdateDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly dialogRef = inject(MatDialogRef<TravelRouteUpdateComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  // ==========================================
  // Propriedades e Estado Reativo
  // ==========================================
  protected updateRouteForm!: FormGroup;
  protected readonly isSubmitting = signal<boolean>(false);

  // Mapeamento de Mensagens de Erro Tipado
  protected readonly errorMessages: Record<string, ErrorMessage[]> = {
    origin: [
      { type: 'required', message: 'A cidade de origem é obrigatória.' }
    ],
    destination: [
      { type: 'required', message: 'A cidade de destino é obrigatória.' }
    ],
    distance: [
      { type: 'min', message: 'A distância não pode ser negativa.' }
    ],
    departure: [
      { type: 'invalidDate', message: 'Data de saída inválida.' }
    ],
    arrival: [
      { type: 'invalidDate', message: 'Data de chegada inválida.' }
    ],
    flight: [],
    airplane: [],
    class: [],
    scales: [],
    family: []
  };

  // ==========================================
  // Construtor com Lógica Reativa (Effect)
  // ==========================================
  constructor() {
    effect(() => {
      const submitting = this.isSubmitting();

      if (!this.updateRouteForm) return;

      if (submitting) {
        this.updateRouteForm.disable({ emitEvent: false });
      } else {
        this.updateRouteForm.enable({ emitEvent: false });
      }
    });
  }

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
  }

  // ==========================================
  // Métodos Acessíveis pelo Template (Protected)
  // ==========================================
  protected setDepartureDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        const ctrl = this.updateRouteForm.get('departure');
        ctrl?.setValue(parsedDate, { emitEvent: true });
        ctrl?.markAsDirty();
      }
    }
  }

  protected setArrivalDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        const ctrl = this.updateRouteForm.get('arrival');
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
    const routeId = this.data?.route?.id;

    if (this.updateRouteForm.invalid || !routeId) {
      this.updateRouteForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const rawValues = this.updateRouteForm.getRawValue();

    const payload = {
      ...rawValues,
      departure: rawValues.departure && moment.isMoment(rawValues.departure)
        ? rawValues.departure.format('YYYY-MM-DD HH:mm:ss')
        : rawValues.departure,
      arrival: rawValues.arrival && moment.isMoment(rawValues.arrival)
        ? rawValues.arrival.format('YYYY-MM-DD HH:mm:ss')
        : rawValues.arrival
    };

    this.travelService.updateRoute(routeId, payload)
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: ApiResponse) => {
          this.messageService.showMessage(response?.message || 'Rota atualizada com sucesso!');
          this.dialogRef.close(true);
        },
        error: (err) => {
          const fallbackError = 'Erro ao processar a atualização da rota.';
          this.messageService.showMessage(err?.error?.message || fallbackError);
        }
      });
  }

  // ==========================================
  // Métodos Privados / Auxiliares
  // ==========================================
  private initForm(): void {
    const route = this.data?.route;

    const departureRaw = route?.departure;
    const arrivalRaw = route?.arrival;

    const departureVal = departureRaw ? moment(departureRaw) : null;
    const arrivalVal = arrivalRaw ? moment(arrivalRaw) : null;

    this.updateRouteForm = this.fb.group({
      flight: [route?.flight || null],
      airplane: [route?.airplane || null],
      departure: [departureVal, [CustomValidators.dateValidator()]],
      arrival: [arrivalVal, [CustomValidators.dateValidator()]],
      origin: [route?.origin ?? null, [Validators.required]],
      destination: [route?.destination ?? null, [Validators.required]],
      distance: [route?.distance ?? null, [Validators.min(0)]],
      class: [route?.class ?? null],
      scales: [route?.scales || null],
      family: [route?.family || null]
    });
  }
}