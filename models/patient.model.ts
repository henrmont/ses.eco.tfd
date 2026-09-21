import { Deficiency } from "../enums/deficiency";
import { Ethnicity } from "../enums/ethnicity";
import { Gender } from "../enums/gender";
import { MaritalStatus } from "../enums/marital-status";
import { Profession } from "../enums/profession";
import { Ufs } from "../enums/ufs";
import { PatientCare } from "./patient-care.model";
import { PatientInfo } from "./patient-info.model";

export interface Patient {
    id?: number,
    name?: string,
    cns?: string,
    file_cns_id?: number | null,
    document_type?: string,
    document?: string,
    sigadoc?: string,
    file_document_id?: number | null,
    birth_date?: string,
    gender?: Gender,
    newborn?: boolean,
    race?: string,
    ethnicity?: Ethnicity,
    marital_status?: MaritalStatus,
    mother_name?: string,
    father_name?: string,
    naturalness?: string,
    phone?: string,
    cell_phone?: string,
    email?: string,
    profession?: Profession,
    deficiency?: Deficiency,
    file_deficiency_id?: number | null,
    cep?: string,
    address?: string,
    file_address_id?: number | null,
    number?: string,
    complement?: string,
    neighborhood?: string,
    city?: string,
    state?: Ufs,
    patient_info?: PatientInfo,
}
