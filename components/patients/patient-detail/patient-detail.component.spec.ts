import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShowPatientComponent } from './show-patient-component';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../../../../core/services/storage-service';
import { provideNgxMask } from 'ngx-mask'; // Importação necessária da máscara

// Mock global da biblioteca file-saver para interceptar o download de arquivos
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

import { saveAs } from 'file-saver';

describe('ShowPatientComponent', () => {
  let component: ShowPatientComponent;
  let fixture: ComponentFixture<ShowPatientComponent>;
  let mockStorageService: any;

  // Massa de dados ajustada para bater com a estrutura do seu HTML (patient_care)
  const mockPatientData = {
    patient_care: {
      name: 'Paciente Visualizacao Teste',
      sigadoc: 'SIGADOC-123',
      document_type: 'CPF',
      document: '11122233344',
      cns: '987654321012345',
      birth_date: '1990-01-01',
      gender: 'Masculino',
      newborn: false,
      race: 'Parda',
      marital_status: 'Solteiro',
      father_name: 'Pai do Paciente',
      mother_name: 'Mãe do Paciente',
      naturalness: 'Cuiabá',
      profession: 'Desenvolvedor',
      deficiency: null,
      phone: '6533333333',
      cell_phone: '65999999999',
      email: 'paciente@teste.com',
      cep: '78000000',
      address: 'Rua das Flores',
      number: '123',
      complement: 'Casa',
      neighborhood: 'Centro',
      city: 'Cuiabá',
      state: 'MT',
      file_document_id: 1,
      file_cns_id: null,
      file_deficiency_id: null,
      file_address_id: null,
      patient_info: {
        control_number: 'CTL-999',
        file_protocol_id: null,
        observation: 'Sem observações.'
      }
    }
  };

  beforeEach(async () => {
    mockStorageService = {
      download: vi.fn().mockReturnValue(of({ archive: new Blob(['conteudo-fake'], { type: 'application/pdf' }) }))
    };

    await TestBed.configureTestingModule({
      imports: [ShowPatientComponent],
      providers: [
        provideNgxMask(), // Resolve o problema do InjectionToken ausente
        { provide: MAT_DIALOG_DATA, useValue: mockPatientData },
        { provide: StorageService, useValue: mockStorageService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShowPatientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('deve receber os dados do paciente via MAT_DIALOG_DATA corretamente', () => {
    expect(component.data).toBeDefined();
    expect(component.data.patient_care.name).toBe('Paciente Visualizacao Teste');
  });

  it('deve acionar o StorageService e efetuar o download do arquivo usando saveAs', () => {
    const archiveId = 1;
    const fileName = 'documento';

    component.download(archiveId, fileName);

    expect(mockStorageService.download).toHaveBeenCalledWith(archiveId);
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), fileName);
  });
});