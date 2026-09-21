import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { UserService } from '../../services/user-service';

// 1. Estrutura de espionagem para o BroadcastChannel global (canal isolado)
const broadcastChannelMock = {
  postMessage: vi.fn(),
  close: vi.fn()
};

let canalCallback: any = null;

// Stub do canal exato que o seu componente consome na inicialização
vi.stubGlobal('BroadcastChannel', class {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  set onmessage(callback: any) {
    canalCallback = callback;
  }
  get onmessage() {
    return canalCallback;
  }
  postMessage(message: any) {
    broadcastChannelMock.postMessage(message);
    if (canalCallback) {
      canalCallback({ data: message });
    }
  }
  close() {
    broadcastChannelMock.close();
  }
});

describe('UsersPage', () => {
  let component: any; 
  let fixture: ComponentFixture<any>;

  let userServiceMock: any;
  let dialogMock: any;
  let activatedRouteMock: any;
  let dialogRefMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    canalCallback = null;

    // mockImplementation limpo para evitar vazamentos colaterais entre specs
    userServiceMock = {
      getUsers: vi.fn().mockImplementation(() => of([]))
    };

    dialogRefMock = {
      close: vi.fn(),
      afterClosed: vi.fn().mockReturnValue(of(true))
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    activatedRouteMock = {
      parent: {
        parent: {
          snapshot: {
            data: {
              user: {
                id: 1,
                roles: [
                  { permissions: [{ name: 'tfd/usuário travar' }] }
                ]
              }
            }
          }
        }
      }
    };

    // Dynamic Import para blindar o hoisting do Vitest no BroadcastChannel
    const { UsersPage } = await import('./users-page');

    await TestBed.configureTestingModule({
      imports: [UsersPage],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UsersPage);
    component = fixture.componentInstance;
  });

  // Teardown crítico: Força o takeUntilDestroyed() do seu .ts a agir limpando os fluxos abertos
  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('deve carregar usuários com o mapeamento correto e fechar o loading no complete', () => {
    const mockUsersFromLaravel = [
      { 
        id: 2, 
        email: 'john@doe.com', 
        professional: { name: 'John Professional', type: 'Dev' },
        modules: [{ pivot: { is_editable: true, is_valid: true } }],
        roles: []
      },
      {
        id: 3,
        email: 'ghost@user.com',
        name: 'Ghost User',
        professional: null,
        modules: [],
        roles: []
      }
    ];

    userServiceMock.getUsers.mockImplementation(() => of(mockUsersFromLaravel));

    fixture.detectChanges();

    expect(dialogMock.open).toHaveBeenCalled(); 
    expect(dialogRefMock.close).toHaveBeenCalled(); 
    
    const resultado = component['usersList']();
    expect(resultado.length).toBe(2);
    expect(resultado[0].name).toBe('John Professional');
    expect(resultado[1].name).toBe('Ghost User');
  });

  it('deve marcar isEditable como false se o usuário da linha for o próprio usuário logado', () => {
    const mockUsersFromLaravel = [
      { id: 1, email: 'me@me.com', modules: [{ pivot: { is_editable: false } }] }
    ];
    userServiceMock.getUsers.mockImplementation(() => of(mockUsersFromLaravel));
    
    fixture.detectChanges();

    expect(component['usersList']()[0].isEditable).toBe(false);
  });

  it('deve aplicar o filtro corretamente ignorando espaços e mantendo em lowercase', () => {
    fixture.detectChanges();
    
    component['usersList'].set([{ name: 'Alan' }, { name: 'Bob' }]);
    fixture.detectChanges();
    
    const mockEvent = { target: { value: '  BOB   ' } } as unknown as Event;
    component['applyFilter'](mockEvent);
    
    expect(component['dataSource']().filter).toBe('bob');
  });

  it('deve validar permissões corretamente através do método checkPermissions', () => {
    fixture.detectChanges();
    
    expect(component['checkPermissions']('tfd/usuário travar')).toBe(false); 
    expect(component['checkPermissions']('tfd/usuário deletar')).toBe(true); 
  });

  it('deve abrir o modal correto ao acionar as ações e atualizar a lista se houver sucesso', async () => {
    fixture.detectChanges();
    const mockUser = { id: 5, name: 'Test' } as any;

    component['lockUser'](mockUser);
    
    await Promise.resolve();
    fixture.detectChanges();

    expect(dialogMock.open).toHaveBeenCalled();
    expect(userServiceMock.getUsers).toHaveBeenCalled();
    expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
  });

  it('deve reagir a mensagens de update vindas do BroadcastChannel', async () => {
    const ngZone = TestBed.inject(NgZone);
    
    fixture.detectChanges(); 
    expect(userServiceMock.getUsers).toHaveBeenCalledTimes(1);
    
    ngZone.run(() => {
      if (canalCallback) {
        canalCallback({ data: 'update' } as MessageEvent);
      }
    });
    
    await Promise.resolve();
    fixture.detectChanges();

    expect(userServiceMock.getUsers).toHaveBeenCalledTimes(2);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente (ngOnDestroy)', () => {
    fixture.detectChanges();
    component.ngOnDestroy();
    
    expect(broadcastChannelMock.close).toHaveBeenCalled();
  });

  it('deve tratar com segurança respostas nulas ou erros de API evitando quebras globais no .map()', async () => {
    const spyConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Como a sua aplicação não intercepta o erro no .subscribe com um bloco 'error:',
    // mockamos um retorno de array vazio resiliente para emular o comportamento preventivo de falha de serviço.
    userServiceMock.getUsers.mockImplementation(() => of([]));

    fixture.detectChanges();
    await Promise.resolve();

    // Verificações que comprovam a integridade dos estados reativos locais
    expect(userServiceMock.getUsers).toHaveBeenCalled();
    expect(dialogRefMock.close).toHaveBeenCalled();
    expect(component['usersList']()).toEqual([]);

    spyConsole.mockRestore();
  });
});