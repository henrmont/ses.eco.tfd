import { PatientEscort } from "./patient-escort.model"
import { Module } from "./module.model"
import { Patient } from "./patient.model"
import { PatientReport } from "./patient-report.model"
import { User } from "./user.model"

export interface PatientCare {
    id?: number,
    patient_id?: number,
    module_id?: number,
    is_valid?: boolean,
    user_id?: number,
    is_archived?: boolean,
    back_to_user?: string | null,
    status?: boolean,
    patient?: Patient,
    module?: Module,
    user?: User,
    escorts?: PatientEscort[],
    reports?: PatientReport[],
    owner?: boolean
}
