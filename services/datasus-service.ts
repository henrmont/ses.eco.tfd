import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Competence } from '../models/competence.model';
import { environment } from '../../../environments/environment';

const requestOptions = {
  'Authorization': `Bearer ${window.localStorage.getItem('token')}`
}

@Injectable({
  providedIn: 'root',
})
export class DatasusService {

  constructor(
    private http: HttpClient
  ) {}

  process(data: any): Observable<any> {
    const formData = new FormData()
    formData.append('file', data)
    return this.http.post<any>(`${environment.apiDatasusUrl}/process`, formData, {headers: requestOptions})
  }

  getCompetences(): Observable<Competence[]> {
    return this.http.get<Competence[]>(`${environment.apiTfdUrl}/datasus/get-competences`, {headers: requestOptions})
  }
  
}
