import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { UpdateRouteComponent } from './update-route-component';
import { TravelService } from '../../../services/travel-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdateRouteComponent', () => {
  let component: UpdateRouteComponent;
  let fixture: ComponentFixture<UpdateRouteComponent>;

  let travelServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock com a estrutura exata recebida pelo componente de atualização de rota
  const mockDialogData = {
    route: {
      id: 77,
      origin: 'Cuiabá',
      destination: 'Sinop',
      distance: 500
    }
  };

  beforeEach(async () => {
    travelServiceMock = {
      updateRoute: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UpdateRouteComponent],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: TravelService, useValue: travelServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(UpdateRouteComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateRouteComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente com sucesso e inicializar o formulário com os dados da rota recebida', () => {
    fixture.detectChanges(); // Dispara o ngOnInit e ciclo inicial

    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['updateRouteForm']).toBeTruthy();
    expect(component['updateRouteForm'].get('origin')?.value).toBe('Cuiabá');
    expect(component['updateRouteForm'].get('destination')?.value).toBe('Sinop');
    expect(component['updateRouteForm'].get('distance')?.value).toBe(500);
  });

  describe('Validações do Formulário', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve invalidar o formulário se os campos obrigatórios forem removidos', () => {
      component['updateRouteForm'].patchValue({
        origin: null,
        destination: null
      });

      expect(component['updateRouteForm'].invalid).toBe(true);
      expect(component['updateRouteForm'].get('origin')?.hasError('required')).toBe(true);
      expect(component['updateRouteForm'].get('destination')?.hasError('required')).toBe(true);
    });

    it('deve lidar de forma segura caso a propriedade route venha indefinida nos dados da modal', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [UpdateRouteComponent],
        providers: [
          provideAnimationsAsync('noop'),
          { provide: TravelService, useValue: travelServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: null } // Dados totalmente nulos
        ]
      });

      const localFixture = TestBed.createComponent(UpdateRouteComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(localComponent['updateRouteForm'].get('origin')?.value).toBeNull();
      expect(localComponent['updateRouteForm'].get('destination')?.value).toBeNull();
      expect(localComponent['updateRouteForm'].get('distance')?.value).toBeNull();
    });
  });

  describe('Fluxo de Submissão da Rota (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve barrar o envio e marcar campos como tocados se o formulário estiver inválido', () => {
      const markAllAsTouchedSpy = vi.spyOn(component['updateRouteForm'], 'markAllAsTouched');
      component['updateRouteForm'].get('origin')?.setValue(null); // Força invalidez
      
      component['onSubmit']();

      expect(markAllAsTouchedSpy).toHaveBeenCalled();
      expect(travelServiceMock.updateRoute).not.toHaveBeenCalled();
    });

    it('deve barrar o envio se o id da rota (routeId) não for localizado', () => {
      // Sobrescreve dados injetados para simular ausência do ID
      (component as any).data = { route: { id: null } };

      component['onSubmit']();
      expect(travelServiceMock.updateRoute).not.toHaveBeenCalled();
    });

    it('deve atualizar os dados com sucesso, exibir mensagem e fechar o diálogo passando true', () => {
      component['updateRouteForm'].patchValue({
        origin: 'Cuiabá',
        destination: 'Sorriso',
        distance: 420
      });

      travelServiceMock.updateRoute.mockReturnValue(of({ message: 'Rota atualizada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(travelServiceMock.updateRoute).toHaveBeenCalledWith(77, component['updateRouteForm'].getRawValue());
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Rota atualizada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve capturar falhas estruturadas da API e renderizar a mensagem de erro vinda do backend', () => {
      const mockApiError = { error: { message: 'Erro ao processar alteração no banco de dados.' } };
      travelServiceMock.updateRoute.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar alteração no banco de dados.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve aplicar mensagem amigável de fallback caso a API falhe cruda/sem corpo estruturado', () => {
      const mockRawError = { status: 500, statusText: 'Internal Error' };
      travelServiceMock.updateRoute.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar a atualização da rota.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});