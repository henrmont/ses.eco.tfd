import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Editor } from 'ngx-editor';

import { UpdateOpinionComponent } from './update-opinion-component';
import { OpinionService } from '../../../services/opinion-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdateOpinionComponent', () => {
  let component: UpdateOpinionComponent;
  let fixture: ComponentFixture<UpdateOpinionComponent>;

  let opinionServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock com dados simulando um parecer já existente para edição
  const mockDialogData = {
    opinion: {
      id: 884,
      name: 'Parecer Inicial de Teste',
      content: '<p>Conteúdo original do parecer.</p>',
      is_approved: true
    }
  };

  beforeEach(async () => {
    opinionServiceMock = {
      updateOpinion: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdateOpinionComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: OpinionService, useValue: opinionServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateOpinionComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente com sucesso, carregar dados prévios e instanciar o Rich Text Editor', () => {
    fixture.detectChanges(); // Dispara ngOnInit (initForm e initEditor)
    
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['updateOpinionForm']).toBeTruthy();
    expect(component['editor']).toBeInstanceOf(Editor);
    
    // Valida se o formulário foi pré-populado corretamente com os dados injetados
    expect(component['updateOpinionForm'].get('name')?.value).toBe('Parecer Inicial de Teste');
    expect(component['updateOpinionForm'].get('content')?.value).toBe('<p>Conteúdo original do parecer.</p>');
    expect(component['updateOpinionForm'].get('is_approved')?.value).toBe(true);
  });

  it('deve destruir o editor de texto rico ao desmontar o componente para mitigar vazamentos de memória', () => {
    fixture.detectChanges();
    
    const editorSpy = vi.spyOn(component['editor'], 'destroy');
    
    fixture.destroy(); // Aciona o gancho do DestroyRef
    
    expect(editorSpy).toHaveBeenCalled();
  });

  describe('Fluxo de Submissão do Parecer (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve barrar a submissão e marcar os campos como tocados se o formulário estiver inválido', () => {
      // Força o formulário a ficar inválido limpando os valores obrigatórios
      component['updateOpinionForm'].patchValue({ name: null, content: null });
      const form = component['updateOpinionForm'];
      expect(form.valid).toBe(false);

      const markAllAsTouchedSpy = vi.spyOn(form, 'markAllAsTouched');

      component['onSubmit']();

      expect(opinionServiceMock.updateOpinion).not.toHaveBeenCalled();
      expect(markAllAsTouchedSpy).toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar silenciosamente a execução se o ID do parecer estiver ausente (Guarda Preventiva)', () => {
      // 🛡️ Altera de forma segura a propriedade configurada como read-only
      Object.defineProperty(component, 'data', {
        value: { opinion: { id: null } },
        writable: true
      });
      
      component['onSubmit']();

      // Garante que o fluxo retornou precocemente sem disparar requisições ou mensagens
      expect(opinionServiceMock.updateOpinion).not.toHaveBeenCalled();
      expect(messageServiceMock.showMessage).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve enviar a atualização com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      // Modifica levemente os dados originais simulando ação do usuário
      component['updateOpinionForm'].patchValue({
        name: 'Parecer Atualizado Alterado',
        content: '<p>Novo conteúdo revisado pelo médico.</p>',
        is_approved: false
      });

      opinionServiceMock.updateOpinion.mockReturnValue(of({ message: 'Parecer atualizado com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(opinionServiceMock.updateOpinion).toHaveBeenCalledWith(884, component['updateOpinionForm'].getRawValue());
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Parecer atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve capturar falhas vindas do backend de forma amigável sem interromper a execução do sistema', () => {
      const mockApiError = { error: { message: 'Erro restrito: Este parecer já foi assinado digitalmente.' } };
      opinionServiceMock.updateOpinion.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro restrito: Este parecer já foi assinado digitalmente.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve acionar o fallback de string de erro se a API falhar sem retornar uma mensagem estruturada', () => {
      // Simula uma falha bruta de rede (Ex: Bad Gateway 502)
      const mockRawError = { status: 502, statusText: 'Bad Gateway' };
      opinionServiceMock.updateOpinion.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar a atualização do parecer.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });
});