import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { OpinionService, ApiResponse } from './opinion-service';
import { environment } from '../../../environments/environment
';

describe('OpinionService', () => {
  let service: OpinionService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiTfdUrl}/opinion`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OpinionService]
    });

    service = TestBed.inject(OpinionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve ser instanciado com sucesso', () => {
    expect(service).toBeTruthy();
  });

  it('deve realizar GET para obter a lista de requisições de pacientes', () => {
    service.getPatientRequests().subscribe();

    const req = httpMock.expectOne(`${baseUrl}/get-patient-requests`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('deve realizar POST para criar uma opinião e retornar uma ApiResponse', () => {
    const mockResponse: ApiResponse = { message: 'Criado com sucesso' };
    const dummyOpinion = { name: 'Parecer Psiquiátrico' } as any;

    service.createOpinion(123, dummyOpinion).subscribe((res) => {
      expect(res.message).toBe('Criado com sucesso');
    });

    const req = httpMock.expectOne(`${baseUrl}/create-opinion/123`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dummyOpinion);
    req.flush(mockResponse);
  });

  it('deve realizar PATCH para arquivar uma solicitação de paciente', () => {
    service.archivePatientRequest(789).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/archive-patient-request/789`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush({ message: 'Arquivado' });
  });

  it('deve realizar DELETE para excluir uma opinião', () => {
    service.deleteOpinion(456).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/delete-opinion/456`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Removido' });
  });
});