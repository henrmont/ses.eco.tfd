import { Gender } from "../enums/gender";
import { Ufs } from "../enums/ufs";
import { PatientCare } from "./patient-care.model";

export interface PatientEscort {
    id: number,
    patient_care_id: number,
    cns: string,
    file_cns_id?: number | null,
    document: string,
    file_document_id?: number | null,
    name: string,
    relation?: string,
    birth_date?: string,
    gender?: Gender,
    is_same_address: boolean,
    cep: string,
    address: string,
    file_address_id?: number | null,
    number: string,
    complement?: string,
    neighborhood: string,
    city?: string,
    state?: Ufs,
    patient_care?: PatientCare
}
