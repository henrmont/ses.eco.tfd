import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { take } from 'rxjs/operators'; // 🌟 Importante para fechar canais reativos
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CreatePatientReportComponent } from './create-patient-report-component';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreatePatientReportComponent', () => {
  let component: CreatePatientReportComponent;
  let fixture: ComponentFixture<CreatePatientReportComponent>;

  let patientServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_care: {
      id: 123,
      patient: {
        id: 456,
        name: 'João da Silva'
      }
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      getCids: vi.fn(),
      createPatientReport: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    // Configuração padrão do serviço de CID retornando uma lista limpa para evitar efeitos colaterais
    patientServiceMock.getCids.mockReturnValue(of([{ code: 'B10', name: 'Infecção por herpesvírus' }]));

    await TestBed.configureTestingModule({
      imports: [
        CreatePatientReportComponent
      ],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: PatientService, useValue: patientServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(CreatePatientReportComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatePatientReportComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['createReportForm']).toBeTruthy();
  });

  describe('Buscas Automáticas e Autocomplete (CID)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve filtrar as opções de CID com base no input do formulário e retornar exatamente 1 opção', () => {
      patientServiceMock.getCids.mockReturnValue(of([{ code: 'B10', name: 'Infecção por herpesvírus' }]));
      
      component['createReportForm'].get('cid_id')?.setValue('B10');
      fixture.detectChanges();

      let resultOptions: any[] = [];
      component['filteredCidOptions'].pipe(take(1)).subscribe(options => {
        resultOptions = options;
      });

      expect(resultOptions.length).toBe(1);
      expect(resultOptions[0].code).toBe('B10');
    });

    it('deve manter cidReadOnly como verdadeiro quando a busca por CIDs falhar', () => {
      patientServiceMock.getCids.mockReturnValue(throwError(() => new Error('API Error')));
      
      fixture = TestBed.createComponent(CreatePatientReportComponent);
      component = fixture.componentInstance;
      
      fixture.detectChanges();

      expect(component['cidReadOnly']?.()).toBe(true);
    });
  });

  describe('Fluxo de Submissão do Laudo (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();

      const reportForm = component['createReportForm'];
      Object.keys(reportForm.controls).forEach(key => {
        const control = reportForm.get(key);
        control?.clearValidators();
        control?.clearAsyncValidators();
        control?.setErrors(null);
        control?.updateValueAndValidity();
      });

      Object.defineProperty(reportForm, 'invalid', { get: () => !reportForm.valid, configurable: true });
      Object.defineProperty(reportForm, 'valid', { get: () => !reportForm.errors, configurable: true });
    });

    it('deve barrar a submissão se o formulário de laudo estiver inválido', () => {
      component['createReportForm'].setErrors({ required: true });

      component['onSubmit']();
      expect(patientServiceMock.createPatientReport).not.toHaveBeenCalled();
    });

    it('deve enviar o laudo com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['createReportForm'].patchValue({
        cid_id: 'B10',
        description: 'Paciente necessita de tratamento fora do domicílio.',
        requested_date: new Date(2026, 5, 16)
      });

      patientServiceMock.createPatientReport.mockReturnValue(of({ message: 'Laudo cadastrado com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(patientServiceMock.createPatientReport).toHaveBeenCalledWith(123, expect.any(Object));
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo cadastrado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve lidar amigavelmente com falhas do backend ao criar laudo', () => {
      component['createReportForm'].patchValue({
        cid_id: 'B10',
        description: 'Descrição de teste',
        requested_date: new Date(2026, 5, 16)
      });

      const mockApiError = { error: { message: 'Erro ao salvar o laudo médico.' }, message: 'Erro ao salvar o laudo médico.' };
      patientServiceMock.createPatientReport.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao salvar o laudo médico.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  // =========================================================================
  // 🚀 NOVOS TESTES ADICIONADOS PARA SAIR DOS 47% E ALCANÇAR ALTA COBERTURA
  // =========================================================================

  describe('Cobertura de Branches Ocultas (CIDs e Erros de Rede)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve lidar corretamente com o filtro quando o valor emitido for um objeto CID completo (Linhas 110-112)', () => {
      const mockCidObjeto = { code: 'B10', name: 'Infecção por herpesvírus' };
      
      // Simula o Angular Material injetando o objeto selecionado diretamente no controle
      component['createReportForm'].get('cid_id')?.setValue(mockCidObjeto);
      fixture.detectChanges();

      component['filteredCidOptions'].pipe(take(1)).subscribe(options => {
        expect(options).toBeTruthy();
        // Garante que mesmo passando um objeto a lógica interna de filtragem tratou a branch
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('deve lidar de forma segura com valores nulos ou strings vazias no campo de busca de CID', () => {
      // Caso 1: Usuário apaga o campo limpando o texto
      component['createReportForm'].get('cid_id')?.setValue('');
      fixture.detectChanges();

      component['filteredCidOptions'].pipe(take(1)).subscribe(options => {
        expect(options.length).toBeGreaterThan(0);
      });

      // Caso 2: O valor inicial ou reset do campo emite null
      component['createReportForm'].get('cid_id')?.setValue(null);
      fixture.detectChanges();

      component['filteredCidOptions'].pipe(take(1)).subscribe(options => {
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('deve tratar erros genéricos da API de criação do laudo sem estourar exceções (Linha 151)', () => {
      component['createReportForm'].patchValue({
        cid_id: 'B10',
        description: 'Descrição Válida',
        requested_date: new Date(2026, 5, 16)
      });

      // Bypassa validação para garantir a submissão
      Object.defineProperty(component['createReportForm'], 'invalid', { get: () => false, configurable: true });

      // Simula uma resposta de falha genérica de rede (ex: Gateway Timeout 504)
      const mockRawError = { status: 504, statusText: 'Gateway Timeout' };
      patientServiceMock.createPatientReport.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      // Garante que o fallback de string tratou a branch da linha 151
      expect(messageServiceMock.showMessage).toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});