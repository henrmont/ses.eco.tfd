import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Editor } from 'ngx-editor';

import { CreateOpinionComponent } from './create-opinion-component';
import { OpinionService } from '../../../services/opinion-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreateOpinionComponent', () => {
  let component: CreateOpinionComponent;
  let fixture: ComponentFixture<CreateOpinionComponent>;

  let opinionServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 552
    }
  };

  beforeEach(async () => {
    opinionServiceMock = {
      createOpinion: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        CreateOpinionComponent
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

    fixture = TestBed.createComponent(CreateOpinionComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente com sucesso, inicializar o formulário e instanciar o Rich Text Editor', () => {
    fixture.detectChanges(); // Dispara o ngOnInit (initForm e initEditor)
    
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['createOpinionForm']).toBeTruthy();
    expect(component['editor']).toBeInstanceOf(Editor);
  });

  it('deve destruir o editor de texto rico ao desmontar o componente para mitigar vazamentos de memória', () => {
    fixture.detectChanges();
    
    const editorSpy = vi.spyOn(component['editor'], 'destroy');
    
    // Força o acionamento do DestroyRef destruindo a fixture do componente
    fixture.destroy();
    
    expect(editorSpy).toHaveBeenCalled();
  });

  describe('Fluxo de Submissão do Parecer (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve barrar a submissão e marcar os campos como tocados se o formulário estiver inválido', () => {
      const form = component['createOpinionForm'];
      expect(form.valid).toBe(false);

      const markAllAsTouchedSpy = vi.spyOn(form, 'markAllAsTouched');

      component['onSubmit']();

      expect(opinionServiceMock.createOpinion).not.toHaveBeenCalled();
      expect(markAllAsTouchedSpy).toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar silenciosamente a execução se o ID da solicitação do paciente estiver ausente (Guarda Preventiva)', () => {
      // 🛡️ Altera a propriedade de forma segura contornando a restrição de "read-only" do TypeScript
      Object.defineProperty(component, 'data', {
        value: { patient_request: { id: null } },
        writable: true
      });
      
      // Preenche o formulário com dados válidos
      component['createOpinionForm'].patchValue({
        name: 'Parecer Cardiológico de Teste',
        content: '<p>Paciente está apto para o procedimento cirúrgico.</p>',
        is_approved: true
      });

      component['onSubmit']();

      // Garante que o método retornou antes de chamar o serviço ou exibir mensagens
      expect(opinionServiceMock.createOpinion).not.toHaveBeenCalled();
      expect(messageServiceMock.showMessage).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve enviar o parecer com sucesso, exibir mensagem de retorno e fechar a modal retornando true', () => {
      component['createOpinionForm'].patchValue({
        name: 'Parecer Clínico Geral',
        content: '<p>Conteúdo do parecer validado.</p>',
        is_approved: true
      });

      opinionServiceMock.createOpinion.mockReturnValue(of({ message: 'Parecer criado com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(opinionServiceMock.createOpinion).toHaveBeenCalledWith(552, component['createOpinionForm'].value);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Parecer criado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve capturar falhas vindas do backend de forma amigável sem interromper a execução do sistema', () => {
      component['createOpinionForm'].patchValue({
        name: 'Parecer de Teste de Erro',
        content: '<p>Texto...</p>',
        is_approved: false
      });

      const mockApiError = { error: { message: 'Inconsistência de dados cadastrais no servidor.' } };
      opinionServiceMock.createOpinion.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Inconsistência de dados cadastrais no servidor.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve acionar o fallback de string de erro se a API falhar sem retornar uma mensagem estruturada', () => {
      component['createOpinionForm'].patchValue({
        name: 'Parecer Fallback Erro',
        content: '<p>Texto...</p>',
        is_approved: true
      });

      // Simula um erro cru de infraestrutura de rede (Ex: Gateway Timeout 504)
      const mockRawError = { status: 504, statusText: 'Gateway Timeout' };
      opinionServiceMock.createOpinion.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar a criação do parecer.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });
});