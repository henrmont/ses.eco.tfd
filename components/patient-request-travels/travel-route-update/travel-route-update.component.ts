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
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import * as _moment from 'moment';
const moment = (_moment as any).default || _moment;

// Material Modules
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
import { PatientRequestTravelService } from '../../../services/patient-request-travel.service';

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
  protected readonly data = inject(MAT_DIALOG_DATA, { optional: true });
  private readonly fb = inject(FormBuilder);
  private readonly travelService = inject(PatientRequestTravelService);
  private readonly messageService = inject(MessageService);
  private readonly dialogRef = inject(MatDialogRef<TravelRouteUpdateComponent>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  // ==========================================
  // Dicionário de Mensagens de Erro
  // ==========================================
  protected readonly errorMessages: Record<string, Array<{ type: string; message: string }>> = {
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
  // Estados Reativos via Signals
  // ==========================================
  protected readonly isSubmitting = signal<boolean>(false);

  // ==========================================
  // Formulário Principal
  // ==========================================
  protected updateRouteForm!: FormGroup;

  // ==========================================
  // Ciclo de Vida (Hooks)
  // ==========================================
  ngOnInit(): void {
    this.initForm();
    this.setupFormSubmittingHandler();
  }

  // ==========================================
  // Inicialização do Formulário
  // ==========================================
  private initForm(): void {
    const route = this.data?.route;

    const departureRaw = route?.departure || route?.departureTime || route?.departure_time;
    const arrivalRaw = route?.arrival || route?.arrivalTime || route?.arrival_time;

    const departureVal = departureRaw ? moment(departureRaw) : null;
    const arrivalVal = arrivalRaw ? moment(arrivalRaw) : null;

    this.updateRouteForm = this.fb.group({
      flight: [route?.flight || route?.flightNumber || route?.flight_number || null],
      airplane: [route?.airplane || route?.aircraft || null],
      departure: [departureVal, [CustomValidators.dateValidator()]],
      arrival: [arrivalVal, [CustomValidators.dateValidator()]],
      origin: [route?.origin ?? null, [Validators.required]],
      destination: [route?.destination ?? null, [Validators.required]],
      distance: [route?.distance ?? null, [Validators.min(0)]],
      class: [route?.class ?? null],
      scales: [route?.scales || route?.stopover || route?.stops || null],
      family: [route?.family || route?.fare_family || null]
    });
  }

  // ==========================================
  // Handlers Reativos
  // ==========================================
  private setupFormSubmittingHandler(): void {
    toObservable(this.isSubmitting, { injector: this.injector })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isSubmitting => {
        if (isSubmitting) {
          this.updateRouteForm.disable({ emitEvent: false });
        } else {
          this.updateRouteForm.enable({ emitEvent: false });
        }
        this.cdr.markForCheck();
      });
  }

  // ==========================================
  // Helpers e Métodos Auxiliares
  // ==========================================
  protected setDepartureDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        this.updateRouteForm.get('departure')?.setValue(parsedDate, { emitEvent: true });
        this.updateRouteForm.get('departure')?.markAsDirty();
      }
    }
  }

  protected setArrivalDate(event: MatDatepickerInputEvent<unknown>): void {
    if (event.value) {
      const parsedDate = moment(event.value);
      if (parsedDate.isValid()) {
        this.updateRouteForm.get('arrival')?.setValue(parsedDate, { emitEvent: true });
        this.updateRouteForm.get('arrival')?.markAsDirty();
      }
    }
  }

  /**
   * Bloqueia a digitação de caracteres que não sejam números ou barras no input.
   */
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
  // Submissão do Formulário
  // ==========================================
  protected onSubmit(): void {
    const routeId = this.data?.route?.id;

    if (!routeId) {
      this.messageService.showMessage('Identificador da rota não encontrado.');
      return;
    }

    if (this.updateRouteForm.invalid) {
      this.updateRouteForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const rawValues = this.updateRouteForm.getRawValue();

    const payload = {
      ...rawValues,
      departure: rawValues.departure ? moment(rawValues.departure).format('YYYY-MM-DD HH:mm:ss') : null,
      arrival: rawValues.arrival ? moment(rawValues.arrival).format('YYYY-MM-DD HH:mm:ss') : null
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
}