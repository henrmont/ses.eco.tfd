import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { CreateRouteComponent } from './create-route-component';
import { TravelService } from '../../../services/travel-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreateRouteComponent', () => {
  let component: CreateRouteComponent;
  let fixture: ComponentFixture<CreateRouteComponent>;

  let travelServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock completo da estrutura de dados esperada do MAT_DIALOG_DATA
  const mockDialogData = {
    travel: {
      id: 99
    }
  };

  beforeEach(async () => {
    travelServiceMock = {
      createRoute: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [CreateRouteComponent],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: TravelService, useValue: travelServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(CreateRouteComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateRouteComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente com sucesso e inicializar o formulário com valores padrão', () => {
    fixture.detectChanges(); // Dispara o ngOnInit e ciclos do Angular

    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['createRouteForm']).toBeTruthy();
    expect(component['createRouteForm'].get('origin')?.value).toBeNull();
    expect(component['createRouteForm'].get('destination')?.value).toBeNull();
  });

  describe('Fluxo de Submissão da Rota (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve barrar o envio e marcar campos como tocados se o formulário estiver inválido', () => {
      const markAllAsTouchedSpy = vi.spyOn(component['createRouteForm'], 'markAllAsTouched');
      
      component['onSubmit']();

      expect(markAllAsTouchedSpy).toHaveBeenCalled();
      expect(travelServiceMock.createRoute).not.toHaveBeenCalled();
    });

    it('deve barrar o envio se o id da viagem (travelId) não estiver disponível nos dados injetados', () => {
      component['createRouteForm'].patchValue({
        origin: 'Cuiabá',
        destination: 'Lucas do Rio Verde',
        distance: 350
      });

      // Sobrescreve o objeto data temporariamente simulando ausência de id
      (component as any).data = { travel: { id: null } };

      component['onSubmit']();
      expect(travelServiceMock.createRoute).not.toHaveBeenCalled();
    });

    it('deve submeter os dados com sucesso, exibir mensagem de retorno e fechar o diálogo', () => {
      component['createRouteForm'].patchValue({
        origin: 'Cuiabá',
        destination: 'Rondonópolis',
        distance: 215
      });

      travelServiceMock.createRoute.mockReturnValue(of({ message: 'Rota criada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(travelServiceMock.createRoute).toHaveBeenCalledWith(99, component['createRouteForm'].getRawValue());
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Rota criada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve lidar de forma segura com falhas de API exibindo a mensagem do backend', () => {
      component['createRouteForm'].patchValue({
        origin: 'Cuiabá',
        destination: 'Rondonópolis',
        distance: 215
      });

      const mockApiError = { error: { message: 'Erro de validação do banco de dados.' } };
      travelServiceMock.createRoute.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro de validação do banco de dados.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar uma mensagem de erro genérica por fallback se a API falhar sem retornar corpo estruturado', () => {
      component['createRouteForm'].patchValue({
        origin: 'Cuiabá',
        destination: 'Rondonópolis',
        distance: 215
      });

      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      travelServiceMock.createRoute.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar a criação da rota.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});