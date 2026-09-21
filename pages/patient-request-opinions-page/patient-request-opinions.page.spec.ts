import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { OpinionService } from '../../services/opinion-service';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { NO_ERRORS_SCHEMA } from '@angular/core';

// 1. Estrutura de espionagem para isolar o barramento global do BroadcastChannel
const broadcastChannelMock = {
  postMessage: vi.fn(),
  close: vi.fn()
};

let canalCallback: any = null;

// Stub do canal antes de carregar o componente (evita vazamentos e interações entre specs)
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

describe('OpinionsPage', () => {
  let component: any;
  let fixture: ComponentFixture<any>;
  
  let mockOpinionService: any;
  let mockMatDialog: any;
  let mockActivatedRoute: any;

  // Mock robusto simulando dados estruturados e nivelados para as regras de filtragem da página
  const mockPatientRequestsResponse = [
    {
      id: 1,
      type: 'Entrada',
      consultation_date: '2026-06-15',
      medical: true,
      social: false,
      back_to_medical: false,
      back_to_social: false,
      medical_status: true,
      social_status: false,
      social_professional: null,
      medical_professional: null,
      cost_assistance_professional: null,
      report: { patient_care: { patient: { name: 'João Caixa Médico', cns: '111111111111111' } } }
    },
    {
      id: 2,
      type: 'Retorno',
      consultation_date: '2026-06-20',
      medical: true,
      social: false,
      back_to_medical: false,
      back_to_social: false,
      medical_status: true,
      social_status: true,
      social_professional: { name: 'Dra. Ana Assistente Social' },
      medical_professional: null,
      cost_assistance_professional: null,
      report: { patient_care: { patient: { name: 'Maria Tramitada Médica', cns: '222222222222222' } } }
    },
    {
      id: 3,
      type: 'Entrada',
      consultation_date: '2026-07-02',
      medical: false,
      social: false,
      back_to_medical: false,
      back_to_social: false,
      medical_status: false,
      social_status: false,
      social_professional: null,
      medical_professional: { name: 'Dr. Roberto Médico Antigo' },
      cost_assistance_professional: null,
      report: { patient_care: { patient: { name: 'Carlos Outro Parecer', cns: '333333333333333' } } }
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    canalCallback = null;

    // Define por padrão perfil como "Médico" (pode ser sobrescrito nos specs)
    mockOpinionService = {
      getType: vi.fn().mockReturnValue(of('Médico')),
      getPatientRequests: vi.fn().mockReturnValue(of(mockPatientRequestsResponse))
    };

    mockMatDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of(true))
      })
    };

    mockActivatedRoute = {
      parent: {
        parent: {
          snapshot: {
            data: {
              user: {
                id: 12,
                roles: [{ permissions: [{ name: 'tfd/parecer listar' }, { name: 'tfd/parecer atualizar' }] }]
              }
            }
          }
        }
      }
    };

    // 2. Dynamic Import crucial para blindar o hoisting do Vitest sobre o BroadcastChannel stubado
    const { OpinionsPage } = await import('./opinions-page');

    await TestBed.configureTestingModule({
      imports: [OpinionsPage],
      providers: [
        { provide: OpinionService, useValue: mockOpinionService },
        { provide: MatDialog, useValue: mockMatDialog },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideEnvironmentNgxMask()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(OpinionsPage);
    component = fixture.componentInstance;

    // Fornece um mock do MatSort para satisfazer a query reativa viewChild.required
    const mockSortInstance = new MatSort();
    vi.spyOn(component, 'sort').mockReturnValue(mockSortInstance);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  // --- BLOCO 1: INICIALIZAÇÃO E TRIAGEM DE SINAIS ---
  describe('Inicialização', () => {
    it('deve criar o componente com sucesso', () => {
      expect(component).toBeTruthy();
    });

    it('deve identificar perfil médico e separar as requisições corretamente via computed signals', () => {
      fixture.detectChanges(); // Dispara ngOnInit e buscas iniciais

      expect(mockOpinionService.getType).toHaveBeenCalledTimes(1);
      expect(mockOpinionService.getPatientRequests).toHaveBeenCalledTimes(1);
      expect(component['profileType']()).toBe('medical');

      // Valida Aba 1: Minha Caixa (Owner)
      const ownerData = component['ownerDataSource']().data;
      expect(ownerData.length).toBe(1);
      expect(ownerData[0].name).toBe('João Caixa Médico');

      // Valida Aba 2: Tramitadas (Process)
      const processData = component['processDataSource']().data;
      expect(processData.length).toBe(1);
      expect(processData[0].name).toBe('Maria Tramitada Médica');

      // Valida Aba 3: Outras Caixas (Others)
      const othersData = component['othersDataSource']().data;
      expect(othersData.length).toBe(1);
      expect(othersData[0].name).toBe('Carlos Outro Parecer');
    });

    it('deve fechar o BroadcastChannel com sucesso no ciclo de destruição (ngOnDestroy)', () => {
      fixture.detectChanges();
      component.ngOnDestroy();
      expect(broadcastChannelMock.close).toHaveBeenCalled();
    });
  });

  // --- BLOCO 2: REATIVIDADE DOS FILTROS ---
  describe('Filtros das Tabelas', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve aplicar e normalizar o filtro na listagem de Minha Caixa', () => {
      const mockEvent = { target: { value: '  JOÃO   ' } } as unknown as Event;
      component['applyOwnerFilter'](mockEvent);
      expect(component['ownerDataSource']().filter).toBe('joão');
    });

    it('deve aplicar e normalizar o filtro na listagem de Tramitadas', () => {
      const mockEvent = { target: { value: 'MARIA' } } as unknown as Event;
      component['applyProcessFilter'](mockEvent);
      expect(component['processDataSource']().filter).toBe('maria');
    });

    it('deve aplicar e normalizar o filtro na listagem de Outras Caixas', () => {
      const mockEvent = { target: { value: 'Carlos' } } as unknown as Event;
      component['applyOthersFilter'](mockEvent);
      expect(component['othersDataSource']().filter).toBe('carlos');
    });
  });

  // --- BLOCO 3: REGRAS INTERNAS E SEGURANÇA CONTRA PERMISSÕES ---
  describe('Validações de Permissões', () => {
    it('deve retornar FALSE (Habilitado) se o usuário possuir o papel de acesso mapeado', () => {
      fixture.detectChanges();
      const disabledState = component['checkPermissions']('tfd/parecer atualizar');
      expect(disabledState).toBe(false);
    });

    it('deve retornar TRUE (Desabilitado) se o usuário NÃO possuir a permissão mapeada', () => {
      fixture.detectChanges();
      const disabledState = component['checkPermissions']('tfd/permissao_fantasma');
      expect(disabledState).toBe(true);
    });
  });

  // --- BLOCO 4: INTERAÇÃO DE MODAIS COM REFRESH (INTERATIVAS) ---
  describe('Ações de Modais Interativas (Com Refresh e Broadcast)', () => {
    beforeEach(() => {
      mockOpinionService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve disparar abertura de modal e emitir update para "haltedPatientRequest"', async () => {
      fixture.detectChanges(); // 1ª chamada (Inicial do ngOnInit)
      component['haltedPatientRequest'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      
      // 1 (detectChanges) + 1 (afterClosed reativo) + 1 (eco do canal via onmessage) = 3 chamadas
      expect(mockOpinionService.getPatientRequests).toHaveBeenCalledTimes(3); 
    });

    it('deve disparar abertura de modal e emitir update para "movePatientRequestFromOthers"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromOthers'](mockPatientRequestsResponse[2]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve disparar abertura de modal e emitir update para "movePatientRequestFromProcesses"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromProcesses'](mockPatientRequestsResponse[1]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve disparar abertura de modal e emitir update para "processPatientRequestToSocial"', async () => {
      fixture.detectChanges();
      component['processPatientRequestToSocial'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve disparar abertura de modal e emitir update para "processPatientRequestToCostAssistanceAndTravel"', async () => {
      fixture.detectChanges();
      component['processPatientRequestToCostAssistanceAndTravel'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve disparar abertura de modal e emitir update para "undoPatientRequest"', async () => {
      fixture.detectChanges();
      component['undoPatientRequest'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve disparar abertura de modal e emitir update para "archivePatientRequest"', async () => {
      fixture.detectChanges();
      component['archivePatientRequest'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
    });
  });

  // --- BLOCO 5: INTERAÇÃO DE MODAIS SEM REFRESH (VISUALIZAÇÃO) ---
  describe('Ações de Modais Passivas (Apenas Leitura/Visualização)', () => {
    beforeEach(() => {
      mockOpinionService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve abrir detalhes do fluxo sem recarregar ou disparar broadcast na "showPatientRequest"', async () => {
      fixture.detectChanges();
      component['showPatientRequest'](mockPatientRequestsResponse[0]);

      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockOpinionService.getPatientRequests).toHaveBeenCalledTimes(1);
    });

    it('deve abrir pareceres sem recarregar ou alterar o barramento na "opinions"', async () => {
      fixture.detectChanges();
      component['opinions'](mockPatientRequestsResponse[0]);

      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir histórico sem recarregar ou alterar o barramento na "history"', async () => {
      fixture.detectChanges();
      component['history'](mockPatientRequestsResponse[0]);

      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir anexos sem recarregar na "patientRequestAttachments"', async () => {
      fixture.detectChanges();
      component['patientRequestAttachments'](mockPatientRequestsResponse[0]);

      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir a mensagem de desfazer passivamente na "undoMessage"', async () => {
      fixture.detectChanges();
      component['undoMessage']('Retorno de fluxo do parecer');

      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});