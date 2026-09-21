import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { OpinionsComponent } from './opinions-component';
import { OpinionService } from '../../../services/opinion-service';
import { ShowOpinionComponent } from '../show-opinion-component/show-opinion-component';
import { CreateOpinionComponent } from '../create-opinion-component/create-opinion-component';
import { UpdateOpinionComponent } from '../update-opinion-component/update-opinion-component';
import { DeleteOpinionComponent } from '../delete-opinion-component/delete-opinion-component';
import { Opinion } from '../../../models/opinion';

describe('OpinionsComponent', () => {
  let component: OpinionsComponent;
  let fixture: ComponentFixture<OpinionsComponent>;

  // Mocks das dependências
  let opinionServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;
  let broadcastChannelSpy: any;

  // Dados falsos de entrada via MAT_DIALOG_DATA com estrutura de permissões
  const mockDialogData = {
    patient_request: {
      id: 552
    },
    permissions: [
      {
        permissions: [
          { name: 'tfd/parecer criar' },
          { name: 'tfd/parecer atualizar' }
        ]
      }
    ]
  };

  // Massa de dados de pareceres mockados baseados no Model
  const mockOpinionsResponse: Opinion[] = [
    { id: '1', name: 'Parecer Cardiológico', is_approved: true, my_opinion: true, professional: { name: 'Dr. Silva' } } as any,
    { id: '2', name: 'Parecer Ortopédico', is_approved: false, my_opinion: false, professional: { name: 'Dr. Souza' } } as any
  ];

  beforeEach(async () => {
    opinionServiceMock = {
      getOpinions: vi.fn().mockReturnValue(of(mockOpinionsResponse))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula confirmação nas modais
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    // Espiona o BroadcastChannel global de pareceres para capturar a sincronização entre abas
    broadcastChannelSpy = vi.spyOn(BroadcastChannel.prototype, 'postMessage');

    await TestBed.configureTestingModule({
      imports: [OpinionsComponent]
    })
    .overrideComponent(OpinionsComponent, {
      set: {
        providers: [
          { provide: OpinionService, useValue: opinionServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(OpinionsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização e Fluxo de Carga Inicial', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges(); // Dispara o ngOnInit
      expect(component).toBeTruthy();
    });

    it('deve carregar a lista de pareceres reativamente e alimentar o dataSource (computed)', () => {
      fixture.detectChanges();

      // Garante que chamou o serviço usando o ID do request correto
      expect(opinionServiceMock.getOpinions).toHaveBeenCalledWith(552);
      
      // Valida se o sinal reativo base foi preenchido
      expect(component['opinionsList']()).toEqual(mockOpinionsResponse);
      
      // Valida se o computed do dataSource gerou a instância correta com os dados populados
      expect(component['dataSource']()).toBeInstanceOf(MatTableDataSource);
      expect(component['dataSource']().data).toEqual(mockOpinionsResponse);
      
      // O loading deve ter sido desativado ao concluir com sucesso
      expect(component['isLoading']()).toBe(false);
    });

    it('deve desativar o spinner e não quebrar se o id do request estiver ausente (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [OpinionsComponent] })
        .overrideComponent(OpinionsComponent, {
          set: {
            providers: [
              { provide: OpinionService, useValue: opinionServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(OpinionsComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(opinionServiceMock.getOpinions).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading mesmo se a API falhar no ciclo de inicialização', () => {
      opinionServiceMock.getOpinions.mockReturnValue(throwError(() => new Error('Erro de Conexão')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['opinionsList']()).toEqual([]);
    });
  });

  describe('Validação de Regras de Permissão de Acesso', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve retornar false se o usuário possuir a permissão requerida (permitindo a ação no template)', () => {
      // Como a lógica original de negócio inverte o booleano (!roles.some...)
      const result = component['checkPermissions']('tfd/parecer criar');
      expect(result).toBe(false);
    });

    it('deve retornar true se o usuário NÃO possuir a permissão requerida (bloqueando a ação no template)', () => {
      const result = component['checkPermissions']('tfd/parecer deletar');
      expect(result).toBe(true);
    });

    it('deve tratar com segurança cenários onde a lista de permissões venha nula ou indefinida', () => {
      component['data'].permissions = null;
      const result = component['checkPermissions']('tfd/parecer criar');
      expect(result).toBe(true);
    });
  });

  describe('Abertura de Modais e Fluxos de Ação', () => {
    const targetOpinion = { id: 1, name: 'Parecer Teste' } as Opinion;

    beforeEach(() => {
      fixture.detectChanges(); // Inicializa o estado reativo base antes dos cliques
    });

    it('deve abrir a modal ShowOpinionComponent em modo de visualização pura', () => {
      component['showOpinion'](targetOpinion);

      expect(dialogMock.open).toHaveBeenCalledWith(ShowOpinionComponent, {
        width: '1200px',
        height: '700px',
        disableClose: true,
        autoFocus: false,
        data: { opinion: targetOpinion }
      });
      // Telas de visualização pura não alteram estado, logo não emitem eventos no canal
      expect(broadcastChannelSpy).not.toHaveBeenCalled();
    });

    it('deve abrir a modal CreateOpinionComponent, atualizar a grid de forma fluida (background) e notificar via BroadcastChannel', () => {
      opinionServiceMock.getOpinions.mockClear();

      component['createOpinion']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreateOpinionComponent, {
        width: '1200px',
        height: '700px',
        disableClose: true,
        autoFocus: false,
        data: { patient_request: mockDialogData.patient_request }
      });

      // Ações com confirmação disparam o recarregamento e propagam a notificação
      expect(opinionServiceMock.getOpinions).toHaveBeenCalledWith(552);
      expect(broadcastChannelSpy).toHaveBeenCalledWith('update');
      expect(component['isLoading']()).toBe(false); // Fluido, sem reativar loader principal
    });

    it('deve abrir a modal UpdateOpinionComponent e recarregar os dados após salvamento', () => {
      opinionServiceMock.getOpinions.mockClear();

      component['updateOpinion'](targetOpinion);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdateOpinionComponent, {
        width: '1200px',
        height: '700px',
        disableClose: true,
        autoFocus: false,
        data: { opinion: targetOpinion }
      });

      expect(opinionServiceMock.getOpinions).toHaveBeenCalledWith(552);
      expect(broadcastChannelSpy).toHaveBeenCalledWith('update');
    });

    it('deve abrir a modal DeleteOpinionComponent acionando o spinner principal devido à remoção física', () => {
      opinionServiceMock.getOpinions.mockClear();

      component['deleteOpinion'](targetOpinion);

      expect(dialogMock.open).toHaveBeenCalledWith(DeleteOpinionComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { opinion: targetOpinion }
      });

      // O delete força a reativação do loading para limpar o registro visualmente
      expect(opinionServiceMock.getOpinions).toHaveBeenCalledWith(552);
      expect(broadcastChannelSpy).toHaveBeenCalledWith('update');
    });

    it('não deve atualizar os dados nem enviar mensagens inter-abas se as modais forem canceladas ou fechadas com falso/nulo', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false)); // Simula cancelamento pelo usuário
      opinionServiceMock.getOpinions.mockClear();
      broadcastChannelSpy.mockClear();

      component['createOpinion']();

      expect(opinionServiceMock.getOpinions).not.toHaveBeenCalled();
      expect(broadcastChannelSpy).not.toHaveBeenCalled();
    });
  });
});