import { Patient } from "./patient.model";

export interface PatientInfo {
    id: number,
    patient_id: number,
    observation?: string,
    control_number?: string,
    sigadoc?: string,
    file_sigadoc_id?: number | null,
    patient?: Patient,
}
