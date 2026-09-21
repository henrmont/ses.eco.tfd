import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeleteOpinionComponent } from './delete-opinion-component';
import { OpinionService } from '../../../services/opinion-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeleteOpinionComponent', () => {
  let component: DeleteOpinionComponent;
  let fixture: ComponentFixture<DeleteOpinionComponent>;
  
  let opinionServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    opinion: {
      id: 423,
      name: 'Parecer Psicológico Institucional'
    }
  };

  beforeEach(async () => {
    opinionServiceMock = {
      deleteOpinion: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeleteOpinionComponent]
    })
    // 🚀 Sobrescreve os providers direto no escopo do componente standalone
    .overrideComponent(DeleteOpinionComponent, {
      set: {
        providers: [
          { provide: OpinionService, useValue: opinionServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeleteOpinionComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve inicializar com o estado de submissão desativado', () => {
      fixture.detectChanges();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Fluxo de Submissão (onSubmit)', () => {
    it('deve barrar a execução e exibir mensagem de erro se o id do parecer não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeleteOpinionComponent] })
        .overrideComponent(DeleteOpinionComponent, {
          set: {
            providers: [
              { provide: OpinionService, useValue: opinionServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { opinion: { name: 'Sem ID' } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeleteOpinionComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador do parecer não encontrado.');
      expect(opinionServiceMock.deleteOpinion).not.toHaveBeenCalled();
    });

    it('deve remover o parecer com sucesso, exibir mensagem de retorno da API e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Parecer removido com sucesso do prontuário!' };
      opinionServiceMock.deleteOpinion.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(opinionServiceMock.deleteOpinion).toHaveBeenCalledWith(423);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Parecer removido com sucesso do prontuário!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar a mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
      fixture.detectChanges();
      opinionServiceMock.deleteOpinion.mockReturnValue(of({})); // Resposta sem propriedade .message

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Parecer removido com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Este parecer está assinado e bloqueado contra exclusões.' } };
      opinionServiceMock.deleteOpinion.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(opinionServiceMock.deleteOpinion).toHaveBeenCalledWith(423);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro estruturado', () => {
      fixture.detectChanges();
      const rawError = { status: 504 }; // Sem err.error.message (Ex: Timeout)
      opinionServiceMock.deleteOpinion.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover o parecer.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});