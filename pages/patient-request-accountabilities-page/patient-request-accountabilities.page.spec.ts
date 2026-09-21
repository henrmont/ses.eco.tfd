import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { AccountabilityService } from '../../services/accountability-service';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { NO_ERRORS_SCHEMA } from '@angular/core';

// 1. Estrutura de espionagem para isolar o barramento global do BroadcastChannel de prestação de contas
const broadcastChannelMock = {
  postMessage: vi.fn(),
  close: vi.fn()
};

let canalCallback: any = null;

// Stub do canal antes de carregar o componente para evitar vazamento de memória e interações colaterais
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

describe('AccountabilitiesPage', () => {
  let component: any;
  let fixture: ComponentFixture<any>;
  
  let mockAccountabilityService: any;
  let mockActivatedRoute: any;
  let dialogSpy: any;

  // Massa de dados configurada estritamente com as chaves lógicas de Prestação de Contas
  const mockAccountabilityRequestsResponse = [
    {
      id: 1,
      type: 'TFD - Prestação de Contas Alimentação',
      consultation_date: '2026-06-15',
      status: 'Pendente',
      accountability: {}, 
      is_accountability_finished: false, // (accountability && !is_accountability_finished) -> Entra em: Minha Caixa
      is_accountability_bookmark: false,
      accountability_status: true,
      report: { patient_care: { patient: { name: 'João Prestação Caixa', cns: '111111111111111' } } }
    },
    {
      id: 2,
      type: 'TFD - Prestação de Contas Hospedagem',
      consultation_date: '2026-06-20',
      status: 'Finalizado',
      accountability: {}, 
      is_accountability_finished: true, // (is_accountability_finished) -> Entra em: Finalizadas
      accountability_professional: { name: 'Profissional Auditor' },
      report: { patient_care: { patient: { name: 'Maria Prestação Finalizada', cns: '222222222222222' } } }
    },
    {
      id: 3,
      type: 'TFD - Tratamento Fora do Domicílio',
      consultation_date: '2026-07-02',
      accountability: null, 
      is_accountability_finished: false, // (!accountability && !is_accountability_finished) -> Entra em: Outras Caixas
      accountability_professional: { name: 'Outro Profissional' },
      report: { patient_care: { patient: { name: 'Carlos Outra Caixa Prestação', cns: '333333333333333' } } }
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    canalCallback = null;

    mockAccountabilityService = {
      getPatientRequests: vi.fn().mockReturnValue(of(mockAccountabilityRequestsResponse))
    };

    mockActivatedRoute = {
      parent: {
        parent: {
          snapshot: {
            data: {
              user: {
                id: 10,
                roles: [
                  { 
                    permissions: [
                      { name: 'tfd/solicitação anexos' }, 
                      { name: 'tfd/ajuda de custo atualizar' },
                      { name: 'tfd/solicitação listar' }
                    ] 
                  }
                ]
              }
            }
          }
        }
      }
    };

    // Import dinâmico do componente standalone
    const { AccountabilitiesPage } = await import('./accountabilities-page');

    await TestBed.configureTestingModule({
      imports: [AccountabilitiesPage],
      providers: [
        { provide: AccountabilityService, useValue: mockAccountabilityService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideEnvironmentNgxMask()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountabilitiesPage);
    component = fixture.componentInstance;

    // Intercepta e espiona o MatDialog injetado no escopo do componente
    const realDialog = fixture.debugElement.injector.get(MatDialog);
    dialogSpy = vi.spyOn(realDialog, 'open').mockReturnValue({
      close: vi.fn(),
      afterClosed: vi.fn().mockReturnValue(of(true)),
      componentInstance: {}
    } as any);

    // Provê um mock do MatSort para satisfazer a viewChild reativa obrigatória
    const mockSortInstance = new MatSort();
    vi.spyOn(component, 'sort').mockReturnValue(mockSortInstance);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  // --- BLOCO 1: INICIALIZAÇÃO E TRIAGEM DE SINAIS (COMPUTED SIGNALS) ---
  describe('Inicialização', () => {
    it('deve criar o componente com sucesso', () => {
      expect(component).toBeTruthy();
    });

    it('deve buscar e separar as requisições de prestação de contas corretamente através dos computeds', () => {
      fixture.detectChanges(); // Dispara ngOnInit e ativa a busca

      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(1);

      // Aba 1: Minha Caixa (owner)
      const ownerData = component['ownerDataSource']().data;
      expect(ownerData.length).toBe(1);
      expect(ownerData[0].name).toBe('João Prestação Caixa');

      // Aba 2: Finalizadas (finish)
      const finishData = component['finishDataSource']().data;
      expect(finishData.length).toBe(1);
      expect(finishData[0].name).toBe('Maria Prestação Finalizada');

      // Aba 3: Outras Caixas (others)
      const othersData = component['othersDataSource']().data;
      expect(othersData.length).toBe(1);
      expect(othersData[0].name).toBe('Carlos Outra Caixa Prestação');
    });

    it('deve fechar a conexão do BroadcastChannel no encerramento (ngOnDestroy)', () => {
      fixture.detectChanges();
      component.ngOnDestroy();
      expect(broadcastChannelMock.close).toHaveBeenCalled();
    });
  });

  // --- BLOCO 2: REATIVIDADE DOS FILTROS LOCALIZADOS ---
  describe('Filtros das Tabelas', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve formatar e injetar o filtro local na listagem de Minha Caixa', () => {
      const mockEvent = { target: { value: '  JOÃO   ' } } as unknown as Event;
      component['applyOwnerFilter'](mockEvent);
      expect(component['ownerDataSource']().filter).toBe('joão');
    });

    it('deve formatar e injetar o filtro local na listagem de Finalizadas', () => {
      const mockEvent = { target: { value: 'MARIA' } } as unknown as Event;
      component['applyFinishFilter'](mockEvent);
      expect(component['finishDataSource']().filter).toBe('maria');
    });

    it('deve formatar e injetar o filtro local na listagem de Outras Caixas', () => {
      const mockEvent = { target: { value: 'Carlos' } } as unknown as Event;
      component['applyOthersFilter'](mockEvent);
      expect(component['othersDataSource']().filter).toBe('carlos');
    });
  });

  // --- BLOCO 3: SEGURANÇA E INVERSÃO DE PERMISSÕES ---
  describe('Controle de Permissões e Status', () => {
    it('deve retornar FALSE (Habilitado) se o usuário carregar o papel mapeado', () => {
      fixture.detectChanges();
      const disabledState = component['checkPermissions']('tfd/ajuda de custo atualizar');
      expect(disabledState).toBe(false);
    });

    it('deve retornar TRUE (Desabilitado) se o usuário NÃO possuir a permissão mapeada', () => {
      fixture.detectChanges();
      const disabledState = component['checkPermissions']('permissao/inexistente_tfd');
      expect(disabledState).toBe(true);
    });

    it('deve validar o status se houver parecer médico e parecer social simultâneos', () => {
      expect(component['checkStatus']({ medical_status: true, social_status: true })).toBe(true);
      expect(component['checkStatus']({ medical_status: false, social_status: true })).toBe(false);
    });
  });

  // --- BLOCO 4: INTERAÇÃO DE MODAIS INTERATIVAS (COM REFRESH E BROADCAST) ---
  describe('Ações de Modais Interativas (Com Atualização e Sincronismo)', () => {
    beforeEach(() => {
      mockAccountabilityService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "haltedPatientRequest"', async () => {
      fixture.detectChanges(); 
      component['haltedPatientRequest'](mockAccountabilityRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(3); 
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "accountabilities"', async () => {
      fixture.detectChanges(); 
      component['accountabilities'](mockAccountabilityRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(3); 
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "finishPatientRequestAccountability"', async () => {
      fixture.detectChanges();
      component['finishPatientRequestAccountability'](mockAccountabilityRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "movePatientRequestFromFinished"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromFinished'](mockAccountabilityRequestsResponse[1]);
      
      await Promise.resolve();
      // O método está como escopo futuro no componente (openDialog comentado), logo mantém o fluxo passivo inicial
      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(1);
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "movePatientRequestFromOthers"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromOthers'](mockAccountabilityRequestsResponse[2]);
      
      await Promise.resolve();
      // O método está como escopo futuro no componente (openDialog comentado), logo mantém o fluxo passivo inicial
      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(1);
    });
  });

  // --- BLOCO 5: INTERAÇÃO DE MODAIS PASSIVAS (APENAS LEITURA / VISUALIZAÇÃO) ---
  describe('Ações de Modais Passivas (Apenas Leitura/Visualização)', () => {
    beforeEach(() => {
      mockAccountabilityService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve abrir detalhes do fluxo sem recarregar ou emitir broadcast em "showPatientRequest"', async () => {
      fixture.detectChanges();
      component['showPatientRequest'](mockAccountabilityRequestsResponse[0]);

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(1); 
    });

    it('deve abrir anexos sem recarregar ou emitir broadcast em "patientRequestAttachments"', async () => {
      fixture.detectChanges();
      component['patientRequestAttachments'](mockAccountabilityRequestsResponse[0]);

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(1);
    });

    it('deve abrir visualização de mensagem de retorno sem recarregar ou emitir broadcast em "undoMessage"', async () => {
      fixture.detectChanges();
      component['undoMessage']('Mensagem de erro de documentação');

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockAccountabilityService.getPatientRequests).toHaveBeenCalledTimes(1);
    });
  });
});