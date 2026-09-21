import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HospitalUnity } from '../models/hospital-unity.model';
import { environment } from '../../../environments/environment';

const requestOptions = {
  'Authorization': `Bearer ${window.localStorage.getItem('token')}`
}

@Injectable({
  providedIn: 'root',
})
export class HospitalUnityService {

  constructor(
    private http: HttpClient
  ) {}

  getHospitalUnities(): Observable<HospitalUnity[]> {
    return this.http.get<HospitalUnity[]>(`${environment.apiTfdUrl}/hospital-unity/get-hospital-unities`, {headers: requestOptions})
  }

  createHospitalUnity(data: HospitalUnity): Observable<Array<any>> {
    return this.http.post<Array<any>>(`${environment.apiTfdUrl}/hospital-unity/create-hospital-unity`, data, {headers: requestOptions})
  }
  
  updateHospitalUnity(hospital_unity: number, data: HospitalUnity): Observable<Array<any>> {
    return this.http.patch<Array<any>>(`${environment.apiTfdUrl}/hospital-unity/update-hospital-unity/${hospital_unity}`, data, {headers: requestOptions})
  }

  deleteHospitalUnity(hospital_unity: number): Observable<Array<any>> {
    return this.http.delete<Array<any>>(`${environment.apiTfdUrl}/hospital-unity/delete-hospital-unity/${hospital_unity}`, {headers: requestOptions})
  }
  
}
