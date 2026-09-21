import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideNgxMask } from 'ngx-mask';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fileSaver from 'file-saver';

// 🚀 Isolamento do módulo ESM para permitir interceptação de métodos estáticos
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

import { ShowPatientEscortComponent } from './show-patient-escort-component';
import { StorageService } from '../../../../core/services/storage-service';

describe('ShowPatientEscortComponent', () => {
  let component: ShowPatientEscortComponent;
  let fixture: ComponentFixture<ShowPatientEscortComponent>;
  let storageServiceMock: any;

  // Massa de dados mockada casando perfeitamente com a estrutura do novo template
  const mockDialogData = {
    escort: {
      id: 10,
      name: 'Maria do Carmo Rodrigues',
      relation: 'Mãe',
      document_type: 'CPF',
      document: '44455566677',
      cns: '222333444555666',
      birth_date: '1975-06-15',
      gender: 'Feminino',
      race: 'Parda',
      marital_status: 'Casada',
      phone: '6536110000',
      cell_phone: '65999998888',
      email: 'maria.carmo@email.com',
      cep: '78000000',
      address: 'Avenida Historiador Rubens de Mendonça',
      number: '1000',
      complement: 'Apto 302',
      neighborhood: 'Alvorada',
      city: 'Cuiabá',
      state: 'MT',
      file_document_id: 801,
      file_cns_id: 802,
      file_address_id: 803
    }
  };

  beforeEach(async () => {
    storageServiceMock = {
      download: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ShowPatientEscortComponent],
      providers: [
        provideNgxMask(),
        { provide: StorageService, useValue: storageServiceMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShowPatientEscortComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização e Renderização', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve expor corretamente a árvore de dados do acompanhante injetada pelo diálogo', () => {
      fixture.detectChanges();
      expect(component.data).toBeDefined();
      expect(component.data.escort.name).toBe('Maria do Carmo Rodrigues');
      expect(component.data.escort.relation).toBe('Mãe');
    });
  });

  describe('Fluxo de Download de Arquivos Anexos', () => {
    it('deve acionar o StorageService com o ID correto e realizar o download utilizando o file-saver', () => {
      fixture.detectChanges();

      // Cria um Blob fake simulando o retorno de arquivo binário da API
      const fakeBlob = new Blob(['conteudo-binario-falso'], { type: 'application/pdf' });
      const mockApiResponse = { archive: fakeBlob };
      
      storageServiceMock.download.mockReturnValue(of(mockApiResponse));

      // Executa a trigger de download configurada nos botões do HTML
      component.download(801, 'documento_acompanhante');

      // Verifica se o serviço de Storage buscou a ID da mídia correta
      expect(storageServiceMock.download).toHaveBeenCalledWith(801);
      
      // Valida se a biblioteca externa 'file-saver' recebeu a chamada de salvar em disco
      expect(fileSaver.saveAs).toHaveBeenCalledWith(fakeBlob, 'documento_acompanhante');
    });
  });
});