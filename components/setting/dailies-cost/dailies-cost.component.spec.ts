import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { of, throwError } from 'rxjs';

import { DailiesCostComponent } from './dailies-cost-component';
import { SettingService } from '../../../services/setting-service';
import { DailyCost } from '../../../models/daily-cost.model';

@Component({
  selector: 'app-update-daily-cost-component',
  standalone: true,
  template: ''
})
class MockUpdateDailyCostComponent {}

describe('DailiesCostComponent', () => {
  let component: DailiesCostComponent;
  let fixture: ComponentFixture<DailiesCostComponent>;

  let settingServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;

  const mockDailyCosts: DailyCost[] = [
    { id: 1, name: 'Diária Motorista', value: 150.00, overnight: false },
    { id: 2, name: 'Diária Técnico', value: 200.00, overnight: true }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    settingServiceMock = {
      getDailiesCost: vi.fn().mockReturnValue(of(mockDailyCosts))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true))
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    await TestBed.configureTestingModule({
      imports: [DailiesCostComponent],
      providers: [
        { provide: SettingService, useValue: settingServiceMock },
        { provide: MatDialog, useValue: dialogMock }
      ]
    })
    .overrideComponent(DailiesCostComponent, {
      set: {
        imports: [
          CommonModule,
          MatCardModule,
          MatListModule,
          MatIconModule,
          MatButtonModule,
          MatProgressSpinnerModule,
          MatTooltipModule,
          MockUpdateDailyCostComponent
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DailiesCostComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('should create e buscar os custos de diárias ao inicializar (ngOnInit)', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(settingServiceMock.getDailiesCost).toHaveBeenCalled();
    expect(component.dailiesCost()).toEqual(mockDailyCosts);
    expect(component.isLoading()).toBe(false);
  });

  it('deve definir a lista como vazia se a busca na API falhar', () => {
    settingServiceMock.getDailiesCost.mockReturnValue(throwError(() => new Error('Erro na API')));
    
    fixture.detectChanges();

    expect(component.dailiesCost()).toEqual([]);
    expect(component.isLoading()).toBe(false);
  });

  it('deve abrir o diálogo de atualização e recarregar a lista se o retorno for positivo (true)', () => {
    fixture.detectChanges();
    const dailyCostAlvo = mockDailyCosts[0];

    component.updateDailyCost(dailyCostAlvo);

    // 🎯 Correção aqui: Mudamos de MockUpdateDailyCostComponent para expect.any(Function)
    expect(dialogMock.open).toHaveBeenCalledWith(expect.any(Function), {
      width: '400px',
      disableClose: true,
      autoFocus: false,
      data: { daily_cost: dailyCostAlvo }
    });
    
    expect(settingServiceMock.getDailiesCost).toHaveBeenCalledTimes(2);
  });

  it('deve abrir o diálogo de atualização mas NÃO recarregar a lista se o retorno for falso ou cancelado', () => {
    dialogRefMock.afterClosed.mockReturnValue(of(false));
    fixture.detectChanges();
    
    component.updateDailyCost(mockDailyCosts[1]);

    expect(dialogMock.open).toHaveBeenCalled();
    expect(settingServiceMock.getDailiesCost).toHaveBeenCalledTimes(1);
  });
});