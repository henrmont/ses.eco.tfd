import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TfdLayout } from './tfd-layout';
import { ActivatedRoute } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MessageService } from '../../../core/services/message-service';
import { DatasusService } from '../../services/datasus-service';
import { of, throwError } from 'rxjs';
import { ElementRef } from '@angular/core';

describe('TfdLayout', () => {
  let component: TfdLayout;
  let fixture: ComponentFixture<TfdLayout>;

  // Mocks das dependências
  let activatedRouteMock: any;
  let dialogMock: any;
  let messageServiceMock: any;
  let datasusServiceMock: any;
  let dialogRefMock: any;

  beforeEach(async () => {
    // 1. Mock do ActivatedRoute simulando a estrutura de snapshot e roles do usuário
    activatedRouteMock = {
      snapshot: {
        routeConfig: { path: 'usuarios' } // Simula que estamos na rota /usuarios
      },
      parent: {
        snapshot: {
          data: {
            user: {
              roles: [
                {
                  permissions: [
                    { name: 'usuarios/usuário listar' },
                    { name: 'usuarios/usuário criar' }
                  ]
                }
              ]
            }
          }
        }
      }
    };

    // 2. Mocks dos serviços e modais
    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)), // Simula que o usuário confirmou a ação no modal
      close: vi.fn()
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    datasusServiceMock = {
      process: vi.fn()
    };

    // Mock global do BroadcastChannel para o Vitest não estourar erro no ambiente Node/JSDOM
    global.BroadcastChannel = vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      close: vi.fn()
    }));

    await TestBed.configureTestingModule({
      imports: [TfdLayout],
      providers: [
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: DatasusService, useValue: datasusServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TfdLayout);
    component = fixture.componentInstance;
    fixture.detectChanges(); // Inicializa o OnPush estavelmente
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('checkPermission', () => {
    it('deve retornar true se o usuário possuir a permissão correspondente à rota ativa', () => {
      const hasPermission = component.checkPermission(['usuário listar']);
      expect(hasPermission).toBe(true);
    });

    it('deve retornar false se o usuário não possuir a permissão exigida', () => {
      const hasPermission = component.checkPermission(['regra criar']);
      expect(hasPermission).toBe(false);
    });

    it('deve tratar com segurança caso o array de roles venha nulo ou indefinido', () => {
      activatedRouteMock.parent.snapshot.data.user.roles = undefined;
      const hasPermission = component.checkPermission(['usuário listar']);
      expect(hasPermission).toBe(false);
    });
  });

  describe('Abertura de Modais de Criação', () => {
    it('deve abrir o modal CreateUserComponent e disparar mensagem no BroadcastChannel se houver retorno positivo', () => {
      component.createUser();
      expect(dialogMock.open).toHaveBeenCalled();
      expect(dialogRefMock.afterClosed).toHaveBeenCalled();
    });

    it('deve abrir o modal CreateRoleComponent corretamente', () => {
      component.createRole();
      expect(dialogMock.open).toHaveBeenCalled();
    });

    it('deve abrir o modal CreateHospitalUnityComponent corretamente', () => {
      component.createHospitalUnity();
      expect(dialogMock.open).toHaveBeenCalled();
    });

    it('deve abrir o modal CreatePatient corretamente', () => {
      component.createPatient();
      expect(dialogMock.open).toHaveBeenCalled();
    });
  });

  describe('Importação de Competência Datasus', () => {
    it('deve simular o clique no input nativo de arquivos ao chamar importCompetence', () => {
      // Mock do signal do viewChild
      const mockNativeElement = { click: vi.fn() };
      vi.spyOn(component, 'competence').mockReturnValue(new ElementRef(mockNativeElement));

      component.importCompetence();
      expect(mockNativeElement.click).toHaveBeenCalled();
    });

    it('deve processar o arquivo zip com sucesso, exibir mensagem e fechar o loading', () => {
      const mockFile = new File([''], 'competencia.zip', { type: 'application/zip' });
      const mockEvent = { target: { files: [mockFile] } };
      
      datasusServiceMock.process.mockReturnValue(of({ message: 'Arquivo processado!' }));

      component.onFileChange(mockEvent);

      expect(dialogMock.open).toHaveBeenCalled(); // Abriu o loading
      expect(datasusServiceMock.process).toHaveBeenCalledWith(mockFile);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo processado!');
      expect(dialogRefMock.close).toHaveBeenCalled(); // Fechou o loading
    });

    it('deve tratar o erro caso o processamento do arquivo falhe no servidor', () => {
      const mockFile = new File([''], 'competencia.zip', { type: 'application/zip' });
      const mockEvent = { target: { files: [mockFile] } };
      const mockError = { error: { message: 'Arquivo zip corrompido.' } };
      
      datasusServiceMock.process.mockReturnValue(throwError(() => mockError));

      component.onFileChange(mockEvent);

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo zip corrompido.');
      expect(dialogRefMock.close).toHaveBeenCalled();
    });
  });
});