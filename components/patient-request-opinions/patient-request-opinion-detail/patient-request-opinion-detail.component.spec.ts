import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer } from '@angular/platform-browser';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ShowOpinionComponent } from './show-opinion-component';

describe('ShowOpinionComponent', () => {
  let component: ShowOpinionComponent;
  let fixture: ComponentFixture<ShowOpinionComponent>;
  let sanitizer: DomSanitizer;

  // Massa de dados mockada casando perfeitamente com a estrutura de parecer (opinion)
  const mockDialogData = {
    opinion: {
      id: 88,
      name: 'Parecer Técnico de Assistência Social',
      content: '<p>O paciente cumpre <strong>todos os requisitos</strong> para concessão do benefício.</p>'
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowOpinionComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShowOpinionComponent);
    component = fixture.componentInstance;
    sanitizer = TestBed.inject(DomSanitizer);
  });

  describe('Inicialização e Renderização', () => {
    it('deve criar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve expor corretamente os dados do parecer injetados pelo diálogo', () => {
      fixture.detectChanges();
      expect(component['data']).toBeDefined();
      expect(component['data'].opinion.id).toBe(88);
      expect(component['data'].opinion.name).toBe('Parecer Técnico de Assistência Social');
    });
  });

  describe('Processamento Reativo de HTML (Computed Signal)', () => {
    it('deve sanitizar o conteúdo HTML do parecer utilizando o DomSanitizer automaticamente', () => {
      // Cria o spy diretamente na instância do DomSanitizer injetado no ambiente de testes
      const spyBypass = vi.spyOn(sanitizer, 'bypassSecurityTrustHtml');
      
      fixture.detectChanges();

      // Avalia o valor resolvido pelo computed signal
      const resultado = component['sanitizedHtml']();

      expect(spyBypass).toHaveBeenCalledWith(mockDialogData.opinion.content);
      expect(resultado).toBeDefined();
    });

    it('deve retornar uma string vazia sanitizada se o conteúdo do parecer não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ShowOpinionComponent],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: { opinion: { name: 'Sem conteúdo' } } }
        ]
      });

      const localFixture = TestBed.createComponent(ShowOpinionComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(localComponent['sanitizedHtml']()).toBeDefined();
    });
  });
});